import type {
  CompiledContent,
  EngineCommand,
  EngineState,
  FactionId,
  QueuedIntent,
  VictoryMode,
} from '../engine/index.ts';

export type SimulationVictoryMode = 'liberation' | 'symbolic';

export type StrategyId =
  | 'random'
  | 'extraction_defender'
  | 'domain_builder'
  | 'evidence_hoarder'
  | 'global_attention'
  | 'mandate_hunter'
  | 'risk_taker'
  | 'risk_avoider'
  | 'balanced';

export interface SimulationBatchConfig {
  scenarios?: string[];
  victoryModes?: SimulationVictoryMode[];
  runsPerScenario?: number;
  strategies?: StrategyProfile[];
  randomSeed?: number;
  parallelWorkers?: number;
  outputDir?: string;
  progressInterval?: number;
}

export interface NormalizedSimulationBatchConfig {
  scenarios: string[];
  victoryModes: SimulationVictoryMode[];
  runsPerScenario: number;
  strategyIds: StrategyId[];
  randomSeed: number;
  parallelWorkers: number;
  outputDir: string;
  progressInterval: number;
}

export interface PlannedSimulationRun {
  index: number;
  simulationId: string;
  scenario: string;
  mode: VictoryMode;
  seed: number;
  humanPlayerCount: 2 | 3 | 4;
  seatFactionIds: FactionId[];
  seatOwnerIds: number[];
  strategyIds: StrategyId[];
}

export interface StrategyCandidate {
  seat: number;
  action: Omit<QueuedIntent, 'slot'>;
  baseScore: number;
  score: number;
  reasons: string[];
}

export interface StrategyContext {
  strategyId: StrategyId;
  state: EngineState;
  content: CompiledContent;
  seat: number;
  candidates: StrategyCandidate[];
}

export interface StrategyDecision {
  seat: number;
  action: Omit<QueuedIntent, 'slot'>;
  baseScore: number;
  score: number;
  reasons: string[];
}

export interface StrategyProfile {
  id: StrategyId;
  label: string;
  chooseAction: (context: StrategyContext) => StrategyDecision | null;
}

export interface SimulationRecord {
  simulationId: string;
  scenario: string;
  victoryMode: SimulationVictoryMode;
  playerCount: number;
  strategies: StrategyId[];
  turnsPlayed: number;
  result: {
    type: 'victory' | 'defeat';
    reason: string;
  };
  publicVictoryAchieved: boolean;
  mandateFailure: boolean;
  extractionBreach: boolean;
  comradesExhausted: boolean;
  suddenDeath: boolean;
  finalState: {
    globalGaze: number;
    warMachine: number;
    domains: {
      WarMachine: number;
      DyingPlanet: number;
      GildedCage: number;
      SilencedTruth: number;
      EmptyStomach: number;
      FossilGrip: number;
      StolenVoice: number;
      RevolutionaryWave: number;
      PatriarchalGrip: number;
      UnfinishedJustice: number;
    };
    fronts: Record<string, number>;
  };
  campaignStats: {
    campaignAttempts: number;
    campaignSuccess: number;
    attentionFailures: number;
    backlashFailures: number;
  };
  resourceStats: {
    bodiesSpent: number;
    evidenceSpent: number;
  };
  actionCounts: {
    organize: number;
    investigate: number;
    launchCampaign: number;
    buildSolidarity: number;
    smuggleEvidence: number;
    internationalOutreach: number;
    defend: number;
  };
  actionCountsExtra: Record<string, number>;
  timeline: Array<{
    round: number;
    globalGaze: number;
    warMachine: number;
    avgExtraction: number;
    domainsAverage: number;
  }>;
}

export interface ScenarioSummary {
  runs: number;
  winRate: number;
  averageTurns: number;
  defeatReasons: Record<string, number>;
  campaignSuccessRate: number;
}

export interface StrategyPerformanceSummary {
  runs: number;
  winRate: number;
  averageTurns: number;
  mandateFailureRate: number;
}

export interface SimulationSummary {
  runs: number;
  winRate: number;
  averageTurns: number;
  defeatReasons: {
    extraction_breach: number;
    comrades_exhausted: number;
    sudden_death: number;
    mandate_failure: number;
    simulation_stalled: number;
  };
  scenarioStats: Record<string, ScenarioSummary>;
  strategyPerformance: Record<string, StrategyPerformanceSummary>;
  campaignSuccessRate: number;
}

export interface SimulationBatchResult {
  runs: number;
  seed: number;
  parallelWorkers: number;
  outputPath: string;
  summaryPath: string;
  summary: SimulationSummary;
  durationMs: number;
}

export interface SummaryAccumulator {
  runs: number;
  wins: number;
  totalTurns: number;
  defeatReasons: {
    extraction_breach: number;
    comrades_exhausted: number;
    sudden_death: number;
    mandate_failure: number;
    simulation_stalled: number;
  };
  campaignAttempts: number;
  campaignSuccess: number;
  scenarioStats: Record<string, {
    runs: number;
    wins: number;
    totalTurns: number;
    defeatReasons: Record<string, number>;
    campaignAttempts: number;
    campaignSuccess: number;
  }>;
  strategyPerformance: Record<string, {
    runs: number;
    wins: number;
    totalTurns: number;
    mandateFailures: number;
  }>;
}

export interface WorkerRunChunk {
  workerId: number;
  chunkIndex: number;
  runs: PlannedSimulationRun[];
  shardPath: string;
  progressInterval: number;
}

export interface WorkerProgressMessage {
  type: 'progress';
  workerId: number;
  completed: number;
  total: number;
}

export interface WorkerResultMessage {
  type: 'result';
  workerId: number;
  chunkIndex: number;
  shardPath: string;
  processed: number;
  summary: SummaryAccumulator;
}

export interface WorkerErrorMessage {
  type: 'error';
  workerId: number;
  message: string;
  stack?: string;
}

export type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

export interface RunExecutionResult {
  record: SimulationRecord;
  terminalCommandLogLength: number;
}

export type SimulationCommand = Exclude<EngineCommand, { type: 'StartGame' | 'SaveSnapshot' | 'LoadSnapshot' | 'RemoveQueuedIntent' | 'ReorderQueuedIntent' }>;
