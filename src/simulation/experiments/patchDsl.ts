export type ScenarioPatch = {
  note?: string;
  setup?: {
    globalGazeDelta?: number;
    northernWarMachineDelta?: number;
    seededExtractionTotalDelta?: number;
    frontSeedDeltas?: Record<string, number>;
  };
  victory?: {
    liberationThresholdDelta?: number;
    overrideLiberationExtractionCap?: number;
    beaconThresholdTweaks?: Array<{
      beaconId: string;
      path: string;
      delta?: number;
      setTo?: number;
    }>;
  };
  pressure?: {
    crisisSpikeExtractionDelta?: number;
    maxExtractionAddedPerRound?: number;
  };
  mandates?: {
    relaxAllThresholdsBy?: number;
    classifyMandateFailureAs?: 'LOSS' | 'COSTLY_WIN';
  };
  actions?: {
    removeActionIds?: string[];
  };
  victoryGate?: {
    minRoundBeforeVictory?: number;
    requiredAction?: {
      actionId: string;
    };
    requiredProgress?: {
      extractionRemoved?: number;
    };
  };
  victoryScoring?: {
    mode?: 'binary' | 'score';
    threshold?: number;
    publicVictoryWeight?: number;
    mandatesWeight?: number;
    mandateProgressMode?: 'binary' | 'progress';
    catastrophicCapEnabled?: boolean;
    catastrophicCapValue?: number;
  };
};
