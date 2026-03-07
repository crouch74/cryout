import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExperiment, runSingleArmExperiment } from '../../src/simulation/experiments/runner.ts';
import { getExperimentById } from '../../src/simulation/experiments/hypotheses/backlog.ts';
import type { ExperimentArmSummary } from '../../src/simulation/experiments/types.ts';
import { runBalanceSearch } from '../../src/simulation/balance/SearchEngine.ts';

test('experiment output includes mandate diagnostics in arm summaries, comparison json, and markdown report', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'stones-exp-lab-'));
  const definition = getExperimentById('stones_cry_out_new_baseline_validation');
  assert.ok(definition);

  await runExperiment({
    ...definition,
    runsPerArm: 3,
    seed: 777,
  }, {
    outDir: outputRoot,
    recordTrajectories: false,
    parallelWorkers: 1,
  });

  const experimentDir = join(outputRoot, definition.id);
  const armA = JSON.parse(await readFile(join(experimentDir, 'arm_A_summary.json'), 'utf8')) as ExperimentArmSummary;
  const armB = JSON.parse(await readFile(join(experimentDir, 'arm_B_summary.json'), 'utf8')) as ExperimentArmSummary;
  const comparison = JSON.parse(await readFile(join(experimentDir, 'comparison.json'), 'utf8')) as Record<string, unknown>;
  const diagnostics = JSON.parse(await readFile(join(experimentDir, 'structural_diagnostics.json'), 'utf8')) as {
    turnOneVictoryWarning: boolean;
    victoryPredicateSatisfiedBeforeAllowedRoundWarning: boolean;
    earlyTerminationWarning: boolean;
    noGameplayWarning: boolean;
  };
  const report = await readFile(join(experimentDir, 'report.md'), 'utf8');

  assert.equal(Array.isArray(armA.mandateFailureDistribution), true);
  assert.equal(Array.isArray(armB.mandateFailureDistribution), true);
  assert.equal(typeof comparison.armA, 'object');
  assert.equal(typeof comparison.armB, 'object');
  assert.equal(typeof diagnostics.turnOneVictoryWarning, 'boolean');
  assert.equal(typeof diagnostics.victoryPredicateSatisfiedBeforeAllowedRoundWarning, 'boolean');
  assert.equal(typeof diagnostics.earlyTerminationWarning, 'boolean');
  assert.equal(typeof diagnostics.noGameplayWarning, 'boolean');
  assert.match(report, /Mandate Failure Ranking \(Arm A\)/);
  assert.match(report, /Mandate Failure Ranking \(Arm B\)/);
});

test('single-arm experiment matches arm B summary for the same definition and seed', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'stones-exp-single-arm-'));
  const definition = getExperimentById('stones_cry_out_new_baseline_validation');
  assert.ok(definition);

  const experiment = await runExperiment({
    ...definition,
    runsPerArm: 3,
    seed: 1777,
  }, {
    outDir: outputRoot,
    recordTrajectories: false,
    parallelWorkers: 1,
  });

  const singleArm = await runSingleArmExperiment({
    ...definition,
    id: `${definition.id}_single_arm`,
    runsPerArm: 3,
    seed: 1777,
  }, {
    outDir: outputRoot,
    recordTrajectories: false,
    parallelWorkers: 1,
    armLabel: 'B',
  });

  assert.deepEqual(singleArm.arm, experiment.armB);
});

test('balance search writes best_candidates.json with ordered top candidates', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'stones-balance-lab-'));
  const result = await runBalanceSearch({
    scenarioId: 'stones_cry_out',
    iterations: 2,
    runsPerCandidate: 2,
    seed: 123,
    outputDir: outputRoot,
    topN: 10,
  });

  const saved = JSON.parse(await readFile(join(outputRoot, 'best_candidates.json'), 'utf8')) as {
    bestCandidates: Array<{ score: number }>;
  };

  assert.equal(result.bestCandidates.length > 0, true);
  assert.equal(saved.bestCandidates.length > 0, true);
  for (let index = 1; index < saved.bestCandidates.length; index += 1) {
    assert.equal(saved.bestCandidates[index - 1].score >= saved.bestCandidates[index].score, true);
  }
});
