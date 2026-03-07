import type { ExperimentArmSummary } from '../experiments/types.ts';
import type { OptimizerFitnessMetrics, OptimizerScoreBreakdown, OptimizerTargetScore } from './types.ts';

interface TargetRange {
  min: number;
  max: number;
}

const TARGET_RANGES = {
  winRate: { min: 0.35, max: 0.45 },
  avgRounds: { min: 9, max: 12 },
  earlyLossRate: { min: 0, max: 0.05 },
  lateGameRate: { min: 0, max: 0.10 },
} as const satisfies Record<OptimizerTargetScore['metric'], TargetRange>;

function roundTo(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function evaluateTarget(metric: OptimizerTargetScore['metric'], value: number, range: TargetRange): OptimizerTargetScore {
  const span = Math.max(1e-9, range.max - range.min);
  let distance = 0;
  if (value < range.min) {
    distance = range.min - value;
  } else if (value > range.max) {
    distance = value - range.max;
  }

  return {
    metric,
    value: roundTo(value),
    min: range.min,
    max: range.max,
    inRange: distance === 0,
    distanceFromRange: roundTo(distance),
    normalizedScore: roundTo(clamp(1 - (distance / span), 0, 1)),
  };
}

function computeBalanceScore(winRate: number) {
  return roundTo(clamp(1 - (Math.abs(winRate - 0.40) / 0.40), 0, 1));
}

function computePacingScore(avgRounds: number) {
  if (avgRounds < 9) {
    return roundTo(clamp(avgRounds / 9, 0, 1));
  }
  if (avgRounds > 12) {
    return roundTo(clamp(12 / avgRounds, 0, 1));
  }
  return 1;
}

function computeTensionScore(earlyLossRate: number, lateGameRate: number) {
  return roundTo(clamp(1 - (earlyLossRate * 0.7) - (lateGameRate * 0.3), 0, 1));
}

function computeVarianceScore(outcomeEntropy: number, regionCollapseVariance: number) {
  if (outcomeEntropy > 0) {
    return roundTo(clamp(outcomeEntropy, 0, 1));
  }
  return roundTo(clamp(regionCollapseVariance, 0, 1));
}

function computeActionBalanceScore(
  actionEntropy: number,
  actionConcentration: number,
  targetedActionShare: number,
  winningTargetedActionShare: number,
) {
  const entropyScore = clamp(actionEntropy, 0, 1);
  const concentrationScore = clamp(1 - Math.max(0, actionConcentration - 0.26) / 0.5, 0, 1);
  const targetedShareScore = clamp(targetedActionShare / 0.42, 0, 1);
  const winningShareScore = clamp(winningTargetedActionShare / 0.38, 0, 1);

  return roundTo(
    (0.30 * entropyScore)
    + (0.30 * concentrationScore)
    + (0.25 * targetedShareScore)
    + (0.15 * winningShareScore),
  );
}

function computeTrajectoryPathScore(
  setupDependentCampaignRate: number,
  failurePathPenalty: number,
  regimeWeightedTargetedShare: number,
) {
  const setupScore = clamp(setupDependentCampaignRate / 0.65, 0, 1);
  const failureAvoidanceScore = clamp(1 - failurePathPenalty, 0, 1);
  const regimeScore = clamp(regimeWeightedTargetedShare / 0.40, 0, 1);

  return roundTo(
    (0.35 * setupScore)
    + (0.40 * failureAvoidanceScore)
    + (0.25 * regimeScore),
  );
}

export function computeFitness(simulationResults: OptimizerFitnessMetrics): OptimizerScoreBreakdown {
  const metrics = {
    winRate: roundTo(simulationResults.winRate),
    avgRounds: roundTo(simulationResults.avgRounds),
    earlyLossRate: roundTo(simulationResults.earlyLossRate),
    lateGameRate: roundTo(simulationResults.lateGameRate),
    outcomeEntropy: roundTo(simulationResults.outcomeEntropy),
    regionCollapseVariance: roundTo(simulationResults.regionCollapseVariance),
    actionEntropy: roundTo(simulationResults.actionEntropy),
    actionConcentration: roundTo(simulationResults.actionConcentration),
    targetedActionShare: roundTo(simulationResults.targetedActionShare),
    winningTargetedActionShare: roundTo(simulationResults.winningTargetedActionShare),
    setupDependentCampaignRate: roundTo(simulationResults.setupDependentCampaignRate),
    failurePathPenalty: roundTo(simulationResults.failurePathPenalty),
    regimeWeightedTargetedShare: roundTo(simulationResults.regimeWeightedTargetedShare),
  };

  const failSafeTriggered = metrics.winRate < 0.10 || metrics.winRate > 0.80;
  const balanceScore = failSafeTriggered ? 0 : computeBalanceScore(metrics.winRate);
  const pacingScore = failSafeTriggered ? 0 : computePacingScore(metrics.avgRounds);
  const tensionScore = failSafeTriggered ? 0 : computeTensionScore(metrics.earlyLossRate, metrics.lateGameRate);
  const varianceScore = failSafeTriggered ? 0 : computeVarianceScore(metrics.outcomeEntropy, metrics.regionCollapseVariance);
  const actionBalanceScore = failSafeTriggered
    ? 0
    : computeActionBalanceScore(
      metrics.actionEntropy,
      metrics.actionConcentration,
      metrics.targetedActionShare,
      metrics.winningTargetedActionShare,
    );
  const trajectoryPathScore = failSafeTriggered
    ? 0
    : computeTrajectoryPathScore(
      metrics.setupDependentCampaignRate,
      metrics.failurePathPenalty,
      metrics.regimeWeightedTargetedShare,
    );

  const targets = {
    winRate: evaluateTarget('winRate', metrics.winRate, TARGET_RANGES.winRate),
    avgRounds: evaluateTarget('avgRounds', metrics.avgRounds, TARGET_RANGES.avgRounds),
    earlyLossRate: evaluateTarget('earlyLossRate', metrics.earlyLossRate, TARGET_RANGES.earlyLossRate),
    lateGameRate: evaluateTarget('lateGameRate', metrics.lateGameRate, TARGET_RANGES.lateGameRate),
  };

  const score = failSafeTriggered
    ? 0
    : roundTo(
      (0.33 * balanceScore)
      + (0.24 * pacingScore)
      + (0.18 * tensionScore)
      + (0.15 * varianceScore)
      + (0.06 * actionBalanceScore)
      + (0.04 * trajectoryPathScore),
    );

  return {
    score,
    failSafeTriggered,
    components: {
      balanceScore,
      pacingScore,
      tensionScore,
      varianceScore,
      actionBalanceScore,
      trajectoryPathScore,
    },
    metrics,
    targets,
    allTargetsInRange: targets.winRate.inRange
      && targets.avgRounds.inRange
      && targets.earlyLossRate.inRange
      && targets.lateGameRate.inRange,
  };
}

export function scoreArmSummary(arm: ExperimentArmSummary): OptimizerScoreBreakdown {
  return computeFitness({
    winRate: arm.successRate,
    avgRounds: arm.turns.average,
    earlyLossRate: arm.earlyLossRate,
    lateGameRate: arm.lateGameRate,
    outcomeEntropy: arm.outcomeEntropy,
    regionCollapseVariance: arm.regionCollapseVariance,
    actionEntropy: arm.actionBalance.entropy,
    actionConcentration: arm.actionBalance.concentration,
    targetedActionShare: arm.actionBalance.targetedShare,
    winningTargetedActionShare: arm.actionBalance.winningTargetedShare,
    setupDependentCampaignRate: arm.actionBalance.setupDependentCampaignRate,
    failurePathPenalty: arm.actionBalance.failurePathPenalty,
    regimeWeightedTargetedShare: arm.actionBalance.regimeWeightedTargetedShare,
  });
}

export function getTargetRange(metric: OptimizerTargetScore['metric']) {
  return TARGET_RANGES[metric];
}

export function choosePrimaryMetricForGate(): 'successRate' {
  return 'successRate';
}

export function directionTowardRange(value: number, range: TargetRange): 'increase' | 'decrease' | 'inside' {
  if (value < range.min) {
    return 'increase';
  }
  if (value > range.max) {
    return 'decrease';
  }
  return 'inside';
}

export function movedTowardRange(before: number, after: number, range: TargetRange) {
  const distanceBefore = before < range.min
    ? range.min - before
    : (before > range.max ? before - range.max : 0);
  const distanceAfter = after < range.min
    ? range.min - after
    : (after > range.max ? after - range.max : 0);
  return distanceAfter < distanceBefore;
}
