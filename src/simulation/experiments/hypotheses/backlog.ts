import type { ExperimentDefinition } from '../types.ts';

const DEFAULT_RULE = {
  primary: 'winRate' as const,
  minLift: 0.01,
  guardrails: [
    { metric: 'defeat_extraction_breach' as const, maxRegression: 0.02 },
    { metric: 'defeat_comrades_exhausted' as const, maxRegression: 0.02 },
    { metric: 'mandateFailRateGivenPublic' as const, maxRegression: 0.05 },
  ],
  confidence: 0.95 as const,
};

const PUBLIC_VICTORY_RULE = {
  primary: 'publicVictoryRate' as const,
  minLift: 0.01,
  guardrails: [
    { metric: 'defeat_extraction_breach' as const, maxRegression: 0.02 },
    { metric: 'defeat_comrades_exhausted' as const, maxRegression: 0.02 },
  ],
  confidence: 0.95 as const,
};

function baseExperiment(input: Omit<ExperimentDefinition, 'runsPerArm' | 'playerCounts' | 'seed'>): ExperimentDefinition {
  return {
    runsPerArm: 50000,
    playerCounts: [2, 3, 4],
    seed: 42,
    ...input,
  };
}

export const EXPERIMENT_BACKLOG: ExperimentDefinition[] = [
  // base_design
  baseExperiment({
    id: 'base_design_trim_setup_pressure',
    title: 'Base design: trim opening pressure to test early survivability and pacing.',
    scenarioId: 'base_design',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'WarMachine -1, GlobalGaze +1, seeded extraction -2',
      setup: {
        globalGazeDelta: 1,
        northernWarMachineDelta: -1,
        seededExtractionTotalDelta: -2,
      },
    },
    expectedEffects: {
      winRate: 'Should rise with less opening pressure.',
      avgTurns: 'May increase slightly due to reduced immediate collapse.',
      defeat_extraction_breach: 'Should decline as openings are less punitive.',
    },
    decisionRule: DEFAULT_RULE,
  }),
  baseExperiment({
    id: 'base_design_liberation_threshold_plus_1',
    title: 'Base design: loosen liberation threshold by one extraction point.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {
      note: 'liberationThresholdDelta +1',
      victory: {
        liberationThresholdDelta: 1,
      },
    },
    expectedEffects: {
      winRate: 'Liberation win rate should improve directly.',
      medianTurns: 'Might shorten if end condition is reachable sooner.',
    },
    decisionRule: DEFAULT_RULE,
  }),
  baseExperiment({
    id: 'base_design_reduce_crisis_spikes',
    title: 'Base design: reduce extraction spikes from crisis effects by one.',
    scenarioId: 'base_design',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'crisis add_extraction effects reduced by 1 (floor 0)',
      pressure: {
        crisisSpikeExtractionDelta: -1,
      },
    },
    expectedEffects: {
      defeat_extraction_breach: 'Should drop if crisis spikes are main failure source.',
      winRate: 'Should rise modestly with less volatility.',
    },
    decisionRule: DEFAULT_RULE,
  }),

  // algerian_war_of_independence
  baseExperiment({
    id: 'algeria_relax_mandates_one_step',
    title: 'Algeria: relax mandates by one threshold step to test mandate pressure.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'Relax all numeric thresholds by +1 step for mandates/beacons.',
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    },
    expectedEffects: {
      mandateFailRateGivenPublic: 'Should decline if private objectives are over-constraining wins.',
      publicVictoryRate: 'Could rise if fewer public wins are converted into losses.',
    },
    decisionRule: PUBLIC_VICTORY_RULE,
  }),
  baseExperiment({
    id: 'algeria_trim_setup_pressure',
    title: 'Algeria: reduce setup pressure by adjusting gaze, war machine, and top seeded front.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'GlobalGaze +1, WarMachine -1, highestSeedFront -1',
      setup: {
        globalGazeDelta: 1,
        northernWarMachineDelta: -1,
        frontSeedDeltas: {
          highestSeedFront: -1,
        },
      },
    },
    expectedEffects: {
      winRate: 'Should improve through a softer opening board state.',
      defeat_extraction_breach: 'Should decline with lower initial extraction pressure.',
    },
    decisionRule: DEFAULT_RULE,
  }),
  baseExperiment({
    id: 'algeria_adjust_liberation_cap',
    title: 'Algeria: tighten liberation extraction cap from scenario override.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation'],
    patch: {
      note: 'overrideLiberationExtractionCap 3',
      victory: {
        overrideLiberationExtractionCap: 3,
      },
    },
    expectedEffects: {
      winRate: 'Should decrease if liberation cap is too strict; validates sensitivity.',
      avgTurns: 'May increase due to harder end-state requirement.',
    },
    decisionRule: {
      ...DEFAULT_RULE,
      minLift: 0.005,
    },
  }),

  // tahrir_square
  baseExperiment({
    id: 'tahrir_ease_symbolic_beacons',
    title: 'Tahrir: ease symbolic beacon thresholds for unfinished justice and labor.',
    scenarioId: 'tahrir_square',
    victoryModes: ['symbolic'],
    patch: {
      note: 'No-Military-Trials cap +2; labor beacon min -2',
      victory: {
        beaconThresholdTweaks: [
          {
            beaconId: 'beacon_tahrir_no_military_trials',
            path: 'condition.right',
            delta: 2,
          },
          {
            beaconId: 'beacon_tahrir_labor_student',
            path: 'condition.right',
            delta: -2,
          },
        ],
      },
    },
    expectedEffects: {
      publicVictoryRate: 'Symbolic victory rate should increase if beacon caps are too tight.',
      avgTurns: 'Could shorten if symbolic completion is less restrictive.',
    },
    decisionRule: PUBLIC_VICTORY_RULE,
  }),
  baseExperiment({
    id: 'tahrir_trim_setup_pressure',
    title: 'Tahrir: trim setup pressure by lowering War Machine and Cairo seed.',
    scenarioId: 'tahrir_square',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'WarMachine -1 and Cairo extraction seed -1',
      setup: {
        northernWarMachineDelta: -1,
        frontSeedDeltas: {
          Cairo: -1,
        },
      },
    },
    expectedEffects: {
      winRate: 'Should increase if opening Cairo pressure is over-tuned.',
      defeat_comrades_exhausted: 'May drop with less early repression cost.',
    },
    decisionRule: DEFAULT_RULE,
  }),
  baseExperiment({
    id: 'tahrir_remove_unresolved_actions',
    title: 'Tahrir: remove two underperforming actions and observe strategy adaptation.',
    scenarioId: 'tahrir_square',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'remove expose_regime_lies and call_labor_strike',
      actions: {
        removeActionIds: ['expose_regime_lies', 'call_labor_strike'],
      },
    },
    expectedEffects: {
      winRate: 'Should improve only if these actions are strategic traps.',
      avgTurns: 'May change if action economy becomes cleaner.',
    },
    decisionRule: DEFAULT_RULE,
  }),

  // woman_life_freedom
  baseExperiment({
    id: 'wlf_trim_setup_pressure',
    title: 'WLF: soften setup pressure in War Machine, Tehran, and Kurdistan.',
    scenarioId: 'woman_life_freedom',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'WarMachine -1, Tehran -1, Kurdistan -1',
      setup: {
        northernWarMachineDelta: -1,
        frontSeedDeltas: {
          Tehran: -1,
          Kurdistan: -1,
        },
      },
    },
    expectedEffects: {
      winRate: 'Should rise if early suppression is too dominant.',
      defeat_extraction_breach: 'Should fall through lower seeded extraction.',
    },
    decisionRule: DEFAULT_RULE,
  }),
  baseExperiment({
    id: 'wlf_relax_caps',
    title: 'WLF: relax relevant mandate and beacon caps by one step.',
    scenarioId: 'woman_life_freedom',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'relaxAllThresholdsBy +1',
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    },
    expectedEffects: {
      publicVictoryRate: 'Should improve if cap thresholds are too strict.',
      mandateFailRateGivenPublic: 'Should decrease with easier mandate constraints.',
    },
    decisionRule: PUBLIC_VICTORY_RULE,
  }),
  baseExperiment({
    id: 'wlf_remove_compose_chant',
    title: 'WLF: remove compose_chant action to test if it is a low-value sink.',
    scenarioId: 'woman_life_freedom',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      note: 'remove compose_chant',
      actions: {
        removeActionIds: ['compose_chant'],
      },
    },
    expectedEffects: {
      winRate: 'Should rise if compose_chant is frequently misplayed by autoplay.',
      avgTurns: 'May shorten if decision space is less noisy.',
    },
    decisionRule: DEFAULT_RULE,
  }),
];

export function getExperimentById(id: string) {
  return EXPERIMENT_BACKLOG.find((experiment) => experiment.id === id) ?? null;
}
