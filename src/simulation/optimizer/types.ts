import type { ScenarioPatch } from '../experiments/patchDsl.ts';
import type { ExperimentArmSummary, MetricComparison } from '../experiments/types.ts';
import type { TrajectorySummary } from '../trajectory/types.ts';
import type { VictoryMode } from '../experiments/types.ts';
import type { GaConfig } from './ga/types.ts';

export type OptimizerRuntimeProfile = 'fast' | 'balanced' | 'thorough';
export type OptimizerSignificanceMode = 'strict' | 'balanced' | 'lenient';
export type OptimizerMode = 'liberation' | 'symbolic' | 'both';
export type OptimizerExecutionMode = 'single_scenario' | 'all_scenarios_parallel';
/**
 * Controls whether the optimizer uses the existing hill-climbing approach
 * (local), a pure GA evolutionary search (evolutionary), or a hybrid that
 * combines both exploration strategies (hybrid — default when GA is active).
 */
export type OptimizerSearchMode = 'local' | 'evolutionary' | 'hybrid';
export type OptimizerStrategyMode =
  | 'numeric_balancing'
  | 'victory_gating_exploration'
  | 'trajectory_discovery'
  | 'full_optimizer';

export type OptimizerCandidateStrategy =
  | 'random'
  | 'hill_climb'
  | 'trajectory_guided'
  | 'parameter_sweep'
  | 'balance_seed'
  | 'victory_gating_round'
  | 'victory_gating_action'
  | 'victory_gating_progress'
  | 'evolutionary';

export interface OptimizerConfig {
  scenarioId: string;
  iterations: number;
  baselineRuns: number;
  candidateRuns: number;
  candidates: number;
  patience: number;
  seed: number;
  parallelWorkers: number;
  outDir: string;
  executionMode: OptimizerExecutionMode;
  runtime: OptimizerRuntimeProfile;
  significance: OptimizerSignificanceMode;
  mode: OptimizerMode;
  strategy: OptimizerStrategyMode;
  victoryModes: VictoryMode[];
  playerCounts: number[];
  useBalanceSearchSeeding?: boolean;
  /** Controls whether the GA exploration phase is active. Default: 'local'. */
  searchMode?: OptimizerSearchMode;
  /** GA parameters, used when searchMode is 'evolutionary' or 'hybrid'. */
  gaConfig?: GaConfig;
}

export interface OptimizerTargetScore {
  metric: 'winRate' | 'avgRounds' | 'earlyLossRate' | 'lateGameRate';
  value: number;
  min: number;
  max: number;
  inRange: boolean;
  distanceFromRange: number;
  normalizedScore: number;
}

export interface OptimizerFitnessComponents {
  balanceScore: number;
  pacingScore: number;
  tensionScore: number;
  varianceScore: number;
}

export interface OptimizerFitnessMetrics {
  winRate: number;
  avgRounds: number;
  earlyLossRate: number;
  lateGameRate: number;
  outcomeEntropy: number;
  regionCollapseVariance: number;
}

export interface OptimizerScoreBreakdown {
  score: number;
  failSafeTriggered: boolean;
  components: OptimizerFitnessComponents;
  metrics: OptimizerFitnessMetrics;
  targets: {
    winRate: OptimizerTargetScore;
    avgRounds: OptimizerTargetScore;
    earlyLossRate: OptimizerTargetScore;
    lateGameRate: OptimizerTargetScore;
  };
  allTargetsInRange: boolean;
}

export interface OptimizerAnalysis {
  outOfRange: {
    winRate: boolean;
    avgRounds: boolean;
    earlyLossRate: boolean;
    lateGameRate: boolean;
  };
  defeatPressure: {
    extractionBreachRate: number;
    comradesExhaustedRate: number;
    suddenDeathRate: number;
    pressureDetected: boolean;
  };
  topMandateFailures: Array<{
    mandateId: string;
    failureRate: number;
    attempts: number;
  }>;
  structural: {
    turnOnePublicVictoryRate: number;
    victoryBeforeAllowedRoundRate: number;
    earlyTerminationRate: number;
    noGameplayDetected: boolean;
    impossibleMandates: string[];
  };
  insights: string[];
}

export interface OptimizerCandidate {
  candidateId: string;
  strategy: OptimizerCandidateStrategy;
  patch: ScenarioPatch;
}

export interface OptimizerGateDecision {
  accepted: boolean;
  primaryMetric: 'successRate' | 'publicVictoryRate';
  statisticallyMeaningful: boolean;
  fitnessLiftPassed: boolean;
  guardrailsPassed: boolean;
  movedTowardTarget: boolean;
  reasons: string[];
}

export interface OptimizerCandidateEvaluation {
  candidateId: string;
  strategy: OptimizerCandidateStrategy;
  experimentId: string;
  outputDir: string;
  patch: ScenarioPatch;
  metrics: ExperimentArmSummary;
  comparison: MetricComparison;
  scoreBreakdown: OptimizerScoreBreakdown;
  scoreDeltaFromBaseline: number;
  gate: OptimizerGateDecision;
}

export interface OptimizerIterationResult {
  iteration: number;
  baselineScenarioId: string;
  baselineExperimentId: string;
  baselineMetrics: ExperimentArmSummary;
  baselineScore: OptimizerScoreBreakdown;
  analysis: OptimizerAnalysis;
  trajectorySummary: TrajectorySummary | null;
  candidateCount: number;
  rankings: OptimizerCandidateEvaluation[];
  selectedCandidate: OptimizerCandidateEvaluation | null;
  acceptedCandidate: OptimizerCandidateEvaluation | null;
  noImprovementStreak: number;
}

export type OptimizerStopReason =
  | 'targets_reached'
  | 'no_significant_improvement'
  | 'max_iterations_reached';

export interface OptimizerFinalMetrics {
  scenarioId: string;
  baselineScenarioId: string;
  experimentId: string;
  metrics: ExperimentArmSummary;
  score: OptimizerScoreBreakdown;
}

export interface OptimizerFinalReport {
  scenarioId: string;
  outputDir: string;
  stopReason: OptimizerStopReason;
  iterationsCompleted: number;
  acceptedPatches: Array<{
    iteration: number;
    candidateId: string;
    strategy: OptimizerCandidateStrategy;
    score: number;
    scoreDeltaFromBaseline: number;
    patch: ScenarioPatch;
  }>;
  recommendedPatch: ScenarioPatch;
  finalMetrics: OptimizerFinalMetrics;
  history: OptimizerIterationResult[];
}

export interface AllScenariosParallelScenarioSummary {
  scenarioId: string;
  scenarioName: string;
  outputDir: string;
  stopReason: OptimizerStopReason;
  iterationsCompleted: number;
  acceptedPatches: number;
  finalScore: number;
}

export interface AllScenariosParallelErrorSummary {
  scenarioId: string;
  scenarioName: string;
  error: string;
}

export interface AllScenariosParallelReport {
  generatedAt: string;
  outputDir: string;
  victoryModes: VictoryMode[];
  playerCounts: number[];
  iterations: number;
  scenarios: AllScenariosParallelScenarioSummary[];
  failedScenarios: AllScenariosParallelErrorSummary[];
}

export interface OptimizerSignificanceThresholds {
  minFitnessLift: number;
  maxGuardrailRegression: number;
  confidence: 0.9 | 0.95 | 0.99;
  alpha: number;
}
