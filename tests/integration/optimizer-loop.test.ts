import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScenarioOptimizer } from '../../src/simulation/optimizer/engine.ts';
import type { ScenarioPatch } from '../../src/simulation/experiments/patchDsl.ts';

test('scenario optimizer writes iteration artifacts and final recommendation', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'stones-optimizer-'));

  const report = await runScenarioOptimizer({
    scenarioId: 'base_design',
    iterations: 1,
    baselineRuns: 2,
    candidateRuns: 2,
    candidates: 2,
    patience: 1,
    seed: 2026,
    parallelWorkers: 1,
    outDir: outputRoot,
    runtime: 'balanced',
    significance: 'balanced',
    mode: 'liberation',
    strategy: 'full_optimizer',
    victoryModes: ['liberation'],
    playerCounts: [2, 3, 4],
    useBalanceSearchSeeding: false,
  });

  assert.equal(report.scenarioId, 'base_design');
  assert.equal(report.history.length >= 1, true);

  await stat(join(report.outputDir, 'optimizer_config.json'));
  await stat(join(report.outputDir, 'optimization_history.json'));
  await stat(join(report.outputDir, 'accepted_patch_history.json'));
  await stat(join(report.outputDir, 'recommended_patch.json'));
  await stat(join(report.outputDir, 'final_metrics.json'));
  await stat(join(report.outputDir, 'final_report.md'));

  await stat(join(report.outputDir, 'iteration_01', 'baseline_summary.json'));
  await stat(join(report.outputDir, 'iteration_01', 'analysis.json'));
  await stat(join(report.outputDir, 'iteration_01', 'trajectory_summary.json'));
  await stat(join(report.outputDir, 'iteration_01', 'victory_trajectory_analysis.json'));
  await stat(join(report.outputDir, 'iteration_01', 'candidate_patches.json'));
  await stat(join(report.outputDir, 'iteration_01', 'candidate_rankings.json'));
  await stat(join(report.outputDir, 'iteration_01', 'selected_candidate.json'));

  const recommendedPatch = JSON.parse(
    await readFile(join(report.outputDir, 'recommended_patch.json'), 'utf8'),
  ) as ScenarioPatch;
  assert.equal(typeof recommendedPatch, 'object');

  const finalMetrics = JSON.parse(
    await readFile(join(report.outputDir, 'final_metrics.json'), 'utf8'),
  ) as { score: { score: number } };
  assert.equal(typeof finalMetrics.score.score, 'number');
});
