import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePopulationStats,
  crossover,
  evolveGeneration,
  initPopulation,
  mutateGenome,
  randomGenome,
  tournamentSelect,
} from '../../src/simulation/optimizer/ga/population.ts';
import { genomeToCandidate } from '../../src/simulation/optimizer/ga/genome.ts';
import {
  buildMutationSpaceFromScenario,
  validateScenarioPatch,
} from '../../src/simulation/optimizer/ga/mutationSpace.ts';
import type { GaConfig } from '../../src/simulation/optimizer/ga/types.ts';
import { getRulesetDefinition } from '../../src/engine/index.ts';

// ---------------------------------------------------------------------------
// Deterministic RNG for tests
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let state = seed === 0 ? 0x6d2b79f5 : seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0;
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return (state ^ (state >>> 14)) >>> 0;
  };
}

const GA_TEST_CONFIG: GaConfig = {
  populationSize: 10,
  generations: 3,
  mutationRate: 0.5,
  crossoverRate: 0.8,
  elitism: 2,
  runsPerIndividual: 100,
  topCandidates: 3,
};

// ---------------------------------------------------------------------------

test('initPopulation produces the correct number of individuals with unique IDs', () => {
  const rng = createRng(42);
  const population = initPopulation(10, rng);

  assert.equal(population.length, 10);
  const ids = new Set(population.map((ind) => ind.id));
  assert.equal(ids.size, 10);

  for (const individual of population) {
    assert.equal(individual.simulated, false);
    assert.equal(individual.fitness, undefined);
  }
});

test('randomGenome produces values within GENOME_LIMITS bounds', () => {
  const rng = createRng(99);
  for (let i = 0; i < 20; i += 1) {
    const genome = randomGenome(rng);
    assert.ok(genome.globalGazeDelta >= -2 && genome.globalGazeDelta <= 3);
    assert.ok(genome.northernWarMachineDelta >= -2 && genome.northernWarMachineDelta <= 2);
    assert.ok(genome.seededExtractionTotalDelta >= -3 && genome.seededExtractionTotalDelta <= 3);
    assert.ok(genome.liberationThresholdDelta >= -2 && genome.liberationThresholdDelta <= 2);
    assert.ok(genome.relaxAllThresholdsBy >= -1 && genome.relaxAllThresholdsBy <= 3);
    assert.ok(genome.scoreThreshold >= 65 && genome.scoreThreshold <= 75);
    assert.ok(genome.publicVictoryWeight >= 30 && genome.publicVictoryWeight <= 50);
    // Weight coupling invariant
    assert.equal(genome.publicVictoryWeight + genome.mandatesWeight, 100);
  }
});

test('crossover with rate=0 returns a clone of parentA', () => {
  const rng = createRng(7);
  const parentA = randomGenome(rng);
  const parentB = randomGenome(rng);

  // Rate 0 = never crossover
  const child = crossover(parentA, parentB, 0, rng);
  assert.deepEqual(child, parentA);
});

test('crossover preserves publicVictoryWeight + mandatesWeight = 100 invariant', () => {
  const rng = createRng(123);
  for (let i = 0; i < 20; i += 1) {
    const parentA = randomGenome(rng);
    const parentB = randomGenome(rng);
    const child = crossover(parentA, parentB, 0.9, rng);
    assert.equal(child.publicVictoryWeight + child.mandatesWeight, 100);
  }
});

test('mutateGenome with rate=0 returns an identical genome', () => {
  const rng = createRng(55);
  const genome = randomGenome(rng);
  const mutated = mutateGenome(genome, 0, rng);
  // At rate=0, no gene should mutate (boolean toggles also won't fire at rate*factor < 0)
  assert.deepEqual(mutated, genome);
});

test('mutateGenome always preserves weight coupling invariant', () => {
  const rng = createRng(999);
  for (let i = 0; i < 30; i += 1) {
    const genome = randomGenome(rng);
    const mutated = mutateGenome(genome, 0.5, rng);
    assert.equal(mutated.publicVictoryWeight + mutated.mandatesWeight, 100);
  }
});

test('tournamentSelect returns an individual from the population', () => {
  const rng = createRng(1);
  const population = initPopulation(10, rng)
    .map((ind, i) => ({ ...ind, fitness: i * 0.1 as number | undefined, simulated: true }));

  const rng2 = createRng(2);
  const selected = tournamentSelect(population, rng2);
  assert.ok(population.includes(selected));
});

test('evolveGeneration preserves elitism: top-N individuals carry forward', () => {
  const rng = createRng(42);
  const population = initPopulation(GA_TEST_CONFIG.populationSize, rng)
    .map((ind, i) => ({
      ...ind,
      fitness: (GA_TEST_CONFIG.populationSize - i) * 0.1, // descending fitness
      simulated: true,
    }));

  const sorted = [...population].sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
  const topTwoGenomes = sorted.slice(0, GA_TEST_CONFIG.elitism).map((ind) => ({ ...ind.genome }));

  const rng2 = createRng(99);
  const nextGen = evolveGeneration(population, GA_TEST_CONFIG, 1, rng2);

  assert.equal(nextGen.length, GA_TEST_CONFIG.populationSize);

  // The first elitism individuals should have matching genomes
  for (let e = 0; e < GA_TEST_CONFIG.elitism; e += 1) {
    assert.deepEqual(nextGen[e]?.genome, topTwoGenomes[e]);
    // Elites are re-queued for simulation
    assert.equal(nextGen[e]?.simulated, false);
  }
});

test('computePopulationStats correctly calculates best, worst, mean, median', () => {
  const rng = createRng(1);
  const population = initPopulation(5, rng).map((ind, i) => ({
    ...ind,
    fitness: [0.1, 0.3, 0.5, 0.7, 0.9][i],
    simulated: true,
  }));

  const stats = computePopulationStats(population);
  assert.ok(Math.abs(stats.bestFitness - 0.9) < 1e-9);
  assert.ok(Math.abs(stats.worstFitness - 0.1) < 1e-9);
  assert.ok(Math.abs(stats.meanFitness - 0.5) < 1e-6);
  assert.ok(Math.abs(stats.medianFitness - 0.5) < 1e-9);
});

test('mutation space excludes crisis spike extraction when scenario has no crisis extraction adds', () => {
  const scenario = getRulesetDefinition('egypt_1919_revolution');
  assert.ok(scenario);

  const mutationSpace = buildMutationSpaceFromScenario(scenario);
  const paths = mutationSpace.map((entry) => entry.path);

  assert.equal(paths.includes('pressure.crisisSpikeExtractionDelta'), false);
  assert.equal(paths.includes('pressure.maxExtractionAddedPerRound'), true);
});

test('scenario patch validation rejects unsupported crisis spike extraction deltas', () => {
  const scenario = getRulesetDefinition('egypt_1919_revolution');
  assert.ok(scenario);

  assert.equal(
    validateScenarioPatch(
      {
        pressure: {
          crisisSpikeExtractionDelta: 1,
        },
      },
      scenario,
    ),
    false,
  );

  assert.equal(
    validateScenarioPatch(
      {
        pressure: {
          maxExtractionAddedPerRound: 1,
        },
      },
      scenario,
    ),
    true,
  );
});

test('genomeToCandidate omits catastrophic cap value when the cap is disabled', () => {
  const patch = genomeToCandidate({
    scoreThreshold: 65,
    publicVictoryWeight: 40,
    mandatesWeight: 60,
    catastrophicCapEnabled: false,
    catastrophicCapValue: 72,
  });

  assert.equal(patch.victoryScoring?.catastrophicCapEnabled, false);
  assert.equal(patch.victoryScoring?.catastrophicCapValue, undefined);
});
