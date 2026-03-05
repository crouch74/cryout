export type TrajectoryStep = {
  round: number;
  phase: string;

  player: string;
  action: string;

  targets?: string[];

  result: {
    bodiesDelta?: number;
    evidenceDelta?: number;
    extractionRemoved?: number;
    extractionAdded?: number;
    globalGazeDelta?: number;
    warMachineDelta?: number;
  };

  snapshot: {
    extractionByRegion: Record<string, number>;
    bodiesByPlayer: Record<string, number>;
    evidenceByPlayer: Record<string, number>;

    globalGaze: number;
    northernWarMachine: number;
  };
};

export type VictoryTrajectory = {
  scenarioId: string;
  victoryMode: string;

  seed: number;
  players: number;

  publicVictory: boolean;
  fullVictory: boolean;
  mandateFailure: boolean;

  turnsPlayed: number;
  roundVictoryTriggered: number;
  progressAtVictory: {
    extractionRemoved: number;
  };
  actionsLeadingToVictory: string[];

  steps: TrajectoryStep[];
};

export type TrajectorySummary = {
  totalTrajectories: number;
  averageTurnsToVictory: number;
  averageExtractionRemovedBeforeVictory: number;
  mostCommonFirstAction: {
    action: string;
    count: number;
    rate: number;
  } | null;
  mostCommonActionSequence: {
    sequence: string;
    count: number;
    rate: number;
  } | null;
  topFirstActions: Array<{
    action: string;
    count: number;
    rate: number;
  }>;
  topActionSequences: Array<{
    sequence: string;
    count: number;
    rate: number;
  }>;
  averageRoundVictory: number;
  distributionOfVictoryRounds: Array<{
    round: number;
    count: number;
    rate: number;
  }>;
  progressBeforeVictory: {
    averageExtractionRemoved: number;
  };
};
