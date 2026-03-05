import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExperimentArmSummary } from '../../src/simulation/experiments/types.ts';
import { choosePrimaryMetricForGate, scoreArmSummary } from '../../src/simulation/optimizer/fitness.ts';

function makeArmSummary(input?: Partial<ExperimentArmSummary>): ExperimentArmSummary {
  return {
    arm: input?.arm ?? 'A',
    n: input?.n ?? 1000,
    wins: input?.wins ?? 300,
    winRate: input?.winRate ?? 0.3,
    publicVictories: input?.publicVictories ?? 500,
    publicVictoryRate: input?.publicVictoryRate ?? 0.5,
    mandateFailuresAmongPublic: input?.mandateFailuresAmongPublic ?? 175,
    mandateFailRateGivenPublic: input?.mandateFailRateGivenPublic ?? 0.35,
    mandateFailureDistribution: input?.mandateFailureDistribution ?? [],
    turns: input?.turns ?? {
      average: 8,
      median: 8,
      p90: 12,
    },
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
  };
}

test('fitness score rewards metrics in target ranges', () => {
  const balanced = makeArmSummary();
  const imbalanced = makeArmSummary({
    winRate: 0.05,
    publicVictoryRate: 0.2,
    mandateFailRateGivenPublic: 0.8,
    turns: {
      average: 3,
      median: 3,
      p90: 5,
    },
  });

  const balancedScore = scoreArmSummary(balanced);
  const imbalancedScore = scoreArmSummary(imbalanced);

  assert.equal(balancedScore.allTargetsInRange, true);
  assert.equal(imbalancedScore.allTargetsInRange, false);
  assert.equal(balancedScore.score > imbalancedScore.score, true);
});

test('fitness applies catastrophe penalties when defeat pressure is high', () => {
  const safe = makeArmSummary();
  const catastrophic = makeArmSummary({
    defeatRates: {
      extraction_breach: 0.62,
      comrades_exhausted: 0.31,
      mandate_failure: 0.05,
      sudden_death: 0.24,
    },
  });

  const safeScore = scoreArmSummary(safe);
  const catastrophicScore = scoreArmSummary(catastrophic);

  assert.equal(catastrophicScore.catastrophePenalty > safeScore.catastrophePenalty, true);
  assert.equal(catastrophicScore.score < safeScore.score, true);
});

test('primary gate metric is chosen from larger win/public target gap', () => {
  const lowWin = scoreArmSummary(makeArmSummary({
    winRate: 0.1,
    publicVictoryRate: 0.5,
  }));
  const lowPublic = scoreArmSummary(makeArmSummary({
    winRate: 0.3,
    publicVictoryRate: 0.2,
  }));

  assert.equal(choosePrimaryMetricForGate(lowWin), 'winRate');
  assert.equal(choosePrimaryMetricForGate(lowPublic), 'publicVictoryRate');
});
