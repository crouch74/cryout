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
    averageRoundVictory: 7.2,
    distributionOfVictoryRounds: [],
    progressBeforeVictory: {
      averageExtractionRemoved: 1.2,
    },
  };

  const candidates = await generateCandidatePatches({
    scenarioId: 'stones_cry_out',
    iteration: 1,
    seed: 42,
    targetCount: 10,
    candidateRuns: 200,
    runtime: 'balanced',
    strategyMode: 'full_optimizer',
    analysis: {
      outOfRange: {
        publicVictoryRate: true,
        successRate: true,
        mandateFailRateGivenPublic: true,
        averageTurns: false,
      },
      defeatPressure: {
        extractionBreachRate: 0.4,
        comradesExhaustedRate: 0.2,
        suddenDeathRate: 0.1,
        pressureDetected: true,
      },
      structural: {
        turnOnePublicVictoryRate: 0,
        victoryBeforeAllowedRoundRate: 0,
        earlyTerminationRate: 0,
        noGameplayDetected: false,
        impossibleMandates: [],
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
  assert.equal(
    candidates.some((entry) => entry.patch.victoryScoring?.threshold !== undefined),
    true,
  );
  assert.equal(
    candidates.some((entry) => entry.patch.victoryScoring?.publicVictoryWeight !== undefined),
    true,
  );
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

test('victory gating exploration mode emits victory gate strategies', async () => {
  const candidates = await generateCandidatePatches({
    scenarioId: 'stones_cry_out',
    iteration: 2,
    seed: 42,
    targetCount: 10,
    candidateRuns: 200,
    runtime: 'balanced',
    strategyMode: 'victory_gating_exploration',
    analysis: {
      outOfRange: {
        publicVictoryRate: true,
        successRate: true,
        mandateFailRateGivenPublic: true,
        averageTurns: true,
      },
      defeatPressure: {
        extractionBreachRate: 0.2,
        comradesExhaustedRate: 0.1,
        suddenDeathRate: 0.1,
        pressureDetected: false,
      },
      structural: {
        turnOnePublicVictoryRate: 0.4,
        victoryBeforeAllowedRoundRate: 0.1,
        earlyTerminationRate: 0.2,
        noGameplayDetected: true,
        impossibleMandates: [],
      },
      topMandateFailures: [],
      insights: ['Turn-1 public victories are structurally high; victory gating should be explored.'],
    },
    trajectorySummary: null,
    hillClimbSourcePatch: null,
    balanceSeedOutputDir: '/tmp/optimizer-candidate-tests',
    useBalanceSearchSeeding: false,
  });

  assert.equal(candidates.some((entry) => entry.strategy === 'victory_gating_round'), true);
  assert.equal(candidates.some((entry) => entry.strategy === 'victory_gating_action'), true);
  assert.equal(candidates.some((entry) => entry.strategy === 'victory_gating_progress'), true);
});

test('candidate generator filters unsupported pressure mutations per scenario', async () => {
  const candidates = await generateCandidatePatches({
    scenarioId: 'egypt_1919_revolution',
    iteration: 3,
    seed: 42,
    targetCount: 12,
    candidateRuns: 200,
    runtime: 'balanced',
    strategyMode: 'full_optimizer',
    analysis: {
      outOfRange: {
        publicVictoryRate: true,
        successRate: true,
        mandateFailRateGivenPublic: false,
        averageTurns: true,
      },
      defeatPressure: {
        extractionBreachRate: 0.5,
        comradesExhaustedRate: 0.1,
        suddenDeathRate: 0.2,
        pressureDetected: true,
      },
      structural: {
        turnOnePublicVictoryRate: 0,
        victoryBeforeAllowedRoundRate: 0,
        earlyTerminationRate: 0,
        noGameplayDetected: false,
        impossibleMandates: [],
      },
      topMandateFailures: [],
      insights: ['Average turns are short and may indicate early collapse.'],
    },
    trajectorySummary: null,
    hillClimbSourcePatch: {
      pressure: {
        maxExtractionAddedPerRound: 2,
      },
    },
    balanceSeedOutputDir: '/tmp/optimizer-candidate-tests',
    useBalanceSearchSeeding: false,
  });

  assert.equal(
    candidates.some((entry) => entry.patch.pressure?.crisisSpikeExtractionDelta !== undefined),
    false,
  );
  assert.equal(
    candidates.some((entry) => entry.patch.pressure?.maxExtractionAddedPerRound !== undefined),
    true,
  );
});
