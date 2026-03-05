import type { ScenarioPatch } from './patchDsl.ts';
import type { MandateFailureDistribution } from '../metrics/types.ts';

export type VictoryMode = 'liberation' | 'symbolic';

export type ExperimentArm = 'A' | 'B';

export type ExperimentMetricKey =
  | 'winRate'
  | 'publicVictoryRate'
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
  primary: 'winRate' | 'publicVictoryRate';
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

export interface ExperimentArmSummary {
  arm: ExperimentArm;
  n: number;
  wins: number;
  winRate: number;
  publicVictories: number;
  publicVictoryRate: number;
  mandateFailuresAmongPublic: number;
  mandateFailRateGivenPublic: number;
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
  primaryMetric: 'winRate' | 'publicVictoryRate';
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
}
