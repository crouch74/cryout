import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus } from 'node:os';
import { listRulesets } from '../../engine/index.ts';
import { runAllScenariosParallelDiagnostics, runScenarioOptimizer } from './engine.ts';
import { GA_DEFAULT_CONFIG } from './ga/types.ts';
import type {
  OptimizerConfig,
  OptimizerExecutionMode,
  OptimizerMode,
  OptimizerRuntimeProfile,
  OptimizerSearchMode,
  OptimizerSignificanceMode,
  OptimizerStrategyMode,
} from './types.ts';

interface CliArgs {
  help?: boolean;
  scenarioId?: string;
  iterations?: number;
  baselineRuns?: number;
  candidateRuns?: number;
  candidates?: number;
  patience?: number;
  seed?: number;
  parallelWorkers?: number;
  outDir?: string;
  executionMode?: OptimizerExecutionMode;
  mode?: OptimizerMode;
  runtime?: OptimizerRuntimeProfile;
  significance?: OptimizerSignificanceMode;
  strategy?: OptimizerStrategyMode;
  // GA flags
  searchMode?: OptimizerSearchMode;
  gaPopulation?: number;
  gaGenerations?: number;
  gaRuns?: number;
  gaTopCandidates?: number;
  gaMutationRate?: number;
  gaCrossoverRate?: number;
  gaElitism?: number;
}

interface InteractiveConfigAnswers {
  scenarioId: string;
  executionMode: OptimizerExecutionMode;
  runtime: OptimizerRuntimeProfile;
  mode: OptimizerMode;
  significance: OptimizerSignificanceMode;
  strategy: OptimizerStrategyMode;
  searchMode: OptimizerSearchMode;
  iterations: number;
  baselineRuns: number;
  candidateRuns: number;
  candidates: number;
  patience: number;
  seed: number;
  parallelWorkers: number;
  outDir: string;
}

interface InquirerPrompt {
  <T>(questions: unknown[]): Promise<T>;
}

const DEFAULT_OUT_DIR = resolve(process.cwd(), 'simulation_output/optimizer');
const ALL_SCENARIOS_SELECTION = '__all_scenarios_parallel__';

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

const STRATEGY_DESCRIPTIONS: Record<OptimizerStrategyMode, string> = {
  numeric_balancing: 'Prioritizes numeric pressure/threshold mutations (setup, pressure, victory, mandate numeric knobs).',
  victory_gating_exploration: 'Focuses on victory gate parameters (round/action/progress) to reduce structural early wins.',
  trajectory_discovery: 'Prioritizes trajectory-guided mutations based on sampled victory paths.',
  full_optimizer: 'Uses all candidate families (numeric, gating, trajectory, hill-climb, and random fallback).',
};

const SEARCH_MODE_DESCRIPTIONS: Record<OptimizerSearchMode, string> = {
  local: 'Existing hill-climbing optimizer only. No GA exploration.',
  evolutionary: 'Pure GA exploration: all candidates come from the evolutionary search. A/B validation still applies.',
  hybrid: 'GA exploration + existing hill-climb candidates merged into the A/B pool (recommended for thoroughness).',
};

const SIGNIFICANCE_DESCRIPTIONS: Record<OptimizerSignificanceMode, string> = {
  strict: 'High confidence requirements; fewer accepted patches, lower false-positive risk.',
  balanced: 'Default confidence thresholds; practical tradeoff of rigor and throughput.',
  lenient: 'Lower confidence thresholds; faster acceptance but higher regression risk.',
};

const MODE_DESCRIPTIONS: Record<OptimizerMode, string> = {
  liberation: 'Optimize only Liberation mode metrics and acceptance decisions.',
  symbolic: 'Optimize only Symbolic mode metrics and acceptance decisions.',
  both: 'Optimize across both modes in the same experiment definitions.',
};

const EXECUTION_MODE_DESCRIPTIONS: Record<OptimizerExecutionMode, string> = {
  single_scenario: 'Optimize one scenario using iterative candidate search.',
  all_scenarios_parallel: 'Optimize every scenario in parallel; each scenario runs its own multi-iteration candidate search.',
};

function buildManual() {
  const workersDefault = defaultParallelWorkers();
  const scenarioOptions = listRulesets()
    .map((ruleset) => `      ${ruleset.id}: ${ruleset.name}`)
    .sort((left, right) => left.localeCompare(right))
    .join('\n');
  return `Where the Stones Cry Out - Scenario Optimizer Manual

Usage:
  npm run optimize -- [options]
  npm run optimize-scenario -- [options]
  node --no-warnings src/simulation/optimizer/cli.ts [options]

Quick Help:
  --help, -h
    Show this manual and exit.

Input Parameters:

  --scenario <id>
    Name: Scenario Identifier
    Functionality: Selects the scenario ruleset to optimize.
    Implementation: Validated against engine rulesets from listRulesets(); unknown IDs fail fast.
    Impact: Controls all baseline/treatment simulations, available factions/actions, and scenario-local patch behavior.
    Options:
${scenarioOptions}

  --iterations <n>
    Name: Iteration Budget
    Functionality: Maximum optimization rounds.
    Implementation: Positive integer; default 10.
    Impact: Higher values broaden search depth and increase total experiment runtime.

  --baseline-runs <n>
    Name: Baseline Arm Runs
    Functionality: Number of simulations for the baseline arm each iteration.
    Implementation: Positive integer; default depends on --runtime.
    Impact: Higher values stabilize baseline metrics/diagnostics but cost more CPU time.

  --candidate-runs <n>
    Name: Candidate Arm Runs
    Functionality: Number of simulations per candidate experiment arm.
    Implementation: Positive integer; default depends on --runtime.
    Impact: Higher values improve candidate ranking confidence and gate reliability.

  --candidates <n>
    Name: Candidate Count Per Iteration
    Functionality: Number of patches generated and evaluated per iteration.
    Implementation: Positive integer; default depends on --runtime.
    Impact: Larger search breadth per iteration with proportional experiment cost.

  --patience <n>
    Name: No-Improvement Patience
    Functionality: Stop condition after N iterations with no accepted improvement.
    Implementation: Positive integer; default 3.
    Impact: Higher values search longer before termination.

  --seed <n>
    Name: RNG Seed
    Functionality: Deterministic seed for optimizer-level randomization.
    Implementation: Positive integer coerced to uint32; default 42.
    Impact: Reproducibility of candidate generation, run planning, and trajectory sampling order.

  --parallel-workers <n>
    Name: Worker Parallelism
    Functionality: Number of worker threads for experiment execution.
    Implementation: Positive integer; default ${workersDefault} (CPU cores - 1, min 1).
    Impact: Higher throughput with increased CPU pressure and log concurrency.

  --out <path>
    Name: Output Directory
    Functionality: Root directory for optimizer artifacts.
    Implementation: Resolved to absolute path; default ${DEFAULT_OUT_DIR}.
    Impact: Determines where iteration summaries, patch history, and final report are written.

  --optimizer-mode <single_scenario|all_scenarios_parallel>
    Name: Optimizer Execution Mode
    Functionality: Selects single-scenario optimization or all-scenarios parallel optimization.
    Implementation:
      single_scenario: ${EXECUTION_MODE_DESCRIPTIONS.single_scenario}
      all_scenarios_parallel: ${EXECUTION_MODE_DESCRIPTIONS.all_scenarios_parallel}
    Impact: all_scenarios_parallel runs iterative optimization per scenario concurrently using a shared worker budget.

  --mode <liberation|symbolic|both>
    Name: Victory Mode Scope
    Functionality: Chooses which victory mode(s) are optimized.
    Implementation: Mapped to victoryModes array via modeToVictoryModes().
      liberation: ${MODE_DESCRIPTIONS.liberation}
      symbolic: ${MODE_DESCRIPTIONS.symbolic}
      both: ${MODE_DESCRIPTIONS.both}
    Impact: Influences experiment definitions, metrics, and accepted patch behavior across modes.

  --runtime <fast|balanced|thorough>
    Name: Runtime Profile
    Functionality: Applies default run budgets when run-count flags are omitted.
    Implementation: Uses RUNTIME_DEFAULTS:
      fast: baseline=3000, candidate=1500, candidates=8
      balanced: baseline=10000, candidate=5000, candidates=15
      thorough: baseline=30000, candidate=15000, candidates=24
    Impact: Primary throughput vs. statistical stability tradeoff.

  --significance <strict|balanced|lenient>
    Name: Statistical Acceptance Strictness
    Functionality: Selects optimizer gate thresholds used for candidate acceptance.
    Implementation: Passed into optimizer engine; mapped to confidence/alpha/lift guardrails.
      strict: ${SIGNIFICANCE_DESCRIPTIONS.strict}
      balanced: ${SIGNIFICANCE_DESCRIPTIONS.balanced}
      lenient: ${SIGNIFICANCE_DESCRIPTIONS.lenient}
    Impact: Controls how hard it is for a patch to be accepted.

  --strategy <numeric_balancing|victory_gating_exploration|trajectory_discovery|full_optimizer>
    Name: Candidate Strategy Mode
    Functionality: Chooses which candidate generators are active.
    Implementation:
      numeric_balancing: ${STRATEGY_DESCRIPTIONS.numeric_balancing}
      victory_gating_exploration: ${STRATEGY_DESCRIPTIONS.victory_gating_exploration}
      trajectory_discovery: ${STRATEGY_DESCRIPTIONS.trajectory_discovery}
      full_optimizer: ${STRATEGY_DESCRIPTIONS.full_optimizer}
    Impact: Changes the search space and shape of proposed rule patches.

GA Evolutionary Search Parameters:

  --search-mode <local|evolutionary|hybrid>
    Name: Search Mode
    Functionality: Controls whether GA evolutionary exploration is active.
    Implementation:
      local: ${SEARCH_MODE_DESCRIPTIONS.local}
      evolutionary: ${SEARCH_MODE_DESCRIPTIONS.evolutionary}
      hybrid: ${SEARCH_MODE_DESCRIPTIONS.hybrid}
    Impact: Enables GA-driven exploration on top of (or replacing) existing hill-climb candidates.
    Default: local

  --population <n>
    Name: GA Population Size
    Functionality: Number of candidate individuals in each GA generation.
    Implementation: Positive integer; default ${GA_DEFAULT_CONFIG.populationSize}.
    Impact: More individuals = wider search per generation, proportionally more simulation time.

  --generations <n>
    Name: GA Generations
    Functionality: Number of evolutionary generations to run.
    Implementation: Positive integer; default ${GA_DEFAULT_CONFIG.generations}.
    Impact: More generations = deeper refinement, longer GA search phase.

  --ga-runs <n>
    Name: Runs Per Individual
    Functionality: Simulation runs used to score each GA individual.
    Implementation: Positive integer; default ${GA_DEFAULT_CONFIG.runsPerIndividual}. Fewer than A/B runs to keep GA phase tractable.
    Impact: Higher values improve individual fitness estimates but increase GA runtime.

  --top-candidates <n>
    Name: GA Top Candidates Promoted
    Functionality: How many top GA individuals are promoted to the A/B validation pool.
    Implementation: Positive integer; default ${GA_DEFAULT_CONFIG.topCandidates}.
    Impact: More promotions = more A/B experiments per iteration when GA is active.

  --mutation-rate <f>
    Name: GA Mutation Rate
    Functionality: Per-gene probability of mutation in each evolved individual.
    Implementation: Float 0–1; default ${GA_DEFAULT_CONFIG.mutationRate}.
    Impact: Higher values increase exploration; lower values increase exploitation.

  --crossover-rate <f>
    Name: GA Crossover Rate
    Functionality: Probability that two parents produce a crossover child (vs. clone).
    Implementation: Float 0–1; default ${GA_DEFAULT_CONFIG.crossoverRate}.
    Impact: Controls how much genetic mixing occurs per generation.

  --elitism <n>
    Name: GA Elitism Count
    Functionality: Number of top individuals copied unchanged into the next generation.
    Implementation: Positive integer; default ${GA_DEFAULT_CONFIG.elitism}.
    Impact: Preserves best solutions across generations; too high reduces diversity.

Derived/Fixed Inputs (Not CLI Flags):

  victoryModes
    Derived from --mode; liberation => [liberation], symbolic => [symbolic], both => [liberation, symbolic].
  playerCounts
    Fixed to [2, 3, 4] by CLI buildConfig().
  useBalanceSearchSeeding
    Fixed true in CLI output; enables periodic seeding from balance search inside candidate generation.

Interactive Mode:
  If --scenario is omitted and TTY is available, the CLI prompts for scenario and all major inputs.
  The scenario selector includes "All scenarios (parallel optimization)".
  Any explicit CLI flag overrides prompted values.

Examples:
  npm run optimize -- --scenario tahrir_square --mode liberation --runtime balanced --strategy full_optimizer
  npm run optimize -- --scenario stones_cry_out --iterations 15 --baseline-runs 20000 --candidate-runs 8000 --candidates 20
  npm run optimize -- --scenario woman_life_freedom --mode both --significance strict --parallel-workers 8 --seed 2026
  npm run optimize -- --scenario tahrir_square --search-mode evolutionary --population 30 --generations 10 --ga-runs 1000
  npm run optimize -- --scenario tahrir_square --search-mode hybrid --population 20 --generations 6 --ga-runs 500
`;
}

export function renderHelpManual() {
  return buildManual();
}

function toPositiveInteger(value: string, label: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function defaultParallelWorkers() {
  return Math.max(1, cpus().length - 1);
}

function parseMode(raw: string): OptimizerMode {
  const value = raw.toLowerCase();
  if (value === 'liberation' || value === 'symbolic' || value === 'both') {
    return value;
  }
  throw new Error(`Unsupported --mode value "${raw}". Use liberation, symbolic, or both.`);
}

function parseExecutionMode(raw: string): OptimizerExecutionMode {
  const value = raw.toLowerCase();
  if (value === 'single_scenario' || value === 'all_scenarios_parallel') {
    return value;
  }
  throw new Error(`Unsupported --optimizer-mode value "${raw}". Use single_scenario or all_scenarios_parallel.`);
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

function parseSearchMode(raw: string): OptimizerSearchMode {
  const value = raw.toLowerCase();
  if (value === 'local' || value === 'evolutionary' || value === 'hybrid') {
    return value;
  }
  throw new Error(`Unsupported --search-mode value "${raw}". Use local, evolutionary, or hybrid.`);
}

function toFloat(value: string, label: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${label} must be a float between 0 and 1.`);
  }
  return parsed;
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

    if (!arg.startsWith('-')) {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
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
    if (arg === '--parallel-workers') {
      args.parallelWorkers = toPositiveInteger(readValue(), '--parallel-workers');
      continue;
    }
    if (arg === '--out') {
      args.outDir = resolve(readValue());
      continue;
    }
    if (arg === '--optimizer-mode') {
      args.executionMode = parseExecutionMode(readValue());
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
    if (arg === '--search-mode') {
      args.searchMode = parseSearchMode(readValue());
      continue;
    }
    if (arg === '--population') {
      args.gaPopulation = toPositiveInteger(readValue(), '--population');
      continue;
    }
    if (arg === '--generations') {
      args.gaGenerations = toPositiveInteger(readValue(), '--generations');
      continue;
    }
    if (arg === '--ga-runs') {
      args.gaRuns = toPositiveInteger(readValue(), '--ga-runs');
      continue;
    }
    if (arg === '--top-candidates') {
      args.gaTopCandidates = toPositiveInteger(readValue(), '--top-candidates');
      continue;
    }
    if (arg === '--mutation-rate') {
      args.gaMutationRate = toFloat(readValue(), '--mutation-rate');
      continue;
    }
    if (arg === '--crossover-rate') {
      args.gaCrossoverRate = toFloat(readValue(), '--crossover-rate');
      continue;
    }
    if (arg === '--elitism') {
      args.gaElitism = toPositiveInteger(readValue(), '--elitism');
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export async function buildConfig(argv: string[]): Promise<OptimizerConfig> {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    throw new Error('HelpRequested');
  }
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

    const firstPass = await prompt<{
      scenarioSelection: string;
      runtime: OptimizerRuntimeProfile;
      mode: OptimizerMode;
      significance: OptimizerSignificanceMode;
      strategy: OptimizerStrategyMode;
      searchMode: OptimizerSearchMode;
    }>([
      {
        type: 'list',
        name: 'scenarioSelection',
        message: 'Select scenario to optimize:',
        choices: [
          { name: 'All scenarios (parallel optimization)', value: ALL_SCENARIOS_SELECTION },
          ...scenarioIds.map((scenarioId) => ({ name: scenarioId, value: scenarioId })),
        ],
        default: prefill.executionMode === 'all_scenarios_parallel'
          ? ALL_SCENARIOS_SELECTION
          : prefill.scenarioId,
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
      {
        type: 'list',
        name: 'searchMode',
        message: 'Search mode (controls GA evolutionary exploration)',
        default: prefill.searchMode ?? 'local',
        choices: [
          { name: 'local - existing hill-climb only (fastest)', value: 'local' },
          { name: 'hybrid - GA exploration + hill-climb candidates merged (recommended)', value: 'hybrid' },
          { name: 'evolutionary - pure GA candidates only', value: 'evolutionary' },
        ],
      },
    ]);

    const runtimeDefaults = RUNTIME_DEFAULTS[firstPass.runtime];

    const secondPass = await prompt<Pick<InteractiveConfigAnswers, 'iterations' | 'baselineRuns' | 'candidateRuns' | 'candidates' | 'patience' | 'seed' | 'parallelWorkers' | 'outDir'>>([
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
        name: 'parallelWorkers',
        message: 'Parallel workers (higher = faster experiments, higher CPU usage)',
        default: prefill.parallelWorkers ?? defaultParallelWorkers(),
        filter: (value: unknown) => toPositiveInteger(String(value), 'parallelWorkers'),
      },
      {
        type: 'input',
        name: 'outDir',
        message: 'Output directory',
        default: prefill.outDir ?? DEFAULT_OUT_DIR,
        filter: (value: unknown) => resolve(String(value).trim() || DEFAULT_OUT_DIR),
      },
    ]);

    const executionMode = firstPass.scenarioSelection === ALL_SCENARIOS_SELECTION
      ? 'all_scenarios_parallel'
      : 'single_scenario';
    const scenarioId = executionMode === 'all_scenarios_parallel'
      ? 'all_scenarios'
      : firstPass.scenarioSelection;

    return {
      scenarioId,
      executionMode,
      runtime: firstPass.runtime,
      mode: firstPass.mode,
      significance: firstPass.significance,
      strategy: firstPass.strategy,
      searchMode: firstPass.searchMode,
      ...secondPass,
    };
  };

  const executionMode = parsed.executionMode ?? 'single_scenario';
  const interactiveAnswers = parsed.scenarioId || executionMode === 'all_scenarios_parallel'
    ? null
    : await promptInteractiveConfig(parsed);

  // CLI flags remain authoritative when provided; interactive answers fill missing primary inputs.
  const args: CliArgs = {
    ...(interactiveAnswers ?? {}),
    ...parsed,
  };

  const runtime = args.runtime ?? 'balanced';
  const runtimeDefaults = RUNTIME_DEFAULTS[runtime];
  const mode = args.mode ?? 'liberation';
  const strategy = args.strategy ?? 'full_optimizer';
  const searchMode: OptimizerSearchMode = args.searchMode ?? interactiveAnswers?.searchMode ?? 'local';
  const executionModeResolved = args.executionMode ?? 'single_scenario';
  const scenarioId = executionModeResolved === 'all_scenarios_parallel'
    ? (args.scenarioId ?? interactiveAnswers?.scenarioId ?? 'all_scenarios')
    : args.scenarioId
      ? validateScenarioId(args.scenarioId)
      : validateScenarioId(interactiveAnswers?.scenarioId ?? '');

  const gaConfig = {
    ...GA_DEFAULT_CONFIG,
    ...(args.gaPopulation !== undefined ? { populationSize: args.gaPopulation } : {}),
    ...(args.gaGenerations !== undefined ? { generations: args.gaGenerations } : {}),
    ...(args.gaRuns !== undefined ? { runsPerIndividual: args.gaRuns } : {}),
    ...(args.gaTopCandidates !== undefined ? { topCandidates: args.gaTopCandidates } : {}),
    ...(args.gaMutationRate !== undefined ? { mutationRate: args.gaMutationRate } : {}),
    ...(args.gaCrossoverRate !== undefined ? { crossoverRate: args.gaCrossoverRate } : {}),
    ...(args.gaElitism !== undefined ? { elitism: args.gaElitism } : {}),
  };

  return {
    scenarioId,
    iterations: args.iterations ?? 10,
    baselineRuns: args.baselineRuns ?? runtimeDefaults.baselineRuns,
    candidateRuns: args.candidateRuns ?? runtimeDefaults.candidateRuns,
    candidates: args.candidates ?? runtimeDefaults.candidates,
    patience: args.patience ?? 3,
    seed: args.seed ?? 42,
    parallelWorkers: args.parallelWorkers ?? defaultParallelWorkers(),
    outDir: args.outDir ?? DEFAULT_OUT_DIR,
    executionMode: executionModeResolved,
    runtime,
    significance: args.significance ?? 'balanced',
    strategy,
    mode,
    victoryModes: modeToVictoryModes(mode),
    playerCounts: [2, 3, 4],
    useBalanceSearchSeeding: true,
    searchMode,
    gaConfig,
  };
}

export async function runCli(argv: string[]) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    console.log(renderHelpManual());
    return;
  }

  const config = await buildConfig(argv);
  console.log('🧠 Optimizer configuration resolved');
  console.log(JSON.stringify({
    scenarioId: config.scenarioId,
    executionMode: config.executionMode,
    iterations: config.iterations,
    baselineRuns: config.baselineRuns,
    candidateRuns: config.candidateRuns,
    candidates: config.candidates,
    patience: config.patience,
    seed: config.seed,
    parallelWorkers: config.parallelWorkers,
    runtime: config.runtime,
    significance: config.significance,
    mode: config.mode,
    strategy: config.strategy,
    outDir: config.outDir,
  }, null, 2));

  if (config.executionMode === 'all_scenarios_parallel') {
    const report = await runAllScenariosParallelDiagnostics(config);
    console.log(JSON.stringify({
      outputDir: report.outputDir,
      scenariosEvaluated: report.scenarios.length,
      failedScenarioCount: report.failedScenarios.length,
      iterations: report.iterations,
    }, null, 2));
    return;
  }

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
