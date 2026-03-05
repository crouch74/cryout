import type { ExperimentArmSummary } from '../experiments/types.ts';
import type { OptimizerScoreBreakdown, OptimizerTargetScore } from './types.ts';

interface TargetRange {
  min: number;
  max: number;
}

const TARGET_RANGES = {
  publicVictoryRate: { min: 0.4, max: 0.6 },
  winRate: { min: 0.25, max: 0.4 },
  mandateFailRateGivenPublic: { min: 0.3, max: 0.4 },
  averageTurns: { min: 6, max: 10 },
} as const satisfies Record<string, TargetRange>;

const CATASTROPHE_THRESHOLDS = {
  extraction_breach: 0.35,
  comrades_exhausted: 0.2,
  sudden_death: 0.12,
} as const;

function roundTo(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function evaluateTarget(metric: OptimizerTargetScore['metric'], value: number, range: TargetRange): OptimizerTargetScore {
  const span = Math.max(1e-9, range.max - range.min);
  let distance = 0;
  if (value < range.min) {
    distance = range.min - value;
  } else if (value > range.max) {
    distance = value - range.max;
  }
  const normalizedDistance = distance / span;
  const normalizedScore = Math.max(0, 1 - normalizedDistance);
  return {
    metric,
    value: roundTo(value),
    min: range.min,
    max: range.max,
    inRange: distance === 0,
    distanceFromRange: roundTo(distance),
    normalizedScore: roundTo(normalizedScore),
  };
}

function computeCatastrophePenalty(arm: ExperimentArmSummary) {
  let penalty = 0;

  const extractionOver = Math.max(0, arm.defeatRates.extraction_breach - CATASTROPHE_THRESHOLDS.extraction_breach);
  const comradesOver = Math.max(0, arm.defeatRates.comrades_exhausted - CATASTROPHE_THRESHOLDS.comrades_exhausted);
  const suddenOver = Math.max(0, arm.defeatRates.sudden_death - CATASTROPHE_THRESHOLDS.sudden_death);

  // Weight extraction collapse highest because it represents runaway systemic pressure.
  penalty += extractionOver * 1.15;
  penalty += comradesOver * 0.9;
  penalty += suddenOver * 1.1;

  return roundTo(Math.max(0, penalty));
}

export function scoreArmSummary(arm: ExperimentArmSummary): OptimizerScoreBreakdown {
  const publicVictoryRate = evaluateTarget('publicVictoryRate', arm.publicVictoryRate, TARGET_RANGES.publicVictoryRate);
  const winRate = evaluateTarget('winRate', arm.winRate, TARGET_RANGES.winRate);
  const mandateFailRateGivenPublic = evaluateTarget(
    'mandateFailRateGivenPublic',
    arm.mandateFailRateGivenPublic,
    TARGET_RANGES.mandateFailRateGivenPublic,
  );
  const averageTurns = evaluateTarget('averageTurns', arm.turns.average, TARGET_RANGES.averageTurns);

  const catastrophePenalty = computeCatastrophePenalty(arm);
  const scoreWithoutPenalty = (
    publicVictoryRate.normalizedScore
    + winRate.normalizedScore
    + mandateFailRateGivenPublic.normalizedScore
    + averageTurns.normalizedScore
  ) / 4;

  return {
    score: roundTo(scoreWithoutPenalty - catastrophePenalty),
    catastrophePenalty,
    targets: {
      publicVictoryRate,
      winRate,
      mandateFailRateGivenPublic,
      averageTurns,
    },
    allTargetsInRange: publicVictoryRate.inRange
      && winRate.inRange
      && mandateFailRateGivenPublic.inRange
      && averageTurns.inRange,
  };
}

export function getTargetRange(metric: OptimizerTargetScore['metric']) {
  return TARGET_RANGES[metric];
}

export function choosePrimaryMetricForGate(score: OptimizerScoreBreakdown): 'winRate' | 'publicVictoryRate' {
  const winGap = score.targets.winRate.distanceFromRange;
  const publicGap = score.targets.publicVictoryRate.distanceFromRange;
  return winGap >= publicGap ? 'winRate' : 'publicVictoryRate';
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
