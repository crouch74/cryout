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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function resolveScenarioId(cliScenarioId: string | undefined) {
  const scenarioIds = listRulesets().map((ruleset) => ruleset.id).sort((left, right) => left.localeCompare(right));

  if (cliScenarioId) {
    if (!scenarioIds.includes(cliScenarioId)) {
      throw new Error(`Unknown scenario "${cliScenarioId}". Available: ${scenarioIds.join(', ')}`);
    }
    return cliScenarioId;
  }

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
    throw new Error('No scenario specified and interactive prompt is unavailable (TTY required).');
  }

  const inquirer = (await import('inquirer')).default;
  const { scenarioId } = await inquirer.prompt<{ scenarioId: string }>([
    {
      type: 'list',
      name: 'scenarioId',
      message: 'Select scenario to optimize:',
      choices: scenarioIds,
    },
  ]);
  return scenarioId;
}

export async function buildConfig(argv: string[]): Promise<OptimizerConfig> {
  const args = parseArgs(argv);
  const runtime = args.runtime ?? 'balanced';
  const runtimeDefaults = RUNTIME_DEFAULTS[runtime];
  const mode = args.mode ?? 'liberation';

  const scenarioId = await resolveScenarioId(args.scenarioId);

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
