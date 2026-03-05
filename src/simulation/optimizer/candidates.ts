import { join } from 'node:path';
import { balanceCandidateToPatch, runBalanceSearch } from '../balance/SearchEngine.ts';
import type { ScenarioPatch } from '../experiments/patchDsl.ts';
import type { TrajectorySummary } from '../trajectory/types.ts';
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
}

const GENOME_LIMITS = {
  globalGazeDelta: { min: -2, max: 3 },
  northernWarMachineDelta: { min: -2, max: 2 },
  seededExtractionTotalDelta: { min: -3, max: 3 },
  crisisSpikeExtractionDelta: { min: -2, max: 2 },
  liberationThresholdDelta: { min: -2, max: 2 },
  relaxAllThresholdsBy: { min: -1, max: 3 },
} as const;

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

function toGenome(patch: ScenarioPatch | null): PatchGenome {
  return {
    globalGazeDelta: patch?.setup?.globalGazeDelta ?? 0,
    northernWarMachineDelta: patch?.setup?.northernWarMachineDelta ?? 0,
    seededExtractionTotalDelta: patch?.setup?.seededExtractionTotalDelta ?? 0,
    crisisSpikeExtractionDelta: patch?.pressure?.crisisSpikeExtractionDelta ?? 0,
    liberationThresholdDelta: patch?.victory?.liberationThresholdDelta ?? 0,
    relaxAllThresholdsBy: patch?.mandates?.relaxAllThresholdsBy ?? 0,
    maxExtractionAddedPerRound: patch?.pressure?.maxExtractionAddedPerRound ?? null,
  };
}

function fromGenome(genome: PatchGenome, note: string): ScenarioPatch {
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

  if (genome.crisisSpikeExtractionDelta !== 0 || genome.maxExtractionAddedPerRound !== null) {
    patch.pressure = {};
    if (genome.crisisSpikeExtractionDelta !== 0) {
      patch.pressure.crisisSpikeExtractionDelta = genome.crisisSpikeExtractionDelta;
    }
    if (genome.maxExtractionAddedPerRound !== null) {
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

  return normalizeScenarioPatch(patch);
}

function mutateGenome(base: PatchGenome, rng: () => number): PatchGenome {
  const next = { ...base };
  const knobs = Object.keys(GENOME_LIMITS) as Array<keyof typeof GENOME_LIMITS>;
  const key = knobs[rng() % knobs.length];
  const bounds = GENOME_LIMITS[key];
  const step = rng() % 2 === 0 ? -1 : 1;
  next[key] = clamp(next[key] + step, bounds.min, bounds.max);

  if (rng() % 5 === 0) {
    if (next.maxExtractionAddedPerRound === null) {
      next.maxExtractionAddedPerRound = intInRange(rng, 1, 4);
    } else if (rng() % 3 === 0) {
      next.maxExtractionAddedPerRound = null;
    } else {
      next.maxExtractionAddedPerRound = clamp(next.maxExtractionAddedPerRound + (rng() % 2 === 0 ? -1 : 1), 1, 4);
    }
  }

  return next;
}

function randomGenome(rng: () => number): PatchGenome {
  const genome: PatchGenome = {
    globalGazeDelta: intInRange(rng, GENOME_LIMITS.globalGazeDelta.min, GENOME_LIMITS.globalGazeDelta.max),
    northernWarMachineDelta: intInRange(rng, GENOME_LIMITS.northernWarMachineDelta.min, GENOME_LIMITS.northernWarMachineDelta.max),
    seededExtractionTotalDelta: intInRange(rng, GENOME_LIMITS.seededExtractionTotalDelta.min, GENOME_LIMITS.seededExtractionTotalDelta.max),
    crisisSpikeExtractionDelta: intInRange(rng, GENOME_LIMITS.crisisSpikeExtractionDelta.min, GENOME_LIMITS.crisisSpikeExtractionDelta.max),
    liberationThresholdDelta: intInRange(rng, GENOME_LIMITS.liberationThresholdDelta.min, GENOME_LIMITS.liberationThresholdDelta.max),
    relaxAllThresholdsBy: intInRange(rng, GENOME_LIMITS.relaxAllThresholdsBy.min, GENOME_LIMITS.relaxAllThresholdsBy.max),
    maxExtractionAddedPerRound: null,
  };

  if (rng() % 4 === 0) {
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

function serializePatch(patch: ScenarioPatch) {
  return JSON.stringify(normalizeValue(patch) ?? {});
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

function buildParameterSweepCandidates(analysis: OptimizerAnalysis): ScenarioPatch[] {
  const candidates: ScenarioPatch[] = [];

  if (analysis.outOfRange.winRate || analysis.outOfRange.publicVictoryRate) {
    candidates.push({
      note: '🧠 Sweep: ease opening pressure',
      setup: {
        globalGazeDelta: 1,
        northernWarMachineDelta: -1,
        seededExtractionTotalDelta: -1,
      },
      pressure: {
        crisisSpikeExtractionDelta: -1,
      },
    });
  }

  if (analysis.outOfRange.mandateFailRateGivenPublic) {
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

  if (analysis.outOfRange.averageTurns) {
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
        pressure: {
          crisisSpikeExtractionDelta: 1,
        },
        victory: {
          liberationThresholdDelta: 1,
        },
      });
    }
  }

  if (analysis.defeatPressure.pressureDetected) {
    candidates.push({
      note: '🧠 Sweep: cap per-round extraction spikes',
      pressure: {
        maxExtractionAddedPerRound: 2,
        crisisSpikeExtractionDelta: -1,
      },
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

  if (summary.averageTurnsToVictory > 8.5 && analysis.outOfRange.averageTurns) {
    patch.victory = {
      ...(patch.victory ?? {}),
      liberationThresholdDelta: 1,
    };
  }

  if (summary.averageTurnsToVictory < 6.0 && analysis.outOfRange.averageTurns) {
    patch.setup = {
      ...(patch.setup ?? {}),
      globalGazeDelta: 1,
      northernWarMachineDelta: -1,
    };
  }

  if (analysis.outOfRange.mandateFailRateGivenPublic && summary.mostCommonFirstAction?.action.toLowerCase().includes('investigate')) {
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

export async function generateCandidatePatches(input: CandidateGenerationInput): Promise<OptimizerCandidate[]> {
  const rng = createRng(mixSeed(input.seed, stableHash(`optimizer-candidates:${input.iteration}`)));
  const dedup = new Map<string, Omit<OptimizerCandidate, 'candidateId'>>();

  const addCandidate = (strategy: OptimizerCandidate['strategy'], patch: ScenarioPatch) => {
    const normalized = normalizeScenarioPatch(patch);
    if (isScenarioPatchEmpty(normalized)) {
      return;
    }
    const key = serializePatch(normalized);
    if (dedup.has(key)) {
      return;
    }
    dedup.set(key, {
      strategy,
      patch: normalized,
    });
  };

  if (includeNumericStrategies(input.strategyMode)) {
    for (const patch of buildParameterSweepCandidates(input.analysis)) {
      addCandidate('parameter_sweep', patch);
    }
  }

  if (includeTrajectoryStrategies(input.strategyMode)) {
    const trajectoryPatch = buildTrajectoryGuidedPatch(input.trajectorySummary, input.analysis);
    if (trajectoryPatch) {
      addCandidate('trajectory_guided', trajectoryPatch);
    }
  }

  for (const entry of buildVictoryGatingCandidates(input.strategyMode, input.analysis)) {
    addCandidate(entry.strategy, entry.patch);
  }

  if (input.hillClimbSourcePatch && includeNumericStrategies(input.strategyMode)) {
    const hillSource = toGenome(input.hillClimbSourcePatch);
    for (let index = 0; index < 4; index += 1) {
      const mutated = mutateGenome(hillSource, rng);
      addCandidate('hill_climb', fromGenome(mutated, '🧠 Hill-climb mutation'));
    }
  }

  if (input.useBalanceSearchSeeding && includeNumericStrategies(input.strategyMode) && input.iteration % 3 === 0) {
    try {
      console.log('🧪 Seeding candidates from balance search module');
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
      console.log(`⚠️ Balance seed generation skipped: ${err.message}`);
    }
  }

  while (dedup.size < input.targetCount) {
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

    const patch = fromGenome(randomGenome(rng), '🎲 Randomized mutation');
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
