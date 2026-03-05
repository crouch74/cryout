import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  buildBalancedSeatOwners,
  getRulesetDefinition,
  type FactionId,
  type VictoryMode as CompatVictoryMode,
} from '../../engine/index.ts';
import { runSingleSimulation } from '../autoplayEngine.ts';
import { listStrategyProfiles } from '../strategies.ts';
import type { PlannedSimulationRun, StrategyId } from '../types.ts';
import { applyScenarioPatch } from '../experiments/applyScenarioPatch.ts';
import { createArmAccumulator, finalizeArmSummary, ingestArmRecord } from '../experiments/report.ts';
import type { ScenarioPatch } from '../experiments/patchDsl.ts';

type CandidateValue = 0 | 1 | 2 | -1;

const PARAMETER_SPACE = {
  liberationThresholdDelta: [0, 1, 2] as const,
  mandateRelaxation: [0, 1, 2] as const,
  seededExtractionReduction: [0, 1, 2] as const,
  crisisSpikeReduction: [0, 1] as const,
  northernWarMachineDelta: [0, -1] as const,
  globalGazeDelta: [0, 1] as const,
} as const;

const SEARCH_OUTPUT_DIR = resolve(process.cwd(), 'simulation_output/balance_search');

interface SampleProfile {
  playerCount: 2 | 3 | 4;
  seatFactionIds: FactionId[];
  seatOwnerIds: number[];
  strategyIds: StrategyId[];
}

export type BalanceCandidate = {
  liberationThresholdDelta: 0 | 1 | 2;
  mandateRelaxation: 0 | 1 | 2;
  seededExtractionReduction: 0 | 1 | 2;
  crisisSpikeReduction: 0 | 1;
  northernWarMachineDelta: 0 | -1;
  globalGazeDelta: 0 | 1;
};

export type BalanceCandidateScore = {
  score: number;
  parameters: BalanceCandidate;
  metrics: {
    publicVictoryRate: number;
    mandateFailRateGivenPublic: number;
    successRate: number;
  };
};

export interface BalanceSearchOptions {
  scenarioId: string;
  iterations: number;
  runsPerCandidate: number;
  seed: number;
  outputDir?: string;
  topN?: number;
}

export interface BalanceSearchResult {
  generatedAt: string;
  scenarioId: string;
  iterations: number;
  runsPerCandidate: number;
  seed: number;
  bestCandidates: BalanceCandidateScore[];
}

function toCompatMode(): CompatVictoryMode {
  return 'LIBERATION';
}

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

function deterministicShuffle<T>(input: readonly T[], seed: number): T[] {
  const values = [...input];
  const next = createRng(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = next() % (index + 1);
    const current = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = current;
  }

  return values;
}

function chooseFromSpace<T extends CandidateValue>(space: readonly T[], rng: () => number): T {
  return space[rng() % space.length];
}

function buildRandomCandidate(rng: () => number): BalanceCandidate {
  return {
    liberationThresholdDelta: chooseFromSpace(PARAMETER_SPACE.liberationThresholdDelta, rng),
    mandateRelaxation: chooseFromSpace(PARAMETER_SPACE.mandateRelaxation, rng),
    seededExtractionReduction: chooseFromSpace(PARAMETER_SPACE.seededExtractionReduction, rng),
    crisisSpikeReduction: chooseFromSpace(PARAMETER_SPACE.crisisSpikeReduction, rng),
    northernWarMachineDelta: chooseFromSpace(PARAMETER_SPACE.northernWarMachineDelta, rng),
    globalGazeDelta: chooseFromSpace(PARAMETER_SPACE.globalGazeDelta, rng),
  };
}

export function balanceCandidateToPatch(candidate: BalanceCandidate): ScenarioPatch {
  return {
    note: '🧠 Balance search candidate',
    victory: {
      liberationThresholdDelta: candidate.liberationThresholdDelta,
    },
    mandates: {
      relaxAllThresholdsBy: candidate.mandateRelaxation,
    },
    setup: {
      seededExtractionTotalDelta: -candidate.seededExtractionReduction,
      northernWarMachineDelta: candidate.northernWarMachineDelta,
      globalGazeDelta: candidate.globalGazeDelta,
    },
    pressure: {
      crisisSpikeExtractionDelta: -candidate.crisisSpikeReduction,
    },
  };
}

function buildCandidateKey(candidate: BalanceCandidate) {
  return JSON.stringify(candidate);
}

function scoreMetrics(metrics: {
  publicVictoryRate: number;
  mandateFailRateGivenPublic: number;
  successRate: number;
}) {
  return -Math.abs(metrics.publicVictoryRate - 0.5)
    - Math.abs(metrics.mandateFailRateGivenPublic - 0.35)
    - Math.abs(metrics.successRate - 0.30);
}

function buildSampleProfile(
  runIndex: number,
  seed: number,
  factionIds: FactionId[],
  strategyIds: StrategyId[],
): SampleProfile {
  const sampleSeed = mixSeed(seed, runIndex + 1);
  const playerCountOptions: Array<2 | 3 | 4> = [2, 3, 4];
  const playerCount = playerCountOptions[mixSeed(sampleSeed, stableHash('players')) % playerCountOptions.length];
  const seatFactionIds = deterministicShuffle(factionIds, mixSeed(sampleSeed, stableHash('factions')));
  const seatOwnerIds = buildBalancedSeatOwners(playerCount, seatFactionIds);

  const perSeatStrategies = seatFactionIds.map((_, seat) => {
    const strategyIndex = mixSeed(sampleSeed, stableHash(`strategy:${seat}`)) % strategyIds.length;
    return strategyIds[strategyIndex];
  });

  return {
    playerCount,
    seatFactionIds,
    seatOwnerIds,
    strategyIds: perSeatStrategies,
  };
}

function buildRun(
  runIndex: number,
  scenarioId: string,
  seed: number,
  profile: SampleProfile,
  batchLabel: string,
): PlannedSimulationRun {
  const runSeed = mixSeed(seed, runIndex + 1);
  return {
    index: runIndex,
    simulationId: `${batchLabel}:${String(runIndex + 1).padStart(9, '0')}:${runSeed}`,
    scenario: scenarioId,
    mode: toCompatMode(),
    seed: runSeed,
    humanPlayerCount: profile.playerCount,
    seatFactionIds: [...profile.seatFactionIds],
    seatOwnerIds: [...profile.seatOwnerIds],
    strategyIds: [...profile.strategyIds],
  };
}

function mutateCandidate(current: BalanceCandidate, rng: () => number): BalanceCandidate {
  const keys = Object.keys(PARAMETER_SPACE) as Array<keyof BalanceCandidate>;
  const key = keys[rng() % keys.length];
  const allowed = PARAMETER_SPACE[key] as readonly CandidateValue[];
  const currentIndex = allowed.indexOf(current[key]);
  const neighborIndexes = [currentIndex - 1, currentIndex + 1].filter((index) => index >= 0 && index < allowed.length);
  if (neighborIndexes.length === 0) {
    return current;
  }
  const nextIndex = neighborIndexes[rng() % neighborIndexes.length];
  return {
    ...current,
    [key]: allowed[nextIndex],
  } as BalanceCandidate;
}

async function evaluateCandidate(
  scenarioId: string,
  candidate: BalanceCandidate,
  runsPerCandidate: number,
  seed: number,
  iteration: number,
) {
  const scenario = getRulesetDefinition(scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario for balance search: ${scenarioId}`);
  }

  const experimentId = `balance_search_${scenarioId}_${seed}_${iteration}`;
  const patchedScenario = applyScenarioPatch({
    experimentId,
    scenarioId,
    patch: balanceCandidateToPatch(candidate),
  });

  try {
    const accumulator = createArmAccumulator('B', mixSeed(seed, stableHash(`balance:${iteration}`)));
    const strategyIds = listStrategyProfiles().map((profile) => profile.id) as StrategyId[];
    const factionIds = scenario.factions.map((faction) => faction.id as FactionId);

    for (let runIndex = 0; runIndex < runsPerCandidate; runIndex += 1) {
      const profile = buildSampleProfile(runIndex, seed, factionIds, strategyIds);
      const run = buildRun(
        runIndex,
        patchedScenario.treatmentScenarioId,
        seed,
        profile,
        `balance:${iteration}`,
      );
      const outcome = runSingleSimulation(run, { trajectoryRecording: false });
      ingestArmRecord(accumulator, outcome.record);
    }

    const summary = finalizeArmSummary(accumulator);
    const metrics = {
      publicVictoryRate: summary.publicVictoryRate,
      mandateFailRateGivenPublic: summary.mandateFailRateGivenPublic,
      successRate: summary.successRate,
    };

    return {
      score: scoreMetrics(metrics),
      parameters: candidate,
      metrics,
    } satisfies BalanceCandidateScore;
  } finally {
    patchedScenario.unregister();
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runBalanceSearch(options: BalanceSearchOptions): Promise<BalanceSearchResult> {
  const iterations = Math.max(1, Math.floor(options.iterations));
  const runsPerCandidate = Math.max(1, Math.floor(options.runsPerCandidate));
  const topN = Math.max(1, Math.floor(options.topN ?? 10));
  const outputDir = resolve(options.outputDir ?? SEARCH_OUTPUT_DIR);
  const rng = createRng(options.seed);
  const restartInterval = 20;
  const bestByKey = new Map<string, BalanceCandidateScore>();

  let current = buildRandomCandidate(rng);
  const initialScore = await evaluateCandidate(
    options.scenarioId,
    current,
    runsPerCandidate,
    mixSeed(options.seed, 0),
    0,
  );
  let best = initialScore;
  bestByKey.set(buildCandidateKey(initialScore.parameters), initialScore);

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    console.log(`🧠 Balance search iteration ${iteration}`);

    if (iteration % restartInterval === 0) {
      current = buildRandomCandidate(rng);
    } else {
      current = mutateCandidate(best.parameters, rng);
    }

    console.log('🧪 Testing candidate configuration');
    const evaluated = await evaluateCandidate(
      options.scenarioId,
      current,
      runsPerCandidate,
      mixSeed(options.seed, iteration),
      iteration,
    );
    console.log(`📊 Score: ${evaluated.score.toFixed(6)}`);

    const key = buildCandidateKey(evaluated.parameters);
    const existing = bestByKey.get(key);
    if (!existing || evaluated.score > existing.score) {
      bestByKey.set(key, evaluated);
    }

    if (evaluated.score > best.score) {
      best = evaluated;
      console.log('🏆 New best candidate discovered');
    }
  }

  const bestCandidates = Array.from(bestByKey.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return buildCandidateKey(left.parameters).localeCompare(buildCandidateKey(right.parameters));
    })
    .slice(0, topN);

  const result: BalanceSearchResult = {
    generatedAt: new Date().toISOString(),
    scenarioId: options.scenarioId,
    iterations,
    runsPerCandidate,
    seed: options.seed >>> 0,
    bestCandidates,
  };

  await mkdir(outputDir, { recursive: true });
  await writeJson(join(outputDir, 'best_candidates.json'), result);

  return result;
}

export function mutateCandidateForTest(current: BalanceCandidate, seed: number) {
  return mutateCandidate(current, createRng(seed));
}

export function scoreMetricsForTest(metrics: {
  publicVictoryRate: number;
  mandateFailRateGivenPublic: number;
  successRate: number;
}) {
  return scoreMetrics(metrics);
}
