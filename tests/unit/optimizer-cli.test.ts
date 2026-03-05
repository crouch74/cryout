import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig, parseArgs } from '../../src/simulation/optimizer/cli.ts';

test('optimizer CLI parser reads all explicit flags', () => {
  const parsed = parseArgs([
    '--scenario', 'base_design',
    '--iterations', '12',
    '--baseline-runs', '9000',
    '--candidate-runs', '4000',
    '--candidates', '17',
    '--patience', '4',
    '--seed', '777',
    '--parallel-workers', '6',
    '--out', 'simulation_output/custom_optimizer',
    '--mode', 'both',
    '--runtime', 'thorough',
    '--significance', 'strict',
    '--strategy', 'trajectory_discovery',
  ]);

  assert.equal(parsed.scenarioId, 'base_design');
  assert.equal(parsed.iterations, 12);
  assert.equal(parsed.baselineRuns, 9000);
  assert.equal(parsed.candidateRuns, 4000);
  assert.equal(parsed.candidates, 17);
  assert.equal(parsed.patience, 4);
  assert.equal(parsed.seed, 777);
  assert.equal(parsed.parallelWorkers, 6);
  assert.equal(parsed.mode, 'both');
  assert.equal(parsed.runtime, 'thorough');
  assert.equal(parsed.significance, 'strict');
  assert.equal(parsed.strategy, 'trajectory_discovery');
});

test('optimizer config applies balanced defaults when optional flags are omitted', async () => {
  const config = await buildConfig([
    '--scenario', 'base_design',
  ]);

  assert.equal(config.runtime, 'balanced');
  assert.equal(config.baselineRuns, 10000);
  assert.equal(config.candidateRuns, 5000);
  assert.equal(config.candidates, 15);
  assert.equal(config.mode, 'liberation');
  assert.deepEqual(config.victoryModes, ['liberation']);
  assert.equal(config.significance, 'balanced');
  assert.equal(config.strategy, 'full_optimizer');
  assert.equal(config.patience, 3);
  assert.equal(config.seed, 42);
  assert.equal(config.parallelWorkers >= 1, true);
});

test('optimizer config maps mode=both to liberation and symbolic', async () => {
  const config = await buildConfig([
    '--scenario', 'base_design',
    '--mode', 'both',
  ]);

  assert.equal(config.mode, 'both');
  assert.deepEqual(config.victoryModes, ['liberation', 'symbolic']);
});
