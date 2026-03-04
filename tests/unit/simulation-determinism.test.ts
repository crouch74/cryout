import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runSimulationBatch } from '../../src/simulation/autoplayEngine.ts';

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

test('same seed produces identical NDJSON and summary output', async () => {
  const outA = await mkdtemp(join(tmpdir(), 'stones-sim-determinism-a-'));
  const outB = await mkdtemp(join(tmpdir(), 'stones-sim-determinism-b-'));

  const config = {
    runsPerScenario: 2,
    randomSeed: 67890,
    parallelWorkers: 1,
  } as const;

  const resultA = await runSimulationBatch({ ...config, outputDir: outA });
  const resultB = await runSimulationBatch({ ...config, outputDir: outB });

  const ndjsonA = await readFile(resultA.outputPath, 'utf8');
  const ndjsonB = await readFile(resultB.outputPath, 'utf8');
  assert.equal(digest(ndjsonA), digest(ndjsonB));

  const summaryA = JSON.parse(await readFile(resultA.summaryPath, 'utf8'));
  const summaryB = JSON.parse(await readFile(resultB.summaryPath, 'utf8'));
  assert.deepEqual(summaryA, summaryB);
});

test('different seeds produce different NDJSON distribution', async () => {
  const outA = await mkdtemp(join(tmpdir(), 'stones-sim-determinism-c-'));
  const outB = await mkdtemp(join(tmpdir(), 'stones-sim-determinism-d-'));

  const resultA = await runSimulationBatch({
    runsPerScenario: 2,
    randomSeed: 11111,
    parallelWorkers: 1,
    outputDir: outA,
  });

  const resultB = await runSimulationBatch({
    runsPerScenario: 2,
    randomSeed: 22222,
    parallelWorkers: 1,
    outputDir: outB,
  });

  const ndjsonA = await readFile(resultA.outputPath, 'utf8');
  const ndjsonB = await readFile(resultB.outputPath, 'utf8');

  assert.notEqual(digest(ndjsonA), digest(ndjsonB));
});
