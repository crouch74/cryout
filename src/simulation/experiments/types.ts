import type { ScenarioPatch } from './patchDsl.ts';
import type { MandateFailureDistribution } from '../metrics/types.ts';

export type VictoryMode = 'liberation' | 'symbolic';

export type ExperimentArm = 'A' | 'B';

export type ExperimentMetricKey =
  | 'successRate'
  | 'publicVictoryRate'
  | 'successRateGivenPublicVictory'
  | 'victoryScoreMean'
  | 'victoryScoreMedian'
  | 'victoryScoreP90'
  | 'mandateFailRateGivenPublic'
  | 'avgTurns'
  | 'medianTurns'
  | 'p90Turns'
  | 'defeat_extraction_breach'
  | 'defeat_comrades_exhausted'
  | 'defeat_mandate_failure'
  | 'defeat_sudden_death'
  | 'campaignSuccessRate';

export type Decision = 'KEEP' | 'REJECT' | 'NEEDS_MORE_DATA';

export type DecisionRule = {
  primary: 'successRate' | 'publicVictoryRate';
  minLift: number;
  guardrails?: Array<{
    metric: ExperimentMetricKey;
    maxRegression: number;
  }>;
  requireImprovedMetricsCount?: number;
  confidence?: 0.9 | 0.95 | 0.99;
};

export type ExperimentDefinition = {
  id: string;
  title: string;
  scenarioId: string;
  victoryModes: VictoryMode[];
  runsPerArm: number;
  playerCounts: number[];
  seed: number;
  patch: ScenarioPatch;
  expectedEffects: Partial<Record<ExperimentMetricKey, string>>;
  decisionRule: DecisionRule;
};

/** Compact balance summary for a single player count bucket. */
export interface PlayerCountSummary {
  playerCount: number;
  n: number;
  successRate: number;
  publicVictoryRate: number;
  earlyTerminationRate: number;
  turns: {
    average: number;
    median: number;
  };
  defeatRates: {
    extraction_breach: number;
    comrades_exhausted: number;
    mandate_failure: number;
    sudden_death: number;
  };
}

export interface ExperimentArmSummary {
  arm: ExperimentArm;
  n: number;
  successes: number;
  successRate: number;
  earlyLossRate: number;
  lateGameRate: number;
  outcomeEntropy: number;
  regionCollapseVariance: number;
  publicVictories: number;
  publicVictoryRate: number;
  successRateGivenPublicVictory: number;
  victoryScoreMean: number;
  victoryScoreMedian: number;
  victoryScoreP90: number;
  componentContributionAverages: Record<string, number>;
  mandateFailuresAmongPublic: number;
  mandateFailRateGivenPublic: number;
  publicVictoriesByRoundOne: number;
  turnOnePublicVictoryRate: number;
  victoryBeforeAllowedRoundRate: number;
  earlyTerminationRate: number;
  mandateFailureDistribution: MandateFailureDistribution[];
  turns: {
    average: number;
    median: number;
    p90: number;
  };
  defeatReasons: {
    extraction_breach: number;
    comrades_exhausted: number;
    mandate_failure: number;
    sudden_death: number;
  };
  defeatRates: {
    extraction_breach: number;
    comrades_exhausted: number;
    mandate_failure: number;
    sudden_death: number;
  };
  campaign: {
    attempts: number;
    success: number;
    successRate: number;
  };
  reservoirSampleSize: number;
  /** Per-player-count breakdowns (keyed by player count as a string, e.g. "2", "3", "4"). */
  byPlayerCount: Record<string, PlayerCountSummary>;
}

export interface ProportionComparisonStats {
  confidence: 0.9 | 0.95 | 0.99;
  zScore: number;
  pValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

export interface MetricDelta {
  metric: ExperimentMetricKey;
  armA: number;
  armB: number;
  absoluteLift: number;
  relativeLift: number;
  proportionStats?: ProportionComparisonStats;
}

export interface MetricComparison {
  confidence: 0.9 | 0.95 | 0.99;
  nA: number;
  nB: number;
  metrics: Record<ExperimentMetricKey, MetricDelta>;
}

export interface ExperimentRecommendation {
  decision: Decision;
  rationale: string[];
  primaryMetric: 'successRate' | 'publicVictoryRate';
}

export interface StructuralMandateDiagnostic {
  arm: ExperimentArm;
  mandateId: string;
  failureRate: number;
  attempts: number;
}

export interface StructuralDiagnostics {
  turnOneVictoryWarning: boolean;
  victoryPredicateSatisfiedBeforeAllowedRoundWarning: boolean;
  earlyTerminationWarning: boolean;
  noGameplayWarning: boolean;
  publicVictoryHighButSuccessLowWarning: boolean;
  unreachableThresholdWarning: boolean;
  impossibleMandates: StructuralMandateDiagnostic[];
  summary: string[];
}

export interface ExperimentResult {
  definition: ExperimentDefinition;
  outputDir: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  armA: ExperimentArmSummary;
  armB: ExperimentArmSummary;
  comparison: MetricComparison;
  recommendation: ExperimentRecommendation;
  structuralDiagnostics?: StructuralDiagnostics;
}

export interface SingleArmExperimentResult {
  definition: ExperimentDefinition;
  outputDir: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  arm: ExperimentArmSummary;
  armLabel: ExperimentArm;
  metadata: {
    cached?: boolean;
    baselinePatchApplied: boolean;
  };
}
