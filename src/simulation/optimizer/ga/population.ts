/**
 * GA population operators: initialisation, crossover, mutation, selection,
 * and generation evolution.
 *
 * All random operations accept an RNG function (uint32 → uint32) so that
 * every result is fully deterministic from the optimizer seed.
 */

import type { GaConfig, GaIndividual, PatchGenome } from './types.ts';
import type { MutationDescriptor } from './mutationSpace.ts';
import { logDebug } from '../../logging.ts';

// ---------------------------------------------------------------------------
// Genome parameter limits (mirrored from candidates.ts; kept here to
// avoid a circular dependency with the main candidates module).
// ---------------------------------------------------------------------------

export const GENOME_LIMITS = {
  globalGazeDelta: { min: -2, max: 3 },
  northernWarMachineDelta: { min: -2, max: 2 },
  seededExtractionNetDelta: { min: -3, max: 3 },
  crisisAddExtractionDelta: { min: -2, max: 2 },
  liberationThresholdDelta: { min: -2, max: 2 },
  thresholdEaseDelta: { min: -1, max: 3 },
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

function mutationPathToGenomeKey(path: string) {
  switch (path) {
    case 'setup.seededExtractionTotalDelta':
      return 'seededExtractionNetDelta';
    case 'pressure.crisisSpikeExtractionDelta':
      return 'crisisAddExtractionDelta';
    case 'mandates.relaxAllThresholdsBy':
      return 'thresholdEaseDelta';
    case 'pressure.maxExtractionAddedPerRound':
      return 'perCardExtractionCap';
    default:
      return path.split('.').pop() as string;
  }
}

// ---------------------------------------------------------------------------
// Genome construction helpers (exported for re-use in engine)
// ---------------------------------------------------------------------------

/** Return a fully random genome within all parameter bounds. */
export function randomGenome(rng: () => number, mutationSpace?: MutationDescriptor[]): PatchGenome {
  const publicVictoryWeight = [30, 35, 40, 45, 50][rng() % 5];
  const genome: PatchGenome = {};

  if (!mutationSpace) {
    // Fallback for tests or legacy callers
    genome.globalGazeDelta = intInRange(rng, GENOME_LIMITS.globalGazeDelta.min, GENOME_LIMITS.globalGazeDelta.max);
    genome.northernWarMachineDelta = intInRange(rng, GENOME_LIMITS.northernWarMachineDelta.min, GENOME_LIMITS.northernWarMachineDelta.max);
    genome.seededExtractionNetDelta = intInRange(rng, GENOME_LIMITS.seededExtractionNetDelta.min, GENOME_LIMITS.seededExtractionNetDelta.max);
    genome.crisisAddExtractionDelta = intInRange(rng, GENOME_LIMITS.crisisAddExtractionDelta.min, GENOME_LIMITS.crisisAddExtractionDelta.max);
    genome.liberationThresholdDelta = intInRange(rng, GENOME_LIMITS.liberationThresholdDelta.min, GENOME_LIMITS.liberationThresholdDelta.max);
    genome.thresholdEaseDelta = intInRange(rng, GENOME_LIMITS.thresholdEaseDelta.min, GENOME_LIMITS.thresholdEaseDelta.max);
    genome.perCardExtractionCap = rng() % 4 === 0 ? intInRange(rng, 1, 4) : null;
    genome.scoreThreshold = [65, 70, 75][rng() % 3];
    genome.publicVictoryWeight = publicVictoryWeight;
    genome.mandatesWeight = 100 - publicVictoryWeight;
    genome.catastrophicCapEnabled = rng() % 2 === 0;
    genome.catastrophicCapValue = [65, 69, 72][rng() % 3];
    return genome;
  }

  // Derive only from mutation space
  const mutableGenome = genome as Record<string, number | boolean | null>;
  for (const m of mutationSpace) {
    const key = mutationPathToGenomeKey(m.path);
    if (m.type === 'number') {
      if (key === 'scoreThreshold') {
        mutableGenome.scoreThreshold = [65, 70, 75][rng() % 3];
      } else if (key === 'catastrophicCapValue') {
        mutableGenome.catastrophicCapValue = [65, 69, 72][rng() % 3];
      } else if (key === 'publicVictoryWeight') {
        mutableGenome.publicVictoryWeight = publicVictoryWeight;
        mutableGenome.mandatesWeight = 100 - publicVictoryWeight;
      } else if (key !== 'mandatesWeight' && m.min !== undefined && m.max !== undefined) {
        mutableGenome[key] = intInRange(rng, m.min, m.max);
      }
    } else if (m.type === 'nullableInt') {
      mutableGenome[key] = rng() % 4 === 0 && m.min !== undefined && m.max !== undefined ? intInRange(rng, m.min, m.max) : null;
    } else if (m.type === 'boolean') {
      mutableGenome[key] = rng() % 2 === 0;
    }
  }

  return genome;
}

/**
 * Mutate a genome by randomly adjusting one numeric gene.
 * Applies additional low-probability toggles for nullable/boolean genes.
 * Probability gate for each gene is controlled by `mutationRate`.
 */
export function mutateGenome(genome: PatchGenome, mutationRate: number, rng: () => number, mutationSpace?: MutationDescriptor[]): PatchGenome {
  const next: PatchGenome = { ...genome };
  let mutationApplied = false;

  const mutableNext = next as Record<string, number | boolean | null>;

  if (mutationSpace) {
    for (const m of mutationSpace) {
      if ((rng() / 0xFFFFFFFF) >= mutationRate) continue;

      const key = mutationPathToGenomeKey(m.path);
      if (m.type === 'number') {
        if (key === 'publicVictoryWeight' || key === 'mandatesWeight') {
          if (!mutationApplied) {
             const step = (rng() % 2 === 0 ? -1 : 1) * 5;
             const current = (mutableNext.publicVictoryWeight as number) || 45;
             mutableNext.publicVictoryWeight = clamp(current + step, 30, 50);
             mutableNext.mandatesWeight = 100 - (mutableNext.publicVictoryWeight as number);
             logDebug(`🧪 Applying mutation path=${m.path} value=${mutableNext.publicVictoryWeight}`);
             mutationApplied = true;
          }
          continue;
        }

        const current = (mutableNext[key] as number) || 0;
        const step = rng() % 2 === 0 ? -1 : 1;
        const minBound = m.min ?? -10;
        const maxBound = m.max ?? 10;
        mutableNext[key] = clamp(current + step, minBound, maxBound);
        logDebug(`🧪 Applying mutation path=${m.path} value=${mutableNext[key]}`);
        mutationApplied = true;
      } else if (m.type === 'nullableInt') {
        if (mutableNext[key] === null || mutableNext[key] === undefined) {
          mutableNext[key] = intInRange(rng, m.min ?? 1, m.max ?? 4);
        } else if (rng() % 3 === 0) {
          mutableNext[key] = null;
        } else {
          mutableNext[key] = clamp((mutableNext[key] as number) + (rng() % 2 === 0 ? -1 : 1), m.min ?? 1, m.max ?? 4);
        }
        logDebug(`🧪 Applying mutation path=${m.path} value=${mutableNext[key]}`);
        mutationApplied = true;
      } else if (m.type === 'boolean') {
        mutableNext[key] = !(mutableNext[key] ?? true);
        logDebug(`🧪 Applying mutation path=${m.path} value=${mutableNext[key]}`);
        mutationApplied = true;
      }
    }

    if (!mutationSpace.some(m => m.path === 'victoryScoring.catastrophicCapEnabled')) {
       if ((rng() / 0xFFFFFFFF) < mutationRate) {
          logDebug(`⚠️ Mutation skipped path=victoryScoring.catastrophicCapEnabled (not present)`);
       }
    }
  } else {
    // Legacy fallback
    type NumericKey = keyof typeof GENOME_LIMITS;
    const numericKeys = Object.keys(GENOME_LIMITS) as NumericKey[];
    for (const key of numericKeys) {
      if ((rng() / 0xFFFFFFFF) >= mutationRate) {
        continue;
      }
      const bounds = GENOME_LIMITS[key];
      const step = rng() % 2 === 0 ? -1 : 1;
      const current = (mutableNext[key] as number) ?? 0;
      mutableNext[key] = clamp(current + step, bounds.min, bounds.max);

      if (key === 'publicVictoryWeight') {
        mutableNext.mandatesWeight = 100 - (mutableNext.publicVictoryWeight as number);
      } else if (key === 'mandatesWeight') {
        mutableNext.publicVictoryWeight = 100 - (mutableNext.mandatesWeight as number);
      }
    }
    if ((rng() / 0xFFFFFFFF) < mutationRate * 0.3) {
      if (mutableNext.perCardExtractionCap === null || mutableNext.perCardExtractionCap === undefined) {
        mutableNext.perCardExtractionCap = intInRange(rng, 1, 4);
      } else if (rng() % 3 === 0) {
        mutableNext.perCardExtractionCap = null;
      } else {
        mutableNext.perCardExtractionCap = clamp(
          (mutableNext.perCardExtractionCap as number) + (rng() % 2 === 0 ? -1 : 1),
          1,
          4,
        );
      }
    }
    if ((rng() / 0xFFFFFFFF) < mutationRate * 0.15) {
      mutableNext.catastrophicCapEnabled = !(mutableNext.catastrophicCapEnabled as boolean ?? true);
    }
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
  if ((rng() / 0xFFFFFFFF) > crossoverRate) {
    return { ...parentA };
  }

  const child: PatchGenome = {};
  
  // Cross over all keys present in either parent
  const allKeys = new Set([...Object.keys(parentA), ...Object.keys(parentB)]);
  const mutableChild = child as Record<string, number | boolean | null>;
  const mutA = parentA as Record<string, number | boolean | null>;
  const mutB = parentB as Record<string, number | boolean | null>;

  for (const key of allKeys) {
      // randomly pick A or B
      if (rng() % 2 === 0) {
          if (mutA[key] !== undefined) mutableChild[key] = mutA[key];
      } else {
          if (mutB[key] !== undefined) mutableChild[key] = mutB[key];
      }
  }

  if (child.publicVictoryWeight !== undefined) {
      child.mandatesWeight = 100 - child.publicVictoryWeight;
  }
  
  return child;
}

// ---------------------------------------------------------------------------
// Population initialisation
// ---------------------------------------------------------------------------

export function initPopulation(size: number, rng: () => number, mutationSpace?: MutationDescriptor[]): GaIndividual[] {
  return Array.from({ length: size }, (_, index) => ({
    id: padId(index),
    genome: randomGenome(rng, mutationSpace),
    fitness: undefined,
    simulated: false,
  }));
}

// ---------------------------------------------------------------------------
// Selection (tournament)
// ---------------------------------------------------------------------------

const TOURNAMENT_SIZE = 3;

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

export function evolveGeneration(
  population: GaIndividual[],
  config: GaConfig,
  generationIndex: number,
  rng: () => number,
  mutationSpace?: MutationDescriptor[]
): GaIndividual[] {
  const sorted = [...population].sort(
    (a, b) => (b.fitness ?? -Infinity) - (a.fitness ?? -Infinity),
  );

  const nextGen: GaIndividual[] = [];
  const eliteCount = Math.min(config.elitism, sorted.length);

  for (let e = 0; e < eliteCount; e += 1) {
    nextGen.push({
      id: padId(e),
      genome: { ...sorted[e].genome },
      fitness: undefined,
      simulated: false,
    });
  }

  let slot = eliteCount;
  while (nextGen.length < config.populationSize) {
    let validMutations = false;
    let mutatedGenome: PatchGenome = {} as PatchGenome;

    // Reject individuals with 0 valid mutations (Fail early on invalid genome)
    // Try multiple times to generate a valid mutated child
    for (let attempts = 0; attempts < 10; attempts++) {
      const parentA = tournamentSelect(sorted, rng);
      const parentB = tournamentSelect(sorted, rng);
      const childGenome = crossover(parentA.genome, parentB.genome, config.crossoverRate, rng);
      const tempMutationStr = JSON.stringify(childGenome);
      mutatedGenome = mutateGenome(childGenome, config.mutationRate, rng, mutationSpace);

      // Check if any mutation was actually applied differently than just crossover
      if (JSON.stringify(mutatedGenome) !== tempMutationStr) {
         validMutations = true;
         break;
      }
    }

    // fallback if no mutation hit
    if (!validMutations) {
       // regenerate completely if failing to mutate (as prompt says: Fail Early on Invalid Genome ... regenerateIndividual())
       mutatedGenome = randomGenome(rng, mutationSpace);
    }

    nextGen.push({
      id: padId(slot),
      genome: mutatedGenome,
      fitness: undefined,
      simulated: false,
    });
    slot += 1;
    if (slot > config.populationSize + 1000) { break; }
  }

  void generationIndex;
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
