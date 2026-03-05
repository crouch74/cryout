import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrajectorySummary } from '../../src/simulation/trajectory/types.ts';
import {
  generateCandidatePatches,
  isScenarioPatchEmpty,
  normalizeScenarioPatch,
} from '../../src/simulation/optimizer/candidates.ts';

test('candidate generator builds deterministic candidate count with dedup', async () => {
  const trajectorySummary: TrajectorySummary = {
    totalTrajectories: 25,
    averageTurnsToVictory: 7.2,
    averageExtractionRemovedBeforeVictory: 1.2,
    mostCommonFirstAction: {
      action: 'Investigate',
      count: 10,
      rate: 0.4,
    },
    mostCommonActionSequence: {
      sequence: 'investigate > organize > launch_campaign',
      count: 5,
      rate: 0.2,
    },
    topFirstActions: [],
    topActionSequences: [],
  };

  const candidates = await generateCandidatePatches({
    scenarioId: 'base_design',
    iteration: 1,
    seed: 42,
    targetCount: 10,
    candidateRuns: 200,
    runtime: 'balanced',
    analysis: {
      outOfRange: {
        publicVictoryRate: true,
        winRate: true,
        mandateFailRateGivenPublic: true,
        averageTurns: false,
      },
      defeatPressure: {
        extractionBreachRate: 0.4,
        comradesExhaustedRate: 0.2,
        suddenDeathRate: 0.1,
        pressureDetected: true,
      },
      topMandateFailures: [],
      insights: ['Average turns are short and may indicate early collapse.'],
    },
    trajectorySummary,
    hillClimbSourcePatch: {
      setup: {
        globalGazeDelta: 1,
      },
    },
    balanceSeedOutputDir: '/tmp/optimizer-candidate-tests',
    useBalanceSearchSeeding: false,
  });

  assert.equal(candidates.length, 10);
  assert.equal(new Set(candidates.map((entry) => entry.candidateId)).size, 10);
  assert.equal(candidates.some((entry) => entry.strategy === 'trajectory_guided'), true);
});

test('patch normalization prunes zero deltas and empty branches', () => {
  const normalized = normalizeScenarioPatch({
    note: 'test',
    setup: {
      globalGazeDelta: 0,
      seededExtractionTotalDelta: -1,
    },
    pressure: {
      crisisSpikeExtractionDelta: 0,
    },
  });

  assert.deepEqual(normalized, {
    note: 'test',
    setup: {
      seededExtractionTotalDelta: -1,
    },
  });
  assert.equal(isScenarioPatchEmpty(normalized), false);
  assert.equal(isScenarioPatchEmpty(normalizeScenarioPatch({ note: 'noop' })), true);
});
