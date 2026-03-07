import test from 'node:test';
import assert from 'node:assert/strict';
import { createArmAccumulator, finalizeArmSummary, ingestArmRecord } from '../../src/simulation/experiments/report.ts';
import type { SimulationRecord } from '../../src/simulation/types.ts';

function makeRecord(input: {
  simulationId: string;
  turnsPlayed: number;
  resultReason: string;
  resultType?: 'victory' | 'defeat';
  successByScore?: boolean;
  publicVictoryAchieved?: boolean;
  collapsedFronts?: number;
}): SimulationRecord {
  const collapsedFronts = input.collapsedFronts ?? 0;
  const fronts = Object.fromEntries(
    Array.from({ length: Math.max(4, collapsedFronts) }, (_, index) => [
      `front_${index + 1}`,
      index < collapsedFronts ? 6 : 2,
    ]),
  );

  return {
    simulationId: input.simulationId,
    scenario: 'stones_cry_out',
    victoryMode: 'liberation',
    playerCount: 4,
    strategies: ['balanced', 'balanced', 'balanced', 'balanced'],
    turnsPlayed: input.turnsPlayed,
    result: {
      type: input.resultType ?? (input.resultReason === 'liberation' ? 'victory' : 'defeat'),
      reason: input.resultReason,
    },
    publicVictoryAchieved: input.publicVictoryAchieved ?? input.resultReason === 'liberation',
    victoryPredicateSatisfiedBeforeAllowedRound: false,
    victoryScore: input.successByScore ? 75 : 40,
    victoryThreshold: 70,
    successByScore: input.successByScore ?? input.resultReason === 'liberation',
    scoreComponentContributions: {},
    mandateFailure: false,
    mandateOutcomeById: {
      failuresByMandate: {},
      successesByMandate: {},
    },
    extractionBreach: input.resultReason === 'extraction_breach',
    comradesExhausted: input.resultReason === 'comrades_exhausted',
    suddenDeath: input.resultReason === 'sudden_death',
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
      fronts,
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

test('arm summary derives early loss and late game rates from round counts', () => {
  const accumulator = createArmAccumulator('A', 123);
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-1', turnsPlayed: 3, resultReason: 'extraction_breach' }));
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-2', turnsPlayed: 4, resultReason: 'comrades_exhausted' }));
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-3', turnsPlayed: 10, resultReason: 'liberation' }));
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-4', turnsPlayed: 16, resultReason: 'sudden_death' }));

  const summary = finalizeArmSummary(accumulator);

  assert.equal(summary.earlyLossRate, 0.5);
  assert.equal(summary.lateGameRate, 0.25);
  assert.equal(summary.successRate, 0.25);
});

test('arm summary computes normalized outcome entropy from terminal outcome buckets', () => {
  const varied = createArmAccumulator('A', 123);
  ingestArmRecord(varied, makeRecord({ simulationId: 'sim-1', turnsPlayed: 4, resultReason: 'extraction_breach' }));
  ingestArmRecord(varied, makeRecord({ simulationId: 'sim-2', turnsPlayed: 8, resultReason: 'comrades_exhausted' }));
  ingestArmRecord(varied, makeRecord({ simulationId: 'sim-3', turnsPlayed: 10, resultReason: 'liberation' }));
  ingestArmRecord(varied, makeRecord({ simulationId: 'sim-4', turnsPlayed: 16, resultReason: 'sudden_death' }));

  const deterministic = createArmAccumulator('A', 456);
  ingestArmRecord(deterministic, makeRecord({ simulationId: 'sim-5', turnsPlayed: 4, resultReason: 'extraction_breach' }));
  ingestArmRecord(deterministic, makeRecord({ simulationId: 'sim-6', turnsPlayed: 4, resultReason: 'extraction_breach' }));
  ingestArmRecord(deterministic, makeRecord({ simulationId: 'sim-7', turnsPlayed: 4, resultReason: 'extraction_breach' }));

  const variedSummary = finalizeArmSummary(varied);
  const deterministicSummary = finalizeArmSummary(deterministic);

  assert.equal(variedSummary.outcomeEntropy, 1);
  assert.equal(deterministicSummary.outcomeEntropy, 0);
});

test('arm summary computes normalized collapse variance for fitness fallback', () => {
  const accumulator = createArmAccumulator('A', 123);
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-1', turnsPlayed: 8, resultReason: 'extraction_breach', collapsedFronts: 0 }));
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-2', turnsPlayed: 8, resultReason: 'extraction_breach', collapsedFronts: 1 }));
  ingestArmRecord(accumulator, makeRecord({ simulationId: 'sim-3', turnsPlayed: 8, resultReason: 'extraction_breach', collapsedFronts: 2 }));

  const summary = finalizeArmSummary(accumulator);

  assert.equal(summary.regionCollapseVariance > 0, true);
  assert.equal(summary.regionCollapseVariance <= 1, true);
});
