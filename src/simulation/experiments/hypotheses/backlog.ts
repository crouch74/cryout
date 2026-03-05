import type { ExperimentDefinition } from '../types.ts';

const PUBLIC_RULE = {
  primary: 'publicVictoryRate' as const,
  minLift: 0.02,
  guardrails: [
    { metric: 'defeat_extraction_breach' as const, maxRegression: 0.03 },
    { metric: 'defeat_comrades_exhausted' as const, maxRegression: 0.03 },
  ],
  confidence: 0.95 as const,
};

function experiment(
  input: Omit<ExperimentDefinition, 'runsPerArm' | 'playerCounts' | 'seed'>
): ExperimentDefinition {
  return {
    runsPerArm: 75000,
    playerCounts: [2, 3, 4],
    seed: 42,
    ...input,
  };
}

export const EXPERIMENT_BACKLOG: ExperimentDefinition[] = [

  /**
   * CONTROL
   * Validate new baseline behaviour
   */

  experiment({
    id: 'base_design_new_baseline_validation',
    title: 'Validate new pressure-balanced baseline behaviour.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {},
    expectedEffects: {
      publicVictoryRate:
        'Should stabilize between 30–60%.',
    },
    decisionRule: PUBLIC_RULE,
  }),

  /**
   * PHASE 1
   * Mandate pressure exploration
   */

  experiment({
    id: 'base_design_mandates_relaxed_1',
    title: 'Relax all mandate thresholds by +1.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    },
    expectedEffects: {
      mandateFailRateGivenPublic:
        'Should drop if mandates invalidate most victories.',
      publicVictoryRate:
        'Should increase slightly.',
    },
    decisionRule: PUBLIC_RULE,
  }),

  experiment({
    id: 'base_design_mandates_relaxed_2',
    title: 'Relax mandates by +2 thresholds.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {
      mandates: {
        relaxAllThresholdsBy: 2,
      },
    },
    expectedEffects: {
      mandateFailRateGivenPublic:
        'Should approach target 30–40%.',
      publicVictoryRate:
        'Should remain stable if mandates were primary blocker.',
    },
    decisionRule: PUBLIC_RULE,
  }),

  /**
   * PHASE 2
   * Partial mandate failure tolerance
   */

  experiment({
    id: 'base_design_allow_one_failed_mandate',
    title: 'Allow one failed mandate without converting victory to defeat.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    },
    expectedEffects: {
      publicVictoryRate:
        'Should remain similar.',
      successRate:
        'Should increase substantially if mandate incompatibility is the primary blocker.',
    },
    decisionRule: {
      primary: 'successRate',
      minLift: 0.02,
      confidence: 0.95,
    },
  }),

  /**
   * PHASE 3
   * Full compatibility candidate
   */

  experiment({
    id: 'base_design_balanced_candidate',
    title: 'Relax mandates slightly while preserving pressure-balanced system.',
    scenarioId: 'base_design',
    victoryModes: ['liberation'],
    patch: {
      mandates: {
        relaxAllThresholdsBy: 1,
      },
    },
    expectedEffects: {
      publicVictoryRate:
        'Should stabilize near 40–60%.',
      mandateFailRateGivenPublic:
        'Should stabilize near 30–40%.',
      successRate:
        'Should emerge in 20–40% range.',
    },
    decisionRule: {
      primary: 'successRate',
      minLift: 0.02,
      confidence: 0.95,
    },
  }),

];

export function getExperimentById(id: string) {
  return EXPERIMENT_BACKLOG.find((e) => e.id === id) ?? null;
}