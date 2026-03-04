import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../../src/simulation/runSimulation.ts';

test('CLI parser handles runs, scenarios, mode, seed, and parallel options', () => {
  const parsed = parseCliArgs([
    '--runs', '2500',
    '--scenario', 'base_design,tahrir_square',
    '--scenario', 'woman_life_freedom',
    '--mode', 'symbolic',
    '--seed', '999',
    '--parallel', '8',
  ]);

  assert.equal(parsed.runs, 2500);
  assert.deepEqual(parsed.scenarios, ['base_design', 'tahrir_square', 'woman_life_freedom']);
  assert.deepEqual(parsed.victoryModes, ['symbolic']);
  assert.equal(parsed.seed, 999);
  assert.equal(parsed.parallelWorkers, 8);
});

test('CLI parser maps mode=both to liberation and symbolic', () => {
  const parsed = parseCliArgs(['--mode', 'both']);

  assert.deepEqual(parsed.victoryModes, ['liberation', 'symbolic']);
});
