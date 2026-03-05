import test from 'node:test';
import assert from 'node:assert/strict';
import { createArmAccumulator, finalizeArmSummary, ingestArmRecord } from '../../src/simulation/experiments/report.ts';
import type { SimulationRecord } from '../../src/simulation/types.ts';

function makeRecord(input: {
  simulationId: string;
  mandateFailuresById: Record<string, number>;
  mandateSuccessesById: Record<string, number>;
  publicVictoryAchieved?: boolean;
  mandateFailure?: boolean;
}): SimulationRecord {
  return {
    simulationId: input.simulationId,
    scenario: 'base_design',
    victoryMode: 'liberation',
    playerCount: 4,
    strategies: ['balanced', 'balanced', 'balanced', 'balanced'],
    turnsPlayed: 10,
    result: {
      type: 'victory',
      reason: 'liberation',
    },
    publicVictoryAchieved: input.publicVictoryAchieved ?? true,
    victoryPredicateSatisfiedBeforeAllowedRound: false,
    mandateFailure: input.mandateFailure ?? false,
    mandateOutcomeById: {
      failuresByMandate: input.mandateFailuresById,
      successesByMandate: input.mandateSuccessesById,
    },
    extractionBreach: false,
    comradesExhausted: false,
    suddenDeath: false,
    finalState: {
      globalGaze: 10,
      warMachine: 5,
      domains: {
        WarMachine: 0,
        DyingPlanet: 0,
        GildedCage: 0,
        SilencedTruth: 0,
        EmptyStomach: 0,
        FossilGrip: 0,
        StolenVoice: 0,
        RevolutionaryWave: 0,
        PatriarchalGrip: 0,
        UnfinishedJustice: 0,
      },
      fronts: {},
    },
    campaignStats: {
      campaignAttempts: 0,
      campaignSuccess: 0,
      attentionFailures: 0,
      backlashFailures: 0,
    },
    resourceStats: {
      comradesSpent: 0,
      evidenceSpent: 0,
    },
    actionCounts: {
      organize: 0,
      investigate: 0,
      launchCampaign: 0,
      buildSolidarity: 0,
      smuggleEvidence: 0,
      internationalOutreach: 0,
      defend: 0,
    },
    actionCountsExtra: {},
    preDefeatSnapshots: [],
    roundSnapshots: [],
    timeline: [],
  };
}

test('mandate failure distribution aggregates, computes rates, and sorts descending', () => {
  const accumulator = createArmAccumulator('A', 123);

  ingestArmRecord(accumulator, makeRecord({
    simulationId: 'sim-1',
    mandateFailuresById: { protect_workers: 1 },
    mandateSuccessesById: { stop_extraction: 1, protect_land: 1, international_attention: 1 },
  }));
  ingestArmRecord(accumulator, makeRecord({
    simulationId: 'sim-2',
    mandateFailuresById: { protect_workers: 1, international_attention: 1 },
    mandateSuccessesById: { stop_extraction: 1, protect_land: 1 },
  }));
  ingestArmRecord(accumulator, makeRecord({
    simulationId: 'sim-3',
    mandateFailuresById: {},
    mandateSuccessesById: {
      protect_workers: 1,
      stop_extraction: 1,
      protect_land: 1,
      international_attention: 1,
    },
  }));

  const summary = finalizeArmSummary(accumulator);

  assert.deepEqual(
    summary.mandateFailureDistribution.map((entry) => entry.mandateId),
    ['protect_workers', 'international_attention', 'protect_land', 'stop_extraction'],
  );

  const byId = Object.fromEntries(summary.mandateFailureDistribution.map((entry) => [entry.mandateId, entry]));
  assert.equal(byId.protect_workers?.attempts, 3);
  assert.equal(byId.protect_workers?.failureRate, 0.666667);
  assert.equal(byId.protect_workers?.successRate, 0.333333);
  assert.equal(byId.international_attention?.failureRate, 0.333333);
  assert.equal(byId.protect_land?.failureRate, 0);
  assert.equal(byId.stop_extraction?.failureRate, 0);
  assert.equal(summary.publicVictoriesByRoundOne, 0);
  assert.equal(summary.turnOnePublicVictoryRate, 0);
  assert.equal(summary.victoryBeforeAllowedRoundRate, 0);
  assert.equal(summary.earlyTerminationRate, 0);
});
