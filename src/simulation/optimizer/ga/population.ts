/**
 * GA population operators: initialisation, crossover, mutation, selection,
 * and generation evolution.
 *
 * All random operations accept an RNG function (uint32 → uint32) so that
 * every result is fully deterministic from the optimizer seed.
 */

import type { GaConfig, GaIndividual, PatchGenome } from './types.ts';

// ---------------------------------------------------------------------------
// Genome parameter limits (mirrored from candidates.ts; kept here to
// avoid a circular dependency with the main candidates module).
// ---------------------------------------------------------------------------

export const GENOME_LIMITS = {
  globalGazeDelta: { min: -2, max: 3 },
  northernWarMachineDelta: { min: -2, max: 2 },
  seededExtractionTotalDelta: { min: -3, max: 3 },
  crisisSpikeExtractionDelta: { min: -2, max: 2 },
  liberationThresholdDelta: { min: -2, max: 2 },
  relaxAllThresholdsBy: { min: -1, max: 3 },
  scoreThreshold: { min: 65, max: 75 },
  publicVictoryWeight: { min: 30, max: 50 },
  mandatesWeight: { min: 40, max: 60 },
  catastrophicCapValue: { min: 60, max: 75 },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function intInRange(rng: () => number, min: number, max: number) {
  if (max <= min) { return min; }
  return min + (rng() % (max - min + 1));
}

function padId(index: number) {
  return `ind_${String(index + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Genome construction helpers (exported for re-use in engine)
// ---------------------------------------------------------------------------

/** Return a fully random genome within all parameter bounds. */
export function randomGenome(rng: () => number): PatchGenome {
  const publicVictoryWeight = [30, 35, 40, 45, 50][rng() % 5];
  const genome: PatchGenome = {
    globalGazeDelta: intInRange(rng, GENOME_LIMITS.globalGazeDelta.min, GENOME_LIMITS.globalGazeDelta.max),
    northernWarMachineDelta: intInRange(rng, GENOME_LIMITS.northernWarMachineDelta.min, GENOME_LIMITS.northernWarMachineDelta.max),
    seededExtractionTotalDelta: intInRange(rng, GENOME_LIMITS.seededExtractionTotalDelta.min, GENOME_LIMITS.seededExtractionTotalDelta.max),
    crisisSpikeExtractionDelta: intInRange(rng, GENOME_LIMITS.crisisSpikeExtractionDelta.min, GENOME_LIMITS.crisisSpikeExtractionDelta.max),
    liberationThresholdDelta: intInRange(rng, GENOME_LIMITS.liberationThresholdDelta.min, GENOME_LIMITS.liberationThresholdDelta.max),
    relaxAllThresholdsBy: intInRange(rng, GENOME_LIMITS.relaxAllThresholdsBy.min, GENOME_LIMITS.relaxAllThresholdsBy.max),
    maxExtractionAddedPerRound: rng() % 4 === 0 ? intInRange(rng, 1, 4) : null,
    scoreThreshold: [65, 70, 75][rng() % 3],
    publicVictoryWeight,
    mandatesWeight: 100 - publicVictoryWeight,
    catastrophicCapEnabled: rng() % 2 === 0,
    catastrophicCapValue: [65, 69, 72][rng() % 3],
  };
  return genome;
}

/**
 * Mutate a genome by randomly adjusting one numeric gene.
 * Applies additional low-probability toggles for nullable/boolean genes.
 * Probability gate for each gene is controlled by `mutationRate`.
 */
export function mutateGenome(genome: PatchGenome, mutationRate: number, rng: () => number): PatchGenome {
  const next = { ...genome };

  // Numeric knobs — each gene mutates independently with probability mutationRate
  type NumericKey = keyof typeof GENOME_LIMITS;
  const numericKeys = Object.keys(GENOME_LIMITS) as NumericKey[];
  for (const key of numericKeys) {
    if ((rng() / 0xFFFFFFFF) >= mutationRate) {
      continue;
    }
    const bounds = GENOME_LIMITS[key];
    const step = rng() % 2 === 0 ? -1 : 1;
    // All fields in GENOME_LIMITS are numeric (catastrophicCapEnabled is Boolean and NOT in GENOME_LIMITS)
    const current = next[key] as number;
    (next as Record<NumericKey, number>)[key] = clamp(current + step, bounds.min, bounds.max);

    // Maintain the weight coupling invariant
    if (key === 'publicVictoryWeight') {
      next.mandatesWeight = 100 - next.publicVictoryWeight;
    } else if (key === 'mandatesWeight') {
      next.publicVictoryWeight = 100 - next.mandatesWeight;
    }
  }

  // Nullable gene: maxExtractionAddedPerRound
  if ((rng() / 0xFFFFFFFF) < mutationRate * 0.3) {
    if (next.maxExtractionAddedPerRound === null) {
      next.maxExtractionAddedPerRound = intInRange(rng, 1, 4);
    } else if (rng() % 3 === 0) {
      next.maxExtractionAddedPerRound = null;
    } else {
      next.maxExtractionAddedPerRound = clamp(
        next.maxExtractionAddedPerRound + (rng() % 2 === 0 ? -1 : 1),
        1,
        4,
      );
    }
  }

  // Boolean gene: catastrophicCapEnabled
  if ((rng() / 0xFFFFFFFF) < mutationRate * 0.15) {
    next.catastrophicCapEnabled = !next.catastrophicCapEnabled;
  }

  return next;
}

/**
 * Uniform crossover: for each gene, pick value from parentA or parentB
 * with probability controlled by `crossoverRate`.
 * Maintains the publicVictoryWeight ↔ mandatesWeight coupling.
 */
export function crossover(
  parentA: PatchGenome,
  parentB: PatchGenome,
  crossoverRate: number,
  rng: () => number,
): PatchGenome {
  // If crossover doesn't fire, clone parentA
  if ((rng() / 0xFFFFFFFF) > crossoverRate) {
    return { ...parentA };
  }

  const child: PatchGenome = {
    globalGazeDelta: rng() % 2 === 0 ? parentA.globalGazeDelta : parentB.globalGazeDelta,
    northernWarMachineDelta: rng() % 2 === 0 ? parentA.northernWarMachineDelta : parentB.northernWarMachineDelta,
    seededExtractionTotalDelta: rng() % 2 === 0 ? parentA.seededExtractionTotalDelta : parentB.seededExtractionTotalDelta,
    crisisSpikeExtractionDelta: rng() % 2 === 0 ? parentA.crisisSpikeExtractionDelta : parentB.crisisSpikeExtractionDelta,
    liberationThresholdDelta: rng() % 2 === 0 ? parentA.liberationThresholdDelta : parentB.liberationThresholdDelta,
    relaxAllThresholdsBy: rng() % 2 === 0 ? parentA.relaxAllThresholdsBy : parentB.relaxAllThresholdsBy,
    maxExtractionAddedPerRound: rng() % 2 === 0 ? parentA.maxExtractionAddedPerRound : parentB.maxExtractionAddedPerRound,
    scoreThreshold: rng() % 2 === 0 ? parentA.scoreThreshold : parentB.scoreThreshold,
    // Weight pair: inherit as a unit to preserve coupling
    publicVictoryWeight: rng() % 2 === 0 ? parentA.publicVictoryWeight : parentB.publicVictoryWeight,
    mandatesWeight: 0, // recalculated below
    catastrophicCapEnabled: rng() % 2 === 0 ? parentA.catastrophicCapEnabled : parentB.catastrophicCapEnabled,
    catastrophicCapValue: rng() % 2 === 0 ? parentA.catastrophicCapValue : parentB.catastrophicCapValue,
  };
  child.mandatesWeight = 100 - child.publicVictoryWeight;
  return child;
}

// ---------------------------------------------------------------------------
// Population initialisation
// ---------------------------------------------------------------------------

export function initPopulation(size: number, rng: () => number): GaIndividual[] {
  return Array.from({ length: size }, (_, index) => ({
    id: padId(index),
    genome: randomGenome(rng),
    fitness: undefined,
    simulated: false,
  }));
}

// ---------------------------------------------------------------------------
// Selection (tournament)
// ---------------------------------------------------------------------------

const TOURNAMENT_SIZE = 3;

/**
 * Tournament selection: pick `k` individuals at random and return the
 * one with the highest fitness. Falls back to first individual if none
 * are yet simulated.
 */
export function tournamentSelect(population: GaIndividual[], rng: () => number): GaIndividual {
  const simulated = population.filter((ind) => ind.simulated && ind.fitness !== undefined);
  const pool = simulated.length >= TOURNAMENT_SIZE ? simulated : population;

  let best = pool[rng() % pool.length];
  for (let k = 1; k < TOURNAMENT_SIZE; k += 1) {
    const candidate = pool[rng() % pool.length];
    if (
      candidate !== undefined
      && best !== undefined
      && (candidate.fitness ?? -Infinity) > (best.fitness ?? -Infinity)
    ) {
      best = candidate;
    }
  }
  return best ?? population[0];
}

// ---------------------------------------------------------------------------
// Generation evolution
// ---------------------------------------------------------------------------

/**
 * Produce the next generation from the current population.
 * Elites are copied unchanged; remaining slots are filled by
 * tournament-selection → crossover → mutation.
 */
export function evolveGeneration(
  population: GaIndividual[],
  config: GaConfig,
  generationIndex: number,
  rng: () => number,
): GaIndividual[] {
  // Sort by fitness descending (unsimulated individuals go last)
  const sorted = [...population].sort(
    (a, b) => (b.fitness ?? -Infinity) - (a.fitness ?? -Infinity),
  );

  const nextGen: GaIndividual[] = [];
  const eliteCount = Math.min(config.elitism, sorted.length);

  // 🔒 Preserve elite individuals unchanged
  for (let e = 0; e < eliteCount; e += 1) {
    nextGen.push({
      id: padId(e),
      genome: { ...sorted[e].genome },
      fitness: undefined, // re-simulated next generation
      simulated: false,
    });
  }

  // 🧬 Fill remainder with crossover + mutation offspring
  let slot = eliteCount;
  while (nextGen.length < config.populationSize) {
    const parentA = tournamentSelect(sorted, rng);
    const parentB = tournamentSelect(sorted, rng);
    const childGenome = crossover(parentA.genome, parentB.genome, config.crossoverRate, rng);
    const mutatedGenome = mutateGenome(childGenome, config.mutationRate, rng);

    nextGen.push({
      id: padId(slot),
      genome: mutatedGenome,
      fitness: undefined,
      simulated: false,
    });
    slot += 1;
    // Safety guard
    if (slot > config.populationSize + 1000) { break; }
  }

  void generationIndex; // available for future logging if needed
  return nextGen.slice(0, config.populationSize);
}

// ---------------------------------------------------------------------------
// Population statistics helpers
// ---------------------------------------------------------------------------

export function computePopulationStats(population: GaIndividual[]) {
  const scores = population
    .map((ind) => ind.fitness ?? 0)
    .sort((a, b) => b - a);

  const sum = scores.reduce((acc, v) => acc + v, 0);
  const mean = scores.length > 0 ? sum / scores.length : 0;
  const mid = Math.floor(scores.length / 2);
  const median = scores.length > 0
    ? (scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid])
    : 0;

  return {
    bestFitness: scores[0] ?? 0,
    worstFitness: scores[scores.length - 1] ?? 0,
    meanFitness: mean,
    medianFitness: median,
  };
}
