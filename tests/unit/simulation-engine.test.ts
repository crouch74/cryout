import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSimulationBatch } from '../../src/simulation/autoplayEngine.ts';

const EXPECTED_SCENARIOS = [
  'base_design',
  'tahrir_square',
  'woman_life_freedom',
  'algerian_war_of_independence',
];

function parseNdjson<T>(content: string): T[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

test('simulation engine writes NDJSON records and summary with expected coverage', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'stones-sim-engine-'));

  const result = await runSimulationBatch({
    runsPerScenario: 1,
    randomSeed: 12345,
    parallelWorkers: 1,
    outputDir,
  });

  assert.equal(result.runs, EXPECTED_SCENARIOS.length);

  const ndjson = await readFile(result.outputPath, 'utf8');
  const records = parseNdjson<Record<string, unknown>>(ndjson);

  assert.equal(records.length, EXPECTED_SCENARIOS.length);

  const scenarios = new Set(records.map((record) => String(record.scenario)));
  for (const scenario of EXPECTED_SCENARIOS) {
    assert.equal(scenarios.has(scenario), true);
  }

  for (const record of records) {
    const playerCount = Number(record.playerCount);
    assert.equal(playerCount >= 2 && playerCount <= 4, true);

    const reason = String((record.result as { reason: string }).reason);
    const extractionBreach = Boolean(record.extractionBreach);
    const comradesExhausted = Boolean(record.comradesExhausted);
    const suddenDeath = Boolean(record.suddenDeath);
    const mandateFailure = Boolean(record.mandateFailure);

    if (reason === 'extraction_breach') {
      assert.equal(extractionBreach, true);
    }
    if (reason === 'comrades_exhausted') {
      assert.equal(comradesExhausted, true);
    }
    if (reason === 'sudden_death') {
      assert.equal(suddenDeath, true);
    }
    if (reason === 'mandate_failure') {
      assert.equal(mandateFailure, true);
    }

    assert.equal(Array.isArray(record.preDefeatSnapshots), true);
    const preDefeatSnapshots = record.preDefeatSnapshots as Array<Record<string, unknown>>;
    assert.equal(preDefeatSnapshots.length >= 1, true);
    const firstPreDefeat = preDefeatSnapshots[0] ?? {};
    assert.equal(typeof firstPreDefeat.round, 'number');
    assert.equal(typeof firstPreDefeat.phase, 'string');
    assert.equal(typeof firstPreDefeat.totals, 'object');
    assert.equal(typeof firstPreDefeat.seats, 'object');
    assert.equal(typeof firstPreDefeat.fronts, 'object');
    assert.equal(typeof firstPreDefeat.globalTracks, 'object');
    assert.equal(typeof firstPreDefeat.domains, 'object');
    const preDefeatPhases = new Set(preDefeatSnapshots.map((snapshot) => String(snapshot.phase)));
    const hasPhaseSnapshot = ['system_actions', 'campaign_resolution', 'round_resolution']
      .some((phase) => preDefeatPhases.has(phase));
    assert.equal(hasPhaseSnapshot, true);

    assert.equal(Array.isArray(record.roundSnapshots), true);
    assert.equal(Array.isArray(record.timeline), true);
    assert.equal(typeof record.finalState, 'object');
    assert.equal(typeof record.campaignStats, 'object');
    assert.equal(typeof record.actionCounts, 'object');
  }

  const summary = JSON.parse(await readFile(result.summaryPath, 'utf8')) as Record<string, unknown>;
  assert.equal(Number(summary.runs), EXPECTED_SCENARIOS.length);
  assert.equal(typeof summary.sanity, 'object');
  assert.equal(typeof summary.scenarioStats, 'object');
  assert.equal(typeof summary.strategyPerformance, 'object');
});

test('simulation engine can write split NDJSON output shards', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'stones-sim-shards-'));
  const result = await runSimulationBatch({
    runsPerScenario: 1,
    randomSeed: 54321,
    parallelWorkers: 1,
    outputDir,
    splitOutputShards: true,
  });

  assert.match(result.outputPath, /simulations_\*\.ndjson$/);
  const files = await readdir(outputDir);
  const shardFiles = files.filter((name) => /^simulations_\d{3}\.ndjson$/.test(name)).sort();
  assert.equal(shardFiles.length >= 1, true);

  const shardContent = await readFile(join(outputDir, shardFiles[0] ?? 'simulations_000.ndjson'), 'utf8');
  const records = parseNdjson<Record<string, unknown>>(shardContent);
  assert.equal(records.length >= 1, true);
  assert.equal(Number(result.summary.runs), EXPECTED_SCENARIOS.length);
});
