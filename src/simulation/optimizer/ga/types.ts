/**
 * Types for the Genetic Algorithm (GA) evolutionary search module.
 *
 * The GA is used for exploration only. Statistical confirmation of improvements
 * is always delegated to the existing A/B experiment engine.
 */

import type { OptimizerCandidate } from '../types.ts';

// ---------------------------------------------------------------------------
// Genome representation
// ---------------------------------------------------------------------------

/**
 * A numeric parameter genome representing a scenario patch candidate.
 * Each field is a delta applied on top of the current baseline scenario.
 *
 * Ranges are enforced by GENOME_LIMITS in population.ts.
 */
export interface PatchGenome {
  globalGazeDelta?: number;
  northernWarMachineDelta?: number;
  seededExtractionTotalDelta?: number;
  crisisSpikeExtractionDelta?: number;
  liberationThresholdDelta?: number;
  relaxAllThresholdsBy?: number;
  maxExtractionAddedPerRound?: number | null;
  scoreThreshold?: number;
  publicVictoryWeight?: number;
  mandatesWeight?: number;
  catastrophicCapEnabled?: boolean;
  catastrophicCapValue?: number;
}

// ---------------------------------------------------------------------------
// GA configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for a single GA search run.
 */
export interface GaConfig {
  /** Number of individuals in each generation. */
  populationSize: number;
  /** Number of generations to evolve. */
  generations: number;
  /** Probability (0–1) that any gene is randomly mutated per mutation call. */
  mutationRate: number;
  /** Probability (0–1) that two parents produce a crossover child vs. clone. */
  crossoverRate: number;
  /** Number of top individuals copied unchanged into the next generation. */
  elitism: number;
  /** Simulation runs used to score each individual (reduced vs. full A/B). */
  runsPerIndividual: number;
  /** Top-N individuals to promote to A/B validation after search completes. */
  topCandidates: number;
}

export const GA_DEFAULT_CONFIG: GaConfig = {
  populationSize: 30,
  generations: 10,
  mutationRate: 0.15,
  crossoverRate: 0.6,
  elitism: 3,
  runsPerIndividual: 1000,
  topCandidates: 5,
};

// ---------------------------------------------------------------------------
// Individual
// ---------------------------------------------------------------------------

/** A single member of the GA population with an associated fitness score. */
export interface GaIndividual {
  /** Unique identifier within the generation (e.g. "ind_001"). */
  id: string;
  genome: PatchGenome;
  /** Raw fitness score from scoreArmSummary; undefined until simulated. */
  fitness: number | undefined;
  /** True once simulation results have been applied. */
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Generation reporting
// ---------------------------------------------------------------------------

export interface GaPopulationStats {
  bestFitness: number;
  worstFitness: number;
  meanFitness: number;
  medianFitness: number;
}

export interface GaGenerationReport {
  generation: number;
  populationSize: number;
  stats: GaPopulationStats;
  bestIndividualId: string;
  bestGenome: PatchGenome;
  elitismCount: number;
}

// ---------------------------------------------------------------------------
// Search result
// ---------------------------------------------------------------------------

/**
 * Result returned by runGaSearch().
 * The top candidates are already converted to OptimizerCandidate format
 * and are ready to be injected into the regular A/B validation pool.
 */
export interface GaSearchResult {
  scenarioId: string;
  generationsCompleted: number;
  generationReports: GaGenerationReport[];
  topCandidates: OptimizerCandidate[];
  bestFitness: number;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface GaSearchInput {
  scenarioId: string;
  iteration: number;
  seed: number;
  config: GaConfig;
  /** Parallel workers forwarded to the simulation step. */
  parallelWorkers: number;
  /** Victory modes passed to individual simulations. */
  victoryModes: string[];
  /** Player counts passed to individual simulations. */
  playerCounts: number[];
  /** Output directory for per-generation JSON reports. */
  outDir: string;
}
