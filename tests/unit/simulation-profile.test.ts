import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupedFindings,
  buildQuickWins,
  parsePprofTopOutput,
  parseProfileCliArgs,
} from '../../src/simulation/profileSimulation.ts';

test('parseProfileCliArgs uses deterministic defaults', () => {
  const parsed = parseProfileCliArgs([]);

  assert.equal(parsed.runs, 1000);
  assert.equal(parsed.scenario, 'stones_cry_out');
  assert.equal(parsed.mode, 'liberation');
  assert.equal(parsed.seed, 424242);
  assert.equal(parsed.parallelWorkers, 1);
  assert.equal(parsed.smokeRuns, 25);
  assert.match(parsed.label, /simulation-profile-stones_cry_out-liberation-1000/);
});

test('parsePprofTopOutput extracts timing rows', () => {
  const sample = `
File: node
Type: cpu
Time: Mar 6, 2026 at 10:00am (UTC)
Duration: 1.20s, Total samples = 1100ms (91.67%)
Showing nodes accounting for 950ms, 86.36% of 1100ms total
Showing top 10 nodes out of 20
      flat  flat%   sum%        cum   cum%
         0     0%     0%     1000ms 90.91%  executeRunChunk
     350ms 31.82% 31.82%      900ms 81.82%  runSingleSimulation
     220ms 20.00% 51.82%      400ms 36.36%  buildStrategyCandidatesForSeat
     180ms 16.36% 68.18%      180ms 16.36%  JSON.stringify
`;

  const table = parsePprofTopOutput(sample);

  assert.equal(table.totalMs, 1100);
  assert.equal(table.entries.length, 4);
  assert.equal(table.entries[0]?.name, 'executeRunChunk');
  assert.equal(table.entries[0]?.flatMs, 0);
  assert.equal(table.entries[0]?.cumulativeMs, 1000);
});

test('grouped findings and quick wins map profile symbols to actions', () => {
  const topEntries = [
    {
      name: 'runSingleSimulation',
      flatMs: 350,
      flatPercent: 31.82,
      cumulativeMs: 900,
      cumulativePercent: 81.82,
    },
    {
      name: 'buildStrategyCandidatesForSeat',
      flatMs: 220,
      flatPercent: 20,
      cumulativeMs: 400,
      cumulativePercent: 36.36,
    },
    {
      name: 'mergeShardFiles',
      flatMs: 120,
      flatPercent: 10.91,
      cumulativeMs: 200,
      cumulativePercent: 18.18,
    },
  ];

  const grouped = buildGroupedFindings(topEntries, topEntries);
  const quickWins = buildQuickWins(topEntries, topEntries);

  assert.equal(grouped[0]?.category, 'simulation-core');
  assert.equal(grouped.some((entry) => entry.category === 'strategy-logic'), true);
  assert.equal(grouped.some((entry) => entry.category === 'output-io'), true);
  assert.equal(quickWins.some((entry) => entry.title.includes('main simulation loop')), true);
  assert.equal(quickWins.some((entry) => entry.title.includes('strategy scoring')), true);
});
