import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listRulesets } from '../../engine/index.ts';
import { runScenarioOptimizer } from './engine.ts';
import type {
  OptimizerConfig,
  OptimizerMode,
  OptimizerRuntimeProfile,
  OptimizerSignificanceMode,
  OptimizerStrategyMode,
} from './types.ts';

interface CliArgs {
  scenarioId?: string;
  iterations?: number;
  baselineRuns?: number;
  candidateRuns?: number;
  candidates?: number;
  patience?: number;
  seed?: number;
  outDir?: string;
  mode?: OptimizerMode;
  runtime?: OptimizerRuntimeProfile;
  significance?: OptimizerSignificanceMode;
  strategy?: OptimizerStrategyMode;
}

interface InteractiveConfigAnswers {
  scenarioId: string;
  runtime: OptimizerRuntimeProfile;
  mode: OptimizerMode;
  significance: OptimizerSignificanceMode;
  strategy: OptimizerStrategyMode;
  iterations: number;
  baselineRuns: number;
  candidateRuns: number;
  candidates: number;
  patience: number;
  seed: number;
  outDir: string;
}

interface InquirerPrompt {
  <T>(questions: unknown[]): Promise<T>;
}

const DEFAULT_OUT_DIR = resolve(process.cwd(), 'simulation_output/optimizer');

const RUNTIME_DEFAULTS: Record<OptimizerRuntimeProfile, Pick<OptimizerConfig, 'baselineRuns' | 'candidateRuns' | 'candidates'>> = {
  fast: {
    baselineRuns: 3000,
    candidateRuns: 1500,
    candidates: 8,
  },
  balanced: {
    baselineRuns: 10000,
    candidateRuns: 5000,
    candidates: 15,
  },
  thorough: {
    baselineRuns: 30000,
    candidateRuns: 15000,
    candidates: 24,
  },
};

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseMode(raw: string): OptimizerMode {
  const value = raw.toLowerCase();
  if (value === 'liberation' || value === 'symbolic' || value === 'both') {
    return value;
  }
  throw new Error(`Unsupported --mode value "${raw}". Use liberation, symbolic, or both.`);
}

function parseRuntime(raw: string): OptimizerRuntimeProfile {
  const value = raw.toLowerCase();
  if (value === 'fast' || value === 'balanced' || value === 'thorough') {
    return value;
  }
  throw new Error(`Unsupported --runtime value "${raw}". Use fast, balanced, or thorough.`);
}

function parseSignificance(raw: string): OptimizerSignificanceMode {
  const value = raw.toLowerCase();
  if (value === 'strict' || value === 'balanced' || value === 'lenient') {
    return value;
  }
  throw new Error(`Unsupported --significance value "${raw}". Use strict, balanced, or lenient.`);
}

function parseStrategy(raw: string): OptimizerStrategyMode {
  const value = raw.toLowerCase();
  if (
    value === 'numeric_balancing'
    || value === 'victory_gating_exploration'
    || value === 'trajectory_discovery'
    || value === 'full_optimizer'
  ) {
    return value;
  }
  throw new Error(
    `Unsupported --strategy value "${raw}". Use numeric_balancing, victory_gating_exploration, trajectory_discovery, or full_optimizer.`,
  );
}

function modeToVictoryModes(mode: OptimizerMode): OptimizerConfig['victoryModes'] {
  if (mode === 'both') {
    return ['liberation', 'symbolic'];
  }
  return [mode];
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      index += 1;
      return value;
    };

    if (arg === '--scenario') {
      args.scenarioId = readValue();
      continue;
    }
    if (arg === '--iterations') {
      args.iterations = toPositiveInteger(readValue(), '--iterations');
      continue;
    }
    if (arg === '--baseline-runs') {
      args.baselineRuns = toPositiveInteger(readValue(), '--baseline-runs');
      continue;
    }
    if (arg === '--candidate-runs') {
      args.candidateRuns = toPositiveInteger(readValue(), '--candidate-runs');
      continue;
    }
    if (arg === '--candidates') {
      args.candidates = toPositiveInteger(readValue(), '--candidates');
      continue;
    }
    if (arg === '--patience') {
      args.patience = toPositiveInteger(readValue(), '--patience');
      continue;
    }
    if (arg === '--seed') {
      args.seed = toPositiveInteger(readValue(), '--seed') >>> 0;
      continue;
    }
    if (arg === '--out') {
      args.outDir = resolve(readValue());
      continue;
    }
    if (arg === '--mode') {
      args.mode = parseMode(readValue());
      continue;
    }
    if (arg === '--runtime') {
      args.runtime = parseRuntime(readValue());
      continue;
    }
    if (arg === '--significance') {
      args.significance = parseSignificance(readValue());
      continue;
    }
    if (arg === '--strategy') {
      args.strategy = parseStrategy(readValue());
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export async function buildConfig(argv: string[]): Promise<OptimizerConfig> {
  const parsed = parseArgs(argv);
  const scenarioIds = listRulesets().map((ruleset) => ruleset.id).sort((left, right) => left.localeCompare(right));

  const validateScenarioId = (value: string) => {
    if (!scenarioIds.includes(value)) {
      throw new Error(`Unknown scenario "${value}". Available: ${scenarioIds.join(', ')}`);
    }
    return value;
  };

  const promptInteractiveConfig = async (prefill: CliArgs): Promise<InteractiveConfigAnswers> => {
    console.log('🧠 Scenario Optimizer');
    console.log('');
    console.log('No scenario specified.');
    console.log('');
    console.log('Available scenarios:');
    console.log('');
    for (const scenarioId of scenarioIds) {
      console.log(scenarioId);
    }
    console.log('');

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('No scenario specified and interactive prompt is unavailable (TTY required). Re-run with --scenario <id>.');
    }

    const inquirerModule = await import('inquirer');
    const prompt = (inquirerModule.default as { prompt: InquirerPrompt }).prompt;

    const firstPass = await prompt<Pick<InteractiveConfigAnswers, 'scenarioId' | 'runtime' | 'mode' | 'significance' | 'strategy'>>([
      {
        type: 'list',
        name: 'scenarioId',
        message: 'Select scenario to optimize:',
        choices: scenarioIds,
      },
      {
        type: 'list',
        name: 'runtime',
        message: 'Runtime profile (controls default run budgets and speed)',
        default: prefill.runtime ?? 'balanced',
        choices: [
          { name: 'fast - quickest, lowest statistical stability', value: 'fast' },
          { name: 'balanced - default tradeoff between runtime and accuracy', value: 'balanced' },
          { name: 'thorough - slowest, strongest metric stability', value: 'thorough' },
        ],
      },
      {
        type: 'list',
        name: 'strategy',
        message: 'Select optimization strategy:',
        default: prefill.strategy ?? 'full_optimizer',
        choices: [
          { name: 'numeric balancing - tune numeric pressure/threshold knobs', value: 'numeric_balancing' },
          { name: 'victory gating exploration - focus on round/action/progress gates', value: 'victory_gating_exploration' },
          { name: 'trajectory discovery - prioritize trajectory-guided mutations', value: 'trajectory_discovery' },
          { name: 'full optimizer (all methods) - widest search, longest runtime', value: 'full_optimizer' },
        ],
      },
      {
        type: 'list',
        name: 'mode',
        message: 'Victory mode scope',
        default: prefill.mode ?? 'liberation',
        choices: [
          { name: 'liberation', value: 'liberation' },
          { name: 'symbolic', value: 'symbolic' },
          { name: 'both', value: 'both' },
        ],
      },
      {
        type: 'list',
        name: 'significance',
        message: 'Statistical strictness (acceptance gate sensitivity)',
        default: prefill.significance ?? 'balanced',
        choices: [
          { name: 'strict - fewer false positives, slower acceptance', value: 'strict' },
          { name: 'balanced - recommended confidence gate', value: 'balanced' },
          { name: 'lenient - faster acceptance, higher regression risk', value: 'lenient' },
        ],
      },
    ]);

    const runtimeDefaults = RUNTIME_DEFAULTS[firstPass.runtime];

    const secondPass = await prompt<Omit<InteractiveConfigAnswers, 'scenarioId' | 'runtime' | 'mode' | 'significance'>>([
      {
        type: 'input',
        name: 'iterations',
        message: 'Max iterations (more iterations = broader search, longer runtime)',
        default: prefill.iterations ?? 10,
        filter: (value: unknown) => toPositiveInteger(String(value), 'iterations'),
      },
      {
        type: 'input',
        name: 'baselineRuns',
        message: 'Baseline runs per arm (higher = more accurate baseline metrics, slower)',
        default: prefill.baselineRuns ?? runtimeDefaults.baselineRuns,
        filter: (value: unknown) => toPositiveInteger(String(value), 'baselineRuns'),
      },
      {
        type: 'input',
        name: 'candidateRuns',
        message: 'Candidate runs per arm (higher = better candidate ranking accuracy, slower)',
        default: prefill.candidateRuns ?? runtimeDefaults.candidateRuns,
        filter: (value: unknown) => toPositiveInteger(String(value), 'candidateRuns'),
      },
      {
        type: 'input',
        name: 'candidates',
        message: 'Candidates per iteration (more exploration, more experiment time)',
        default: prefill.candidates ?? runtimeDefaults.candidates,
        filter: (value: unknown) => toPositiveInteger(String(value), 'candidates'),
      },
      {
        type: 'input',
        name: 'patience',
        message: 'No-improvement patience (higher = continue searching longer before stopping)',
        default: prefill.patience ?? 3,
        filter: (value: unknown) => toPositiveInteger(String(value), 'patience'),
      },
      {
        type: 'input',
        name: 'seed',
        message: 'Seed',
        default: prefill.seed ?? 42,
        filter: (value: unknown) => toPositiveInteger(String(value), 'seed') >>> 0,
      },
      {
        type: 'input',
        name: 'outDir',
        message: 'Output directory',
        default: prefill.outDir ?? DEFAULT_OUT_DIR,
        filter: (value: unknown) => resolve(String(value).trim() || DEFAULT_OUT_DIR),
      },
    ]);

    return {
      ...firstPass,
      ...secondPass,
    };
  };

  const interactiveAnswers = parsed.scenarioId ? null : await promptInteractiveConfig(parsed);

  // CLI flags remain authoritative when provided; interactive answers fill missing primary inputs.
  const args: CliArgs = {
    ...(interactiveAnswers ?? {}),
    ...parsed,
  };

  const runtime = args.runtime ?? 'balanced';
  const runtimeDefaults = RUNTIME_DEFAULTS[runtime];
  const mode = args.mode ?? 'liberation';
  const strategy = args.strategy ?? 'full_optimizer';
  const scenarioId = args.scenarioId ? validateScenarioId(args.scenarioId) : validateScenarioId(interactiveAnswers?.scenarioId ?? '');

  return {
    scenarioId,
    iterations: args.iterations ?? 10,
    baselineRuns: args.baselineRuns ?? runtimeDefaults.baselineRuns,
    candidateRuns: args.candidateRuns ?? runtimeDefaults.candidateRuns,
    candidates: args.candidates ?? runtimeDefaults.candidates,
    patience: args.patience ?? 3,
    seed: args.seed ?? 42,
    outDir: args.outDir ?? DEFAULT_OUT_DIR,
    runtime,
    significance: args.significance ?? 'balanced',
    strategy,
    mode,
    victoryModes: modeToVictoryModes(mode),
    playerCounts: [2, 3, 4],
    useBalanceSearchSeeding: true,
  };
}

export async function runCli(argv: string[]) {
  const config = await buildConfig(argv);
  console.log('🧠 Optimizer configuration resolved');
  console.log(JSON.stringify({
    scenarioId: config.scenarioId,
    iterations: config.iterations,
    baselineRuns: config.baselineRuns,
    candidateRuns: config.candidateRuns,
    candidates: config.candidates,
    patience: config.patience,
    seed: config.seed,
    runtime: config.runtime,
    significance: config.significance,
    mode: config.mode,
    strategy: config.strategy,
    outDir: config.outDir,
  }, null, 2));

  const report = await runScenarioOptimizer(config);
  console.log(JSON.stringify({
    scenarioId: report.scenarioId,
    outputDir: report.outputDir,
    stopReason: report.stopReason,
    iterationsCompleted: report.iterationsCompleted,
    acceptedPatches: report.acceptedPatches.length,
    finalScore: report.finalMetrics.score.score,
  }, null, 2));
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    const err = error as Error;
    console.error('❌ Scenario optimizer failed');
    console.error(err.message);
    process.exitCode = 1;
  }
}
