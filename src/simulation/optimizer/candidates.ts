import { join } from 'node:path';
import { balanceCandidateToPatch, runBalanceSearch } from '../balance/SearchEngine.ts';
import type { ScenarioPatch } from '../experiments/patchDsl.ts';
import type { TrajectorySummary } from '../trajectory/types.ts';
import { getRulesetDefinition } from '../../engine/index.ts';
import { logInfo, logWarn } from '../logging.ts';
import {
  buildMutationSpaceFromScenario,
  scenarioHasCatastrophicCap,
  validateScenarioPatch,
  type MutationDescriptor,
} from './ga/mutationSpace.ts';
import type {
  OptimizerAnalysis,
  OptimizerCandidate,
  OptimizerRuntimeProfile,
  OptimizerStrategyMode,
} from './types.ts';

interface CandidateGenerationInput {
  scenarioId: string;
  iteration: number;
  seed: number;
  targetCount: number;
  candidateRuns: number;
  runtime: OptimizerRuntimeProfile;
  strategyMode: OptimizerStrategyMode;
  analysis: OptimizerAnalysis;
  trajectorySummary: TrajectorySummary | null;
  hillClimbSourcePatch: ScenarioPatch | null;
  rejectedPatchKeys?: ReadonlySet<string>;
  balanceSeedOutputDir: string;
  useBalanceSearchSeeding: boolean;
}

interface PatchGenome {
  globalGazeDelta: number;
  northernWarMachineDelta: number;
  seededExtractionTotalDelta: number;
  crisisSpikeExtractionDelta: number;
  liberationThresholdDelta: number;
  relaxAllThresholdsBy: number;
  maxExtractionAddedPerRound: number | null;
  scoreThreshold: number;
  publicVictoryWeight: number;
  mandatesWeight: number;
  catastrophicCapEnabled: boolean;
  catastrophicCapValue: number;
}

type GenomeKey = keyof PatchGenome;

type GenomeFieldDescriptor = {
  path: string;
  type: 'number' | 'boolean' | 'nullableInt';
  min?: number;
  max?: number;
  defaultValue: number | boolean | null;
};

const GENOME_FIELDS: Record<GenomeKey, GenomeFieldDescriptor> = {
  globalGazeDelta: { path: 'setup.globalGazeDelta', type: 'number', min: -2, max: 3, defaultValue: 0 },
  northernWarMachineDelta: { path: 'setup.northernWarMachineDelta', type: 'number', min: -2, max: 2, defaultValue: 0 },
  seededExtractionTotalDelta: { path: 'setup.seededExtractionTotalDelta', type: 'number', min: -3, max: 3, defaultValue: 0 },
  crisisSpikeExtractionDelta: { path: 'pressure.crisisSpikeExtractionDelta', type: 'number', min: -2, max: 2, defaultValue: 0 },
  liberationThresholdDelta: { path: 'victory.liberationThresholdDelta', type: 'number', min: -2, max: 2, defaultValue: 0 },
  relaxAllThresholdsBy: { path: 'mandates.relaxAllThresholdsBy', type: 'number', min: -1, max: 3, defaultValue: 0 },
  maxExtractionAddedPerRound: { path: 'pressure.maxExtractionAddedPerRound', type: 'nullableInt', min: 1, max: 4, defaultValue: null },
  scoreThreshold: { path: 'victoryScoring.scoreThreshold', type: 'number', min: 65, max: 75, defaultValue: 70 },
  publicVictoryWeight: { path: 'victoryScoring.publicVictoryWeight', type: 'number', min: 30, max: 50, defaultValue: 45 },
  mandatesWeight: { path: 'victoryScoring.mandatesWeight', type: 'number', min: 40, max: 60, defaultValue: 55 },
  catastrophicCapEnabled: { path: 'victoryScoring.catastrophicCapEnabled', type: 'boolean', defaultValue: true },
  catastrophicCapValue: { path: 'victoryScoring.catastrophicCapValue', type: 'number', min: 60, max: 75, defaultValue: 69 },
} as const;

interface ScenarioMutationConfig {
  allowCatastrophicCap: boolean;
  mutationSpace: MutationDescriptor[];
  supportedPaths: Set<string>;
}

const SCENARIO_MUTATION_CONFIG_CACHE = new Map<string, ScenarioMutationConfig>();

function stableHash(value: string) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function mixSeed(seed: number, salt: number) {
  let mixed = (seed ^ salt ^ 0x9e3779b9) >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function createRng(seed: number) {
  let state = seed === 0 ? 0x6d2b79f5 : seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0;
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return (state ^ (state >>> 14)) >>> 0;
  };
}

function intInRange(rng: () => number, min: number, max: number) {
  if (max <= min) {
    return min;
  }
  return min + (rng() % (max - min + 1));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasMutationPath(config: ScenarioMutationConfig, path: string) {
  return config.supportedPaths.has(path);
}

function createScenarioMutationConfig(scenarioId: string): ScenarioMutationConfig {
  const cached = SCENARIO_MUTATION_CONFIG_CACHE.get(scenarioId);
  if (cached) {
    return cached;
  }
  const ruleset = getRulesetDefinition(scenarioId);
  if (!ruleset) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  const mutationSpace = buildMutationSpaceFromScenario(ruleset);
  const config = {
    allowCatastrophicCap: scenarioHasCatastrophicCap(ruleset),
    mutationSpace,
    supportedPaths: new Set(mutationSpace.map((entry) => entry.path)),
  };
  SCENARIO_MUTATION_CONFIG_CACHE.set(scenarioId, config);
  return config;
}

function toGenome(patch: ScenarioPatch | null, config: ScenarioMutationConfig): PatchGenome {
  const publicVictoryWeight = patch?.victoryScoring?.publicVictoryWeight ?? 45;
  const mandatesWeight = patch?.victoryScoring?.mandatesWeight ?? 55;
  const genome: PatchGenome = {
    globalGazeDelta: patch?.setup?.globalGazeDelta ?? 0,
    northernWarMachineDelta: patch?.setup?.northernWarMachineDelta ?? 0,
    seededExtractionTotalDelta: patch?.setup?.seededExtractionTotalDelta ?? 0,
    crisisSpikeExtractionDelta: hasMutationPath(config, 'pressure.crisisSpikeExtractionDelta')
      ? (patch?.pressure?.crisisSpikeExtractionDelta ?? 0)
      : 0,
    liberationThresholdDelta: patch?.victory?.liberationThresholdDelta ?? 0,
    relaxAllThresholdsBy: patch?.mandates?.relaxAllThresholdsBy ?? 0,
    maxExtractionAddedPerRound: hasMutationPath(config, 'pressure.maxExtractionAddedPerRound')
      ? (patch?.pressure?.maxExtractionAddedPerRound ?? null)
      : null,
    scoreThreshold: patch?.victoryScoring?.threshold ?? 70,
    publicVictoryWeight,
    mandatesWeight,
    catastrophicCapEnabled: config.allowCatastrophicCap
      ? (patch?.victoryScoring?.catastrophicCapEnabled ?? true)
      : true,
    catastrophicCapValue: config.allowCatastrophicCap
      ? (patch?.victoryScoring?.catastrophicCapValue ?? 69)
      : 69,
  };
  return genome;
}

function fromGenome(genome: PatchGenome, note: string, config: ScenarioMutationConfig): ScenarioPatch {
  const patch: ScenarioPatch = {
    note,
  };

  if (genome.globalGazeDelta !== 0 || genome.northernWarMachineDelta !== 0 || genome.seededExtractionTotalDelta !== 0) {
    patch.setup = {};
    if (genome.globalGazeDelta !== 0) {
      patch.setup.globalGazeDelta = genome.globalGazeDelta;
    }
    if (genome.northernWarMachineDelta !== 0) {
      patch.setup.northernWarMachineDelta = genome.northernWarMachineDelta;
    }
    if (genome.seededExtractionTotalDelta !== 0) {
      patch.setup.seededExtractionTotalDelta = genome.seededExtractionTotalDelta;
    }
  }

  if (
    (hasMutationPath(config, 'pressure.crisisSpikeExtractionDelta') && genome.crisisSpikeExtractionDelta !== 0)
    || (hasMutationPath(config, 'pressure.maxExtractionAddedPerRound') && genome.maxExtractionAddedPerRound !== null)
  ) {
    patch.pressure = {};
    if (hasMutationPath(config, 'pressure.crisisSpikeExtractionDelta') && genome.crisisSpikeExtractionDelta !== 0) {
      patch.pressure.crisisSpikeExtractionDelta = genome.crisisSpikeExtractionDelta;
    }
    if (hasMutationPath(config, 'pressure.maxExtractionAddedPerRound') && genome.maxExtractionAddedPerRound !== null) {
      patch.pressure.maxExtractionAddedPerRound = genome.maxExtractionAddedPerRound;
    }
  }

  if (genome.liberationThresholdDelta !== 0) {
    patch.victory = {
      liberationThresholdDelta: genome.liberationThresholdDelta,
    };
  }

  if (genome.relaxAllThresholdsBy !== 0) {
    patch.mandates = {
      relaxAllThresholdsBy: genome.relaxAllThresholdsBy,
    };
  }

  if (
    genome.scoreThreshold !== 70
    || genome.publicVictoryWeight !== 45
    || genome.mandatesWeight !== 55
    || (config.allowCatastrophicCap && genome.catastrophicCapEnabled !== true)
    || (config.allowCatastrophicCap && genome.catastrophicCapValue !== 69)
  ) {
    patch.victoryScoring = {
      mode: 'score',
      threshold: genome.scoreThreshold,
      publicVictoryWeight: genome.publicVictoryWeight,
      mandatesWeight: genome.mandatesWeight,
      mandateProgressMode: 'binary',
    };
    if (config.allowCatastrophicCap) {
      patch.victoryScoring.catastrophicCapEnabled = genome.catastrophicCapEnabled;
      patch.victoryScoring.catastrophicCapValue = genome.catastrophicCapValue;
    }
  }

  return normalizeScenarioPatch(patch);
}

function mutateGenome(base: PatchGenome, rng: () => number, config: ScenarioMutationConfig): PatchGenome {
  const next = { ...base };
  const mutableFields = config.mutationSpace
    .map((entry) => Object.entries(GENOME_FIELDS).find(([, field]) => field.path === entry.path))
    .filter((entry): entry is [GenomeKey, GenomeFieldDescriptor] => entry !== undefined);

  if (mutableFields.length === 0) {
    return next;
  }

  const [key, field] = mutableFields[rng() % mutableFields.length];
  if (field.type === 'number') {
    const descriptor = config.mutationSpace.find((entry) => entry.path === field.path);
    const min = descriptor?.min ?? field.min ?? 0;
    const max = descriptor?.max ?? field.max ?? 0;
    const step = key === 'publicVictoryWeight' || key === 'mandatesWeight'
      ? (rng() % 2 === 0 ? -5 : 5)
      : (rng() % 2 === 0 ? -1 : 1);
    next[key] = clamp(next[key] + step, min, max) as never;
  } else if (field.type === 'nullableInt') {
    const descriptor = config.mutationSpace.find((entry) => entry.path === field.path);
    const min = descriptor?.min ?? field.min ?? 1;
    const max = descriptor?.max ?? field.max ?? 4;
    if (next[key] === null) {
      next[key] = intInRange(rng, min, max) as never;
    } else if (rng() % 3 === 0) {
      next[key] = null as never;
    } else {
      next[key] = clamp((next[key] as number) + (rng() % 2 === 0 ? -1 : 1), min, max) as never;
    }
  } else if (field.type === 'boolean') {
    next[key] = (!next[key]) as never;
  }

  if (key === 'publicVictoryWeight') {
    next.mandatesWeight = 100 - next.publicVictoryWeight;
  } else if (key === 'mandatesWeight') {
    next.publicVictoryWeight = 100 - next.mandatesWeight;
  }

  if (hasMutationPath(config, 'pressure.maxExtractionAddedPerRound') && rng() % 5 === 0) {
    if (next.maxExtractionAddedPerRound === null) {
      next.maxExtractionAddedPerRound = intInRange(rng, 1, 4);
    } else if (rng() % 3 === 0) {
      next.maxExtractionAddedPerRound = null;
    } else {
      next.maxExtractionAddedPerRound = clamp(next.maxExtractionAddedPerRound + (rng() % 2 === 0 ? -1 : 1), 1, 4);
    }
  }

  if (config.allowCatastrophicCap && rng() % 7 === 0) {
    next.catastrophicCapEnabled = !next.catastrophicCapEnabled;
  }

  return next;
}

function randomGenome(rng: () => number, config: ScenarioMutationConfig): PatchGenome {
  const genome: PatchGenome = {
    globalGazeDelta: intInRange(rng, GENOME_FIELDS.globalGazeDelta.min ?? 0, GENOME_FIELDS.globalGazeDelta.max ?? 0),
    northernWarMachineDelta: intInRange(rng, GENOME_FIELDS.northernWarMachineDelta.min ?? 0, GENOME_FIELDS.northernWarMachineDelta.max ?? 0),
    seededExtractionTotalDelta: intInRange(rng, GENOME_FIELDS.seededExtractionTotalDelta.min ?? 0, GENOME_FIELDS.seededExtractionTotalDelta.max ?? 0),
    crisisSpikeExtractionDelta: hasMutationPath(config, 'pressure.crisisSpikeExtractionDelta')
      ? intInRange(rng, GENOME_FIELDS.crisisSpikeExtractionDelta.min ?? 0, GENOME_FIELDS.crisisSpikeExtractionDelta.max ?? 0)
      : 0,
    liberationThresholdDelta: intInRange(rng, GENOME_FIELDS.liberationThresholdDelta.min ?? 0, GENOME_FIELDS.liberationThresholdDelta.max ?? 0),
    relaxAllThresholdsBy: intInRange(rng, GENOME_FIELDS.relaxAllThresholdsBy.min ?? 0, GENOME_FIELDS.relaxAllThresholdsBy.max ?? 0),
    maxExtractionAddedPerRound: null,
    scoreThreshold: [65, 70, 75][rng() % 3],
    publicVictoryWeight: [30, 35, 40, 45, 50][rng() % 5],
    mandatesWeight: 55,
    catastrophicCapEnabled: config.allowCatastrophicCap ? rng() % 2 === 0 : true,
    catastrophicCapValue: config.allowCatastrophicCap ? [65, 69, 72][rng() % 3] : 69,
  };
  genome.mandatesWeight = 100 - genome.publicVictoryWeight;

  if (hasMutationPath(config, 'pressure.maxExtractionAddedPerRound') && rng() % 4 === 0) {
    genome.maxExtractionAddedPerRound = intInRange(rng, 1, 4);
  }
  return genome;
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalizedArray = value
      .map((entry) => normalizeValue(entry))
      .filter((entry) => entry !== undefined);
    return normalizedArray.length > 0 ? normalizedArray : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeValue(entry)] as const)
      .filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) {
      return undefined;
    }
    return Object.fromEntries(entries);
  }

  if (typeof value === 'number' && value === 0) {
    return undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  return value;
}

export function getScenarioPatchKey(patch: ScenarioPatch) {
  return JSON.stringify(normalizeValue(patch) ?? {});
}

function sanitizeCapPatch(patch: ScenarioPatch, allowCatastrophicCap: boolean): ScenarioPatch {
  if (allowCatastrophicCap || !patch.victoryScoring) {
    return patch;
  }
  const sanitized: ScenarioPatch = {
    ...patch,
    victoryScoring: {
      ...patch.victoryScoring,
    },
  };
  delete sanitized.victoryScoring?.catastrophicCapEnabled;
  delete sanitized.victoryScoring?.catastrophicCapValue;
  return normalizeScenarioPatch(sanitized);
}

export function normalizeScenarioPatch(patch: ScenarioPatch): ScenarioPatch {
  const normalized = normalizeValue(patch);
  return (normalized ?? {}) as ScenarioPatch;
}

export function isScenarioPatchEmpty(patch: ScenarioPatch) {
  const normalized = normalizeValue(patch);
  if (!normalized || typeof normalized !== 'object') {
    return true;
  }
  const entries = Object.entries(normalized as Record<string, unknown>)
    .filter(([key]) => key !== 'note');
  return entries.length === 0;
}

function buildParameterSweepCandidates(
  analysis: OptimizerAnalysis,
  config: ScenarioMutationConfig,
): ScenarioPatch[] {
  const candidates: ScenarioPatch[] = [];
  const canMutateCrisisSpike = hasMutationPath(config, 'pressure.crisisSpikeExtractionDelta');
  const canMutateExtractionCap = hasMutationPath(config, 'pressure.maxExtractionAddedPerRound');

  if (analysis.outOfRange.winRate) {
    candidates.push({
      note: '🧠 Sweep: ease opening pressure',
      setup: {
        globalGazeDelta: 1,
        northernWarMachineDelta: -1,
        seededExtractionTotalDelta: -1,
      },
      pressure: canMutateCrisisSpike
        ? {
          crisisSpikeExtractionDelta: -1,
        }
        : undefined,
    });
  }

  if (analysis.outOfRange.winRate) {
    for (const threshold of [65, 70, 75]) {
      candidates.push({
        note: `🧠 Sweep: scoring threshold=${threshold}`,
        victoryScoring: {
          mode: 'score',
          threshold,
          publicVictoryWeight: 45,
          mandatesWeight: 55,
        },
      });
      if (config.allowCatastrophicCap) {
        candidates[candidates.length - 1].victoryScoring = {
          ...candidates[candidates.length - 1].victoryScoring,
          catastrophicCapEnabled: true,
          catastrophicCapValue: 69,
        };
      }
    }
    for (const publicVictoryWeight of [30, 35, 40, 45, 50]) {
      candidates.push({
        note: `🧠 Sweep: score bucket public=${publicVictoryWeight} mandates=${100 - publicVictoryWeight}`,
        victoryScoring: {
          mode: 'score',
          threshold: 70,
          publicVictoryWeight,
          mandatesWeight: 100 - publicVictoryWeight,
        },
      });
      if (config.allowCatastrophicCap) {
        candidates[candidates.length - 1].victoryScoring = {
          ...candidates[candidates.length - 1].victoryScoring,
          catastrophicCapEnabled: true,
          catastrophicCapValue: 69,
        };
      }
    }
    if (config.allowCatastrophicCap) {
      candidates.push({
        note: '🧠 Sweep: disable catastrophic score cap',
        victoryScoring: {
          mode: 'score',
          threshold: 70,
          publicVictoryWeight: 45,
          mandatesWeight: 55,
          catastrophicCapEnabled: false,
        },
      });
    }
  }

  if ((analysis.topMandateFailures[0]?.failureRate ?? 0) >= 0.55) {
    candidates.push({
      note: '🧠 Sweep: soften mandate thresholds',
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    });
    candidates.push({
      note: '🧠 Sweep: strong mandate relief',
      mandates: {
        relaxAllThresholdsBy: 2,
      },
    });
  }

  if (analysis.outOfRange.avgRounds) {
    if (analysis.insights.some((line) => line.includes('short'))) {
      candidates.push({
        note: '🧠 Sweep: reduce collapse tempo',
        setup: {
          seededExtractionTotalDelta: -1,
          northernWarMachineDelta: -1,
        },
      });
    } else {
      candidates.push({
        note: '🧠 Sweep: accelerate resolution pacing',
        pressure: canMutateCrisisSpike
          ? {
            crisisSpikeExtractionDelta: 1,
          }
          : undefined,
        victory: {
          liberationThresholdDelta: 1,
        },
      });
    }
  }

  if (analysis.defeatPressure.pressureDetected) {
    const pressurePatch: ScenarioPatch['pressure'] = {};
    if (canMutateExtractionCap) {
      pressurePatch.maxExtractionAddedPerRound = 2;
    }
    if (canMutateCrisisSpike) {
      pressurePatch.crisisSpikeExtractionDelta = -1;
    }
    candidates.push({
      note: '🧠 Sweep: cap per-round extraction spikes',
      pressure: Object.keys(pressurePatch).length > 0 ? pressurePatch : undefined,
    });
  }

  return candidates.map((patch) => normalizeScenarioPatch(patch));
}

function buildTrajectoryGuidedPatch(summary: TrajectorySummary | null, analysis: OptimizerAnalysis): ScenarioPatch | null {
  if (!summary || summary.totalTrajectories === 0) {
    return null;
  }

  const patch: ScenarioPatch = {
    note: '🧭 Trajectory-guided mutation',
  };

  if (summary.averageExtractionRemovedBeforeVictory < 1.5 && analysis.outOfRange.winRate) {
    patch.setup = {
      ...(patch.setup ?? {}),
      seededExtractionTotalDelta: -1,
    };
  }

  if (summary.averageTurnsToVictory > 8.5 && analysis.outOfRange.avgRounds) {
    patch.victory = {
      ...(patch.victory ?? {}),
      liberationThresholdDelta: 1,
    };
  }

  if (summary.averageTurnsToVictory < 6.0 && analysis.outOfRange.avgRounds) {
    patch.setup = {
      ...(patch.setup ?? {}),
      globalGazeDelta: 1,
      northernWarMachineDelta: -1,
    };
  }

  if ((analysis.topMandateFailures[0]?.failureRate ?? 0) >= 0.55
    && summary.mostCommonFirstAction?.action.toLowerCase().includes('investigate')) {
    patch.mandates = {
      ...(patch.mandates ?? {}),
      relaxAllThresholdsBy: 1,
    };
  }

  const normalized = normalizeScenarioPatch(patch);
  return isScenarioPatchEmpty(normalized) ? null : normalized;
}

function runtimeSeedIterations(runtime: OptimizerRuntimeProfile) {
  if (runtime === 'fast') {
    return 2;
  }
  if (runtime === 'thorough') {
    return 6;
  }
  return 4;
}

function includeNumericStrategies(mode: OptimizerStrategyMode) {
  return mode === 'numeric_balancing' || mode === 'full_optimizer';
}

function includeTrajectoryStrategies(mode: OptimizerStrategyMode) {
  return mode === 'trajectory_discovery' || mode === 'full_optimizer';
}

function includeActionDiversityStrategies(mode: OptimizerStrategyMode) {
  return mode === 'action_diversity' || mode === 'full_optimizer';
}

function includeVictoryGateStrategies(mode: OptimizerStrategyMode, analysis: OptimizerAnalysis) {
  if (mode === 'victory_gating_exploration' || mode === 'full_optimizer') {
    return true;
  }
  // If structural alarms are active, always allow victory gating candidates.
  return analysis.structural.noGameplayDetected
    || analysis.structural.turnOnePublicVictoryRate > 0.05
    || analysis.structural.earlyTerminationRate > 0.05
    || analysis.structural.victoryBeforeAllowedRoundRate > 0;
}

function buildVictoryGatingCandidates(mode: OptimizerStrategyMode, analysis: OptimizerAnalysis): OptimizerCandidate[] {
  if (!includeVictoryGateStrategies(mode, analysis)) {
    return [];
  }

  const patches: Array<Omit<OptimizerCandidate, 'candidateId'>> = [];

  for (const minRoundBeforeVictory of [2, 3, 4]) {
    patches.push({
      strategy: 'victory_gating_round',
      patch: normalizeScenarioPatch({
        note: `🧠 Victory gate round >= ${minRoundBeforeVictory}`,
        victoryGate: { minRoundBeforeVictory },
      }),
    });
  }

  for (const actionId of ['launch_liberation_campaign', 'global_media_push', 'coalition_strike']) {
    patches.push({
      strategy: 'victory_gating_action',
      patch: normalizeScenarioPatch({
        note: `🧠 Victory gate action=${actionId}`,
        victoryGate: { requiredAction: { actionId } },
      }),
    });
  }

  for (const extractionRemoved of [2, 3, 4]) {
    patches.push({
      strategy: 'victory_gating_progress',
      patch: normalizeScenarioPatch({
        note: `🧠 Victory gate extraction_removed >= ${extractionRemoved}`,
        victoryGate: { requiredProgress: { extractionRemoved } },
      }),
    });
    for (const minRoundBeforeVictory of [2, 3, 4]) {
      patches.push({
        strategy: 'victory_gating_progress',
        patch: normalizeScenarioPatch({
          note: `🧠 Victory gate combo round>=${minRoundBeforeVictory} extraction_removed>=${extractionRemoved}`,
          victoryGate: {
            minRoundBeforeVictory,
            requiredProgress: { extractionRemoved },
          },
        }),
      });
    }
  }

  return patches.map((entry, index) => ({
    candidateId: `gate_seed_${String(index + 1).padStart(3, '0')}`,
    strategy: entry.strategy,
    patch: entry.patch,
  }));
}

function buildActionDiversityCandidates(
  scenarioId: string,
  analysis: OptimizerAnalysis,
  trajectorySummary: TrajectorySummary | null,
): ScenarioPatch[] {
  const candidates: ScenarioPatch[] = [];
  const pressureDetected = analysis.defeatPressure.pressureDetected || analysis.structural.earlyTerminationRate > 0.05;
  const heavyMandateFailure = (analysis.topMandateFailures[0]?.failureRate ?? 0) >= 0.45;
  const investigateOpening = trajectorySummary?.mostCommonFirstAction?.action?.toLowerCase().includes('investigate') ?? false;
  const launchSpamDetected = (trajectorySummary?.mostCommonFirstAction?.action?.toLowerCase().includes('launch') ?? false)
    || analysis.insights.some((line) => line.toLowerCase().includes('collapse'));

  const scenarioPresetById: Partial<Record<string, ScenarioPatch>> = {
    algerian_war_of_independence: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: Algeria',
      simulator: {
        actionBias: {
          build_solidarity: 6,
          defend: 6,
          international_outreach: 8,
          investigate: -4,
          launch_campaign: -3,
          smuggle_evidence: 8,
        },
        actionCountPenalty: {
          investigate: -2,
          launch_campaign: -1,
        },
        evidenceScarcitySmuggleBonus: 10,
        firstUseTargetedActionBonus: 12,
        highPressureDefendBonus: 12,
        launchCampaignWithSetupBonus: 8,
        launchCampaignWithoutSetupPenalty: 10,
        lowGazeOutreachBonus: 12,
        preparedCampaignDiversityBonus: 10,
        repeatActionPenaltyPerUse: 2,
        repeatActionPenaltyStartsAfter: 2,
      },
    }),
    egypt_1919_revolution: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: Egypt',
      simulator: {
        actionBias: {
          build_solidarity: 4,
          defend: 6,
          international_outreach: 4,
          investigate: -2,
          launch_campaign: -1,
          smuggle_evidence: 4,
        },
        firstUseTargetedActionBonus: 8,
        launchCampaignWithSetupBonus: 6,
        launchCampaignWithoutSetupPenalty: 6,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 3,
      },
    }),
    tahrir_square: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: Tahrir',
      simulator: {
        actionBias: {
          build_solidarity: 4,
          defend: 8,
          investigate: -3,
          launch_campaign: -2,
        },
        actionCountPenalty: {
          investigate: -2,
        },
        firstUseTargetedActionBonus: 10,
        highPressureDefendBonus: 12,
        launchCampaignWithoutSetupPenalty: 8,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 3,
      },
    }),
    when_the_corridors_burn: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: Corridors',
      simulator: {
        actionBias: {
          build_solidarity: 2,
          defend: 3,
          investigate: -1,
          launch_campaign: -1,
        },
        launchCampaignWithoutSetupPenalty: 4,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 4,
      },
    }),
    stones_cry_out: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: Stones',
      simulator: {
        actionBias: {
          build_solidarity: 4,
          defend: 4,
          international_outreach: 4,
          investigate: -2,
          launch_campaign: -1,
          smuggle_evidence: 4,
        },
        firstUseTargetedActionBonus: 8,
        launchCampaignWithoutSetupPenalty: 6,
        preparedCampaignDiversityBonus: 6,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 3,
      },
    }),
    woman_life_freedom: normalizeScenarioPatch({
      note: '🧭 Scenario action-diversity preset: WLF',
      simulator: {
        actionBias: {
          build_solidarity: 2,
          defend: 2,
          international_outreach: 6,
          investigate: -1,
          launch_campaign: -1,
          smuggle_evidence: 6,
        },
        evidenceScarcitySmuggleBonus: 10,
        firstUseTargetedActionBonus: 6,
        launchCampaignWithoutSetupPenalty: 4,
        lowGazeOutreachBonus: 10,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 4,
      },
    }),
  };

  const scenarioPreset = scenarioPresetById[scenarioId];
  if (scenarioPreset) {
    candidates.push(scenarioPreset);
  }

  candidates.push(normalizeScenarioPatch({
    note: '🧭 Action-diversity seed: prepared campaigns over raw campaign spam',
    simulator: {
      actionBias: {
        build_solidarity: 6,
        investigate: investigateOpening ? -5 : -3,
        international_outreach: 6,
        smuggle_evidence: 6,
        ...(pressureDetected ? { defend: 6 } : {}),
        ...(launchSpamDetected ? { launch_campaign: -4 } : {}),
      },
      actionCountPenalty: {
        investigate: -2,
        ...(launchSpamDetected ? { launch_campaign: -1 } : {}),
      },
      firstUseTargetedActionBonus: 10,
      launchCampaignWithoutSetupPenalty: 12,
      launchCampaignWithSetupBonus: 8,
      preparedCampaignDiversityBonus: 8,
      repeatActionPenaltyPerUse: 2,
      repeatActionPenaltyStartsAfter: 2,
    },
  }));

  candidates.push(normalizeScenarioPatch({
    note: '🧭 Action-diversity seed: S2-style setup gating',
    simulator: {
      actionBias: {
        build_solidarity: 6,
        international_outreach: 6,
        smuggle_evidence: 6,
        investigate: -4,
        ...(launchSpamDetected ? { launch_campaign: -3 } : {}),
      },
      actionCountPenalty: {
        investigate: -2,
        launch_campaign: -1,
      },
      firstUseTargetedActionBonus: 12,
      launchCampaignWithoutSetupPenalty: 14,
      launchCampaignWithSetupBonus: 8,
      preparedCampaignDiversityBonus: 10,
      repeatActionPenaltyPerUse: 2,
      repeatActionPenaltyStartsAfter: 2,
      ...(analysis.structural.earlyTerminationRate > 0.05 ? { highPressureDefendBonus: 8 } : {}),
    },
  }));

  if (heavyMandateFailure || investigateOpening) {
    candidates.push(normalizeScenarioPatch({
      note: '🧭 Action-diversity seed: S4-style outreach and evidence preparation',
      simulator: {
        actionBias: {
          build_solidarity: 6,
          defend: pressureDetected ? 6 : 4,
          investigate: -5,
          ...(launchSpamDetected ? { launch_campaign: -4 } : {}),
          international_outreach: 8,
          smuggle_evidence: 8,
        },
        actionCountPenalty: {
          investigate: -3,
          launch_campaign: -1,
        },
        firstUseTargetedActionBonus: 12,
        lowGazeOutreachBonus: 12,
        evidenceScarcitySmuggleBonus: 12,
        launchCampaignWithoutSetupPenalty: 10,
        preparedCampaignDiversityBonus: 8,
        repeatActionPenaltyPerUse: 2,
        repeatActionPenaltyStartsAfter: 2,
      },
    }));
  }

  if (pressureDetected) {
    candidates.push(normalizeScenarioPatch({
      note: '🧭 Action-diversity seed: defend stressed fronts before collapse',
      simulator: {
        actionBias: {
          build_solidarity: 4,
          defend: 8,
          investigate: -3,
          ...(launchSpamDetected ? { launch_campaign: -2 } : {}),
        },
        actionCountPenalty: {
          investigate: -2,
        },
        firstUseTargetedActionBonus: 10,
        highPressureDefendBonus: 12,
        launchCampaignWithoutSetupPenalty: 8,
        repeatActionPenaltyPerUse: 1,
        repeatActionPenaltyStartsAfter: 3,
      },
    }));
  }

  candidates.push(normalizeScenarioPatch({
    note: '🧭 Action-diversity seed: moderate combined simulator rebalance',
    simulator: {
      actionBias: {
        build_solidarity: 6,
        defend: pressureDetected ? 6 : 4,
        investigate: -4,
        international_outreach: 8,
        smuggle_evidence: 8,
        ...(launchSpamDetected ? { launch_campaign: -3 } : {}),
      },
      actionCountPenalty: {
        investigate: -2,
        launch_campaign: -1,
      },
      firstUseTargetedActionBonus: 12,
      launchCampaignWithoutSetupPenalty: 10,
      launchCampaignWithSetupBonus: 8,
      ...(pressureDetected ? { highPressureDefendBonus: 12 } : {}),
      lowGazeOutreachBonus: 12,
      evidenceScarcitySmuggleBonus: 10,
      preparedCampaignDiversityBonus: 10,
      repeatActionPenaltyPerUse: 2,
      repeatActionPenaltyStartsAfter: 2,
    },
  }));

  return candidates;
}

function buildRandomActionDiversityPatch(rng: () => number, analysis: OptimizerAnalysis): ScenarioPatch {
  const pressureDetected = analysis.defeatPressure.pressureDetected || analysis.structural.earlyTerminationRate > 0.05;
  const pick = (values: number[]) => values[rng() % values.length] ?? values[0] ?? 0;

  return normalizeScenarioPatch({
    note: '🎲 Action-diversity simulator mutation',
    simulator: {
      actionBias: {
        build_solidarity: pick([4, 6, 8, 10]),
        investigate: pick([-6, -5, -4, -3, -2]),
        international_outreach: pick([4, 6, 8, 10]),
        launch_campaign: pick([-5, -4, -3, -2, 0]),
        smuggle_evidence: pick([4, 6, 8, 10]),
        ...(pressureDetected ? { defend: pick([6, 8, 10, 12]) } : { defend: pick([2, 4, 6]) }),
      },
      actionCountPenalty: {
        investigate: pick([-3, -2, -2, -1]),
        launch_campaign: pick([-2, -1, -1, 0]),
      },
      firstUseTargetedActionBonus: pick([8, 10, 12, 14]),
      launchCampaignWithoutSetupPenalty: pick([8, 10, 12, 14]),
      launchCampaignWithSetupBonus: pick([4, 6, 8, 10]),
      ...(pressureDetected ? { highPressureDefendBonus: pick([10, 12, 14, 16]) } : {}),
      evidenceScarcitySmuggleBonus: pick([0, 8, 10, 12, 14]),
      lowGazeOutreachBonus: pick([0, 8, 10, 12, 14]),
      preparedCampaignDiversityBonus: pick([0, 6, 8, 10, 12]),
      repeatActionPenaltyPerUse: pick([1, 2, 2, 3]),
      repeatActionPenaltyStartsAfter: pick([1, 2, 2, 3]),
    },
  });
}

export async function generateCandidatePatches(input: CandidateGenerationInput): Promise<OptimizerCandidate[]> {
  const rng = createRng(mixSeed(input.seed, stableHash(`optimizer-candidates:${input.iteration}`)));
  const mutationConfig = createScenarioMutationConfig(input.scenarioId);
  const dedup = new Map<string, Omit<OptimizerCandidate, 'candidateId'>>();

  const addCandidate = (strategy: OptimizerCandidate['strategy'], patch: ScenarioPatch) => {
    const normalized = sanitizeCapPatch(normalizeScenarioPatch(patch), mutationConfig.allowCatastrophicCap);
    if (isScenarioPatchEmpty(normalized)) {
      return;
    }
    const ruleset = getRulesetDefinition(input.scenarioId);
    if (!ruleset || !validateScenarioPatch(normalized, ruleset)) {
      return;
    }
    const key = getScenarioPatchKey(normalized);
    if (input.rejectedPatchKeys?.has(key)) {
      return;
    }
    if (dedup.has(key)) {
      return;
    }
    dedup.set(key, {
      strategy,
      patch: normalized,
    });
  };

  if (includeNumericStrategies(input.strategyMode)) {
    for (const patch of buildParameterSweepCandidates(input.analysis, mutationConfig)) {
      addCandidate('parameter_sweep', patch);
    }
  }

  if (includeTrajectoryStrategies(input.strategyMode)) {
    const trajectoryPatch = buildTrajectoryGuidedPatch(input.trajectorySummary, input.analysis);
    if (trajectoryPatch) {
      addCandidate('trajectory_guided', trajectoryPatch);
    }
  }

  if (includeActionDiversityStrategies(input.strategyMode)) {
    for (const patch of buildActionDiversityCandidates(input.scenarioId, input.analysis, input.trajectorySummary)) {
      addCandidate('action_diversity_seed', patch);
    }
  }

  for (const entry of buildVictoryGatingCandidates(input.strategyMode, input.analysis)) {
    addCandidate(entry.strategy, entry.patch);
  }

  if (input.hillClimbSourcePatch && includeNumericStrategies(input.strategyMode)) {
    const hillSource = toGenome(input.hillClimbSourcePatch, mutationConfig);
    for (let index = 0; index < 4; index += 1) {
      const mutated = mutateGenome(hillSource, rng, mutationConfig);
      addCandidate('hill_climb', fromGenome(mutated, '🧠 Hill-climb mutation', mutationConfig));
    }
  }

  if (input.useBalanceSearchSeeding && includeNumericStrategies(input.strategyMode) && input.iteration % 3 === 0) {
    try {
      logInfo('🧪 Seeding candidates from balance search module');
      const result = await runBalanceSearch({
        scenarioId: input.scenarioId,
        iterations: runtimeSeedIterations(input.runtime),
        runsPerCandidate: Math.max(250, Math.floor(input.candidateRuns / 4)),
        seed: mixSeed(input.seed, stableHash(`optimizer-balance-seed:${input.iteration}`)),
        topN: Math.max(2, Math.floor(input.targetCount / 3)),
        outputDir: join(input.balanceSeedOutputDir, `iteration_${String(input.iteration).padStart(2, '0')}`),
      });

      for (const seeded of result.bestCandidates) {
        addCandidate('balance_seed', balanceCandidateToPatch(seeded.parameters));
      }
    } catch (error) {
      const err = error as Error;
      logWarn(`⚠️ Balance seed generation skipped: ${err.message}`);
    }
  }

  while (dedup.size < input.targetCount) {
    if (input.strategyMode === 'action_diversity') {
      addCandidate('action_diversity_seed', buildRandomActionDiversityPatch(rng, input.analysis));
      continue;
    }

    if (input.strategyMode === 'victory_gating_exploration') {
      const roundGate = [2, 3, 4][rng() % 3];
      const progressGate = [2, 3, 4][rng() % 3];
      addCandidate('victory_gating_progress', {
        note: '🎲 Victory-gating exploration mutation',
        victoryGate: {
          minRoundBeforeVictory: roundGate,
          requiredProgress: { extractionRemoved: progressGate },
        },
      });
      continue;
    }

    if (includeVictoryGateStrategies(input.strategyMode, input.analysis) && rng() % 3 === 0) {
      const roundGate = [2, 3, 4][rng() % 3];
      const progressGate = [2, 3, 4][rng() % 3];
      addCandidate('victory_gating_progress', {
        note: '🎲 Random victory-gating mutation',
        victoryGate: {
          minRoundBeforeVictory: roundGate,
          requiredProgress: { extractionRemoved: progressGate },
        },
      });
      continue;
    }

    const patch = fromGenome(randomGenome(rng, mutationConfig), '🎲 Randomized mutation', mutationConfig);
    addCandidate('random', patch);
  }

  const candidates = Array.from(dedup.values())
    .slice(0, input.targetCount)
    .map((candidate, index) => ({
      candidateId: `candidate_${String(index + 1).padStart(3, '0')}`,
      strategy: candidate.strategy,
      patch: candidate.patch,
    }));

  return candidates;
}
