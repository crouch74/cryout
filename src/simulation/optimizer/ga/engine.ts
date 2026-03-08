/**
 * GA Evolutionary Search Engine.
 *
 * Runs a multi-generation genetic algorithm to explore the scenario parameter
 * space. Each individual is scored using a lightweight single-arm simulation
 * (reduced runs vs. the full A/B experiment). The top-N individuals are
 * returned as OptimizerCandidate objects for promotion to the A/B validation
 * pool in the main optimizer engine.
 *
 * This module is exploration-only. Statistical confirmation is always
 * handled by the existing experiment engine.
 */

import { join } from 'node:path';
import { runSingleArmExperiment } from '../../experiments/runner.ts';
import type { ExperimentDefinition } from '../../experiments/types.ts';
import { logDebug, logInfo, logSuccess, logWarn } from '../../logging.ts';
import { getScenarioPatchKey } from '../candidates.ts';
import { scoreArmSummary } from '../fitness.ts';
import { ensureDir } from '../io.ts';
import type { OptimizerCandidate } from '../types.ts';
import { genomeToCandidate } from './genome.ts';
import {
  computePopulationStats,
  evolveGeneration,
  initPopulation,
} from './population.ts';
import { writeGaReport, writeGenerationReport } from './reporter.ts';
import type {
  GaGenerationReport,
  GaIndividual,
  GaSearchInput,
  GaSearchResult,
} from './types.ts';
import { getRulesetDefinition } from '../../../engine/index.ts';
import { buildMutationSpaceFromScenario, validateScenarioPatch } from './mutationSpace.ts';

// ---------------------------------------------------------------------------
// Internal RNG
// ---------------------------------------------------------------------------

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

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function planWorkerAllocation(totalWorkers: number, jobCount: number, minWorkersPerJob = 2) {
  if (jobCount <= 0) {
    return { concurrency: 1, workersPerJob: Math.max(1, totalWorkers) };
  }
  const cappedWorkers = Math.max(1, totalWorkers);
  const concurrency = cappedWorkers >= minWorkersPerJob
    ? Math.max(1, Math.min(jobCount, Math.floor(cappedWorkers / minWorkersPerJob)))
    : 1;
  return {
    concurrency,
    workersPerJob: Math.max(1, Math.floor(cappedWorkers / concurrency)),
  };
}

// ---------------------------------------------------------------------------
// Simulation scoring (single-arm: arm B only = the candidate patch)
// ---------------------------------------------------------------------------

async function scoreIndividual(
  individual: GaIndividual,
  input: GaSearchInput,
  generationIndex: number,
  experimentDir: string,
  parallelWorkers: number,
): Promise<GaIndividual> {
  const patch = genomeToCandidate(individual.genome);
  
  const ruleset = getRulesetDefinition(input.scenarioId);
  if (ruleset && !validateScenarioPatch(patch, ruleset)) {
      logWarn(`⚠️ Rejecting invalid scenario patch for ${individual.id}`);
      return {
          ...individual,
          fitness: 0,
          simulated: true,
      };
  }
  
  const experimentId = `ga_${input.scenarioId}_iter_${pad2(input.iteration)}_gen_${pad2(generationIndex)}_${individual.id}`;

  const definition: ExperimentDefinition = {
    id: experimentId,
    title: `GA individual scoring gen=${generationIndex} id=${individual.id}`,
    scenarioId: input.scenarioId,
    runsPerArm: input.config.runsPerIndividual,
    seed: mixSeed(input.seed, stableHash(`${experimentId}:${individual.id}`)),
    victoryModes: input.victoryModes as ExperimentDefinition['victoryModes'],
    playerCounts: input.playerCounts as ExperimentDefinition['playerCounts'],
    patch,
    expectedEffects: {},
    decisionRule: {
      primary: 'successRate',
      minLift: 0,
      confidence: 0.95,
    },
  };

  const result = await runSingleArmExperiment(definition, {
    outDir: experimentDir,
    recordTrajectories: false,
    parallelWorkers,
    logMode: 'aggregated',
    baselinePatch: input.baselinePatch ?? {},
    armLabel: 'B',
    tempRootDir: join(input.outDir, 'ga_search', '.tmp'),
  });
  const scoreBreakdown = scoreArmSummary(result.arm);

  return {
    ...individual,
    fitness: scoreBreakdown.score,
    metrics: {
      successRate: result.arm.successRate,
      avgRounds: result.arm.turns.average,
    },
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) { return; }
      results[current] = await mapper(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

// ---------------------------------------------------------------------------
// Main GA search
// ---------------------------------------------------------------------------

/**
 * Run a full GA evolutionary search and return the top-N candidates
 * promoted for A/B statistical validation.
 */
export async function runGaSearch(input: GaSearchInput): Promise<GaSearchResult> {
  const { config } = input;
  const gaDir = join(input.outDir, 'ga_search');
  await ensureDir(gaDir);

  const rng = createRng(mixSeed(input.seed, stableHash(`ga:${input.scenarioId}:iter_${input.iteration}`)));
  
  const ruleset = getRulesetDefinition(input.scenarioId);
  if (!ruleset) {
    throw new Error(`Ruleset not found for scenario: ${input.scenarioId}`);
  }

  const mutationSpace = buildMutationSpaceFromScenario(ruleset);

  logInfo(`🧬 Building mutation space for scenario=${input.scenarioId}`);
  logInfo(`🧬 Mutation parameters discovered: ${mutationSpace.length}`);
  logInfo(`🧬 GA search start scenario=${input.scenarioId} population=${config.populationSize} generations=${config.generations}`);
  logInfo(`🧬 GA config mutation=${config.mutationRate} crossover=${config.crossoverRate} elitism=${config.elitism} runsPerIndividual=${config.runsPerIndividual}`);
  if (input.baselineScore && input.baselineMetrics) {
    logInfo(
      `🧬 GA baseline fitness=${input.baselineScore.score.toFixed(6)} successRate=${input.baselineMetrics.successRate.toFixed(4)} avgRounds=${input.baselineMetrics.turns.average.toFixed(2)}`,
    );
  }

  let population = initPopulation(config.populationSize, rng, mutationSpace);
  const generationReports: GaGenerationReport[] = [];
  const scoreCache = input.scoreCache ?? new Map<string, {
    fitness: number;
    successRate: number;
    avgRounds: number;
  }>();

  for (let gen = 1; gen <= config.generations; gen += 1) {
    logInfo(`🧬 Generation ${gen}/${config.generations} simulating ${population.length} individuals`);

    const experimentDir = join(gaDir, `generation_${pad2(gen)}`, 'experiments');
    await ensureDir(experimentDir);

    const workerPlan = planWorkerAllocation(input.parallelWorkers, population.length);
    logInfo(`🧬 Generation worker plan concurrency=${workerPlan.concurrency} workers/score=${workerPlan.workersPerJob}`);
    const scored = await mapWithConcurrency(
      population,
      workerPlan.concurrency,
      async (individual) => {
        try {
          const patchKey = getScenarioPatchKey(genomeToCandidate(individual.genome));
          const cacheKey = JSON.stringify({
            scenarioId: input.scenarioId,
            baselinePatchKey: input.baselinePatchKey ?? '{}',
            candidatePatchKey: patchKey,
            runsPerIndividual: input.config.runsPerIndividual,
            playerCounts: input.playerCounts,
            victoryModes: input.victoryModes,
          });
          const cachedScore = scoreCache.get(cacheKey);
          if (cachedScore !== undefined) {
            return {
              ...individual,
              fitness: cachedScore.fitness,
              metrics: {
                successRate: cachedScore.successRate,
                avgRounds: cachedScore.avgRounds,
              },
              simulated: true,
            };
          }
          const scoredIndividual = await scoreIndividual(individual, input, gen, experimentDir, workerPlan.workersPerJob);
          scoreCache.set(cacheKey, {
            fitness: scoredIndividual.fitness ?? 0,
            successRate: scoredIndividual.metrics?.successRate ?? 0,
            avgRounds: scoredIndividual.metrics?.avgRounds ?? 0,
          });
          return scoredIndividual;
        } catch (error) {
          const err = error as Error;
          logWarn(`⚠️ GA individual ${individual.id} scoring failed: ${err.message}`);
          return { ...individual, fitness: 0, simulated: true };
        }
      },
    );

    // Sort by fitness descending
    scored.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
    const best = scored[0];
    const stats = computePopulationStats(scored);

    logSuccess(`🧬 Generation ${gen}/${config.generations} complete`);
    logInfo(
      `📊 Best fitness: ${stats.bestFitness.toFixed(6)} successRate=${(best?.metrics?.successRate ?? 0).toFixed(4)} avgRounds=${(best?.metrics?.avgRounds ?? 0).toFixed(2)} mean=${stats.meanFitness.toFixed(6)}`,
    );

    if (best) {
      logSuccess(`🏆 Best individual: ${best.id} fitness=${(best.fitness ?? 0).toFixed(6)}`);
      if (gen === config.generations) {
        logInfo(`🧬 Final generation best genome: ${JSON.stringify(best.genome)}`);
      }
    }

    const report: GaGenerationReport = {
      generation: gen,
      populationSize: scored.length,
      stats,
      bestIndividualId: best?.id ?? 'none',
      bestGenome: best?.genome ?? scored[0]?.genome ?? population[0]?.genome ?? ({} as never),
      elitismCount: Math.min(config.elitism, scored.length),
    };
    generationReports.push(report);
    if (config.writeGenerationArtifacts) {
      await writeGenerationReport(join(gaDir, `generation_${pad2(gen)}`), report);
    }

    // Evolve to produce the next generation (skip after last generation)
    if (gen < config.generations) {
      population = evolveGeneration(scored, config, gen, rng, mutationSpace);
    } else {
      population = scored;
    }
  }

  // -------------------------------------------------------------------------
  // Promote top-N individuals
  // -------------------------------------------------------------------------

  // Final population is the last scored+sorted generation
  const finalSorted = [...population].sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
  const promotionCount = Math.min(config.topCandidates, finalSorted.length);

  const promotedByPatchKey = new Map<string, OptimizerCandidate>();
  const promotedSummaries: GaSearchResult['topCandidateSummaries'] = [];
  for (const individual of finalSorted) {
    const patch = genomeToCandidate(individual.genome);
    const patchKey = getScenarioPatchKey(patch);
    if (promotedByPatchKey.has(patchKey)) {
      continue;
    }
    const candidateId = `ga_promoted_${String(promotedByPatchKey.size).padStart(3, '0')}`;
    const candidate: OptimizerCandidate = {
      candidateId,
      strategy: 'evolutionary' as const,
      patch,
    };
    promotedByPatchKey.set(patchKey, candidate);
    promotedSummaries.push({
      rank: promotedSummaries.length + 1,
      individualId: individual.id,
      candidateId,
      strategy: candidate.strategy,
      fitness: individual.fitness ?? 0,
      metrics: {
        successRate: individual.metrics?.successRate ?? 0,
        avgRounds: individual.metrics?.avgRounds ?? 0,
      },
      genome: { ...individual.genome },
      patch,
    });
    if (promotedByPatchKey.size >= promotionCount) {
      break;
    }
  }
  const topCandidates = Array.from(promotedByPatchKey.values());

  const bestFitness = finalSorted[0]?.fitness ?? 0;

  logSuccess(`🧬 GA search complete bestFitness=${bestFitness.toFixed(6)} topCandidates=${topCandidates.length}`);

  const result: GaSearchResult = {
    scenarioId: input.scenarioId,
    generationsCompleted: config.generations,
    generationReports,
    topCandidates,
    topCandidateSummaries: promotedSummaries,
    bestFitness,
  };

  await writeGaReport(gaDir, result);
  return result;
}
