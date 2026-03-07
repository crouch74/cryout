import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExperimentArmSummary } from '../../src/simulation/experiments/types.ts';
import { choosePrimaryMetricForGate, computeFitness, scoreArmSummary } from '../../src/simulation/optimizer/fitness.ts';

function makeArmSummary(input?: Partial<ExperimentArmSummary>): ExperimentArmSummary {
  return {
    arm: input?.arm ?? 'A',
    n: input?.n ?? 1000,
    successes: input?.successes ?? 400,
    successRate: input?.successRate ?? 0.4,
    earlyLossRate: input?.earlyLossRate ?? 0.03,
    lateGameRate: input?.lateGameRate ?? 0.06,
    outcomeEntropy: input?.outcomeEntropy ?? 0.88,
    regionCollapseVariance: input?.regionCollapseVariance ?? 0.44,
    publicVictories: input?.publicVictories ?? 500,
    publicVictoryRate: input?.publicVictoryRate ?? 0.5,
    successRateGivenPublicVictory: input?.successRateGivenPublicVictory ?? 0.8,
    victoryScoreMean: input?.victoryScoreMean ?? 72,
    victoryScoreMedian: input?.victoryScoreMedian ?? 73,
    victoryScoreP90: input?.victoryScoreP90 ?? 88,
    componentContributionAverages: input?.componentContributionAverages ?? {},
    publicVictoriesByRoundOne: input?.publicVictoriesByRoundOne ?? 20,
    turnOnePublicVictoryRate: input?.turnOnePublicVictoryRate ?? 0.02,
    mandateFailuresAmongPublic: input?.mandateFailuresAmongPublic ?? 100,
    mandateFailRateGivenPublic: input?.mandateFailRateGivenPublic ?? 0.2,
    mandateFailureDistribution: input?.mandateFailureDistribution ?? [],
    turns: input?.turns ?? {
      average: 10.8,
      median: 10,
      p90: 13,
    },
    victoryBeforeAllowedRoundRate: input?.victoryBeforeAllowedRoundRate ?? 0,
    earlyTerminationRate: input?.earlyTerminationRate ?? 0.01,
    defeatReasons: input?.defeatReasons ?? {
      extraction_breach: 200,
      comrades_exhausted: 120,
      mandate_failure: 140,
      sudden_death: 40,
    },
    defeatRates: input?.defeatRates ?? {
      extraction_breach: 0.2,
      comrades_exhausted: 0.12,
      mandate_failure: 0.14,
      sudden_death: 0.04,
    },
    campaign: input?.campaign ?? {
      attempts: 1000,
      success: 520,
      successRate: 0.52,
    },
    reservoirSampleSize: input?.reservoirSampleSize ?? 1000,
    byPlayerCount: input?.byPlayerCount ?? {},
  };
}

test('fitness score is high for near-target balanced scenarios', () => {
  const score = scoreArmSummary(makeArmSummary());

  assert.equal(score.allTargetsInRange, true);
  assert.equal(score.failSafeTriggered, false);
  assert.equal(score.score > 0.85, true);
  assert.equal(score.components.balanceScore > 0.95, true);
});

test('fitness loses pacing and tension when scenarios collapse early', () => {
  const earlyCollapse = scoreArmSummary(makeArmSummary({
    successRate: 0.18,
    earlyLossRate: 0.42,
    lateGameRate: 0.01,
    outcomeEntropy: 0.35,
    turns: {
      average: 4.3,
      median: 4,
      p90: 6,
    },
  }));

  assert.equal(earlyCollapse.allTargetsInRange, false);
  assert.equal(earlyCollapse.components.pacingScore < 0.5, true);
  assert.equal(earlyCollapse.components.tensionScore < 0.75, true);
});

test('fitness loses pacing and tension when scenarios drag too long', () => {
  const overlong = scoreArmSummary(makeArmSummary({
    successRate: 0.41,
    earlyLossRate: 0.01,
    lateGameRate: 0.28,
    outcomeEntropy: 0.72,
    turns: {
      average: 16,
      median: 15,
      p90: 19,
    },
  }));

  assert.equal(overlong.allTargetsInRange, false);
  assert.equal(overlong.components.pacingScore, 0.75);
  assert.equal(overlong.components.tensionScore < 0.95, true);
});

test('fitness prefers diverse outcomes over deterministic ones', () => {
  const deterministic = scoreArmSummary(makeArmSummary({
    outcomeEntropy: 0.04,
    regionCollapseVariance: 0.08,
  }));
  const varied = scoreArmSummary(makeArmSummary({
    outcomeEntropy: 0.81,
    regionCollapseVariance: 0.44,
  }));

  assert.equal(varied.components.varianceScore > deterministic.components.varianceScore, true);
  assert.equal(varied.score > deterministic.score, true);
});

test('fitness falls back to region collapse variance when entropy is unavailable', () => {
  const score = computeFitness({
    winRate: 0.4,
    avgRounds: 10,
    earlyLossRate: 0.02,
    lateGameRate: 0.04,
    outcomeEntropy: 0,
    regionCollapseVariance: 0.67,
  });

  assert.equal(score.components.varianceScore, 0.67);
});

test('fitness fail-safe rejects clearly broken win rates', () => {
  const unwinnable = computeFitness({
    winRate: 0.08,
    avgRounds: 10,
    earlyLossRate: 0.02,
    lateGameRate: 0.03,
    outcomeEntropy: 0.9,
    regionCollapseVariance: 0.7,
  });
  const trivial = computeFitness({
    winRate: 0.82,
    avgRounds: 10,
    earlyLossRate: 0.02,
    lateGameRate: 0.03,
    outcomeEntropy: 0.9,
    regionCollapseVariance: 0.7,
  });

  assert.equal(unwinnable.failSafeTriggered, true);
  assert.equal(unwinnable.score, 0);
  assert.equal(trivial.failSafeTriggered, true);
  assert.equal(trivial.score, 0);
});

test('primary gate metric remains success rate', () => {
  assert.equal(choosePrimaryMetricForGate(), 'successRate');
});
