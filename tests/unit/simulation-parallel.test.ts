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

test('parallel and single-worker execution produce identical aggregates for same seed', async () => {
  const outSequential = await mkdtemp(join(tmpdir(), 'stones-sim-seq-'));
  const outParallel = await mkdtemp(join(tmpdir(), 'stones-sim-par-'));

  const baseConfig = {
    runsPerScenario: 2,
    randomSeed: 24680,
  } as const;

  const sequential = await runSimulationBatch({
    ...baseConfig,
    parallelWorkers: 1,
    outputDir: outSequential,
  });

  const parallel = await runSimulationBatch({
    ...baseConfig,
    parallelWorkers: 3,
    outputDir: outParallel,
  });

  const sequentialNdjson = await readFile(sequential.outputPath, 'utf8');
  const parallelNdjson = await readFile(parallel.outputPath, 'utf8');
  assert.equal(digest(sequentialNdjson), digest(parallelNdjson));

  const sequentialSummary = JSON.parse(await readFile(sequential.summaryPath, 'utf8'));
  const parallelSummary = JSON.parse(await readFile(parallel.summaryPath, 'utf8'));
  assert.deepEqual(sequentialSummary, parallelSummary);
});
