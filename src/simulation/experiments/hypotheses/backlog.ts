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

const SUCCESS_RULE = {
  primary: 'successRate' as const,
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
    id: 'stones_cry_out_new_baseline_validation',
    title: 'Validate new pressure-balanced baseline behaviour.',
    scenarioId: 'stones_cry_out',
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
    id: 'stones_cry_out_mandates_relaxed_1',
    title: 'Relax all mandate thresholds by +1.',
    scenarioId: 'stones_cry_out',
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
    id: 'stones_cry_out_mandates_relaxed_2',
    title: 'Relax mandates by +2 thresholds.',
    scenarioId: 'stones_cry_out',
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
    id: 'stones_cry_out_allow_one_failed_mandate',
    title: 'Allow one failed mandate without converting victory to defeat.',
    scenarioId: 'stones_cry_out',
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
    id: 'stones_cry_out_balanced_candidate',
    title: 'Relax mandates slightly while preserving pressure-balanced system.',
    scenarioId: 'stones_cry_out',
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

  /**
   * ACTION DIVERSITY
   * Algerian War of Independence
   */

  experiment({
    id: 'alg_action_diversity_setup_gate_a',
    title: 'Require setup before campaign payoff and raise early resilience pressure.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -1,
        northernWarMachineDelta: 1,
      },
      pressure: {
        crisisSpikeExtractionDelta: 1,
      },
      victoryGate: {
        requiredAction: { actionId: 'build_solidarity' },
      },
      victoryScoring: {
        mode: 'score',
        publicVictoryWeight: 45,
        mandatesWeight: 55,
        mandateProgressMode: 'progress',
      },
    },
    expectedEffects: {
      successRate:
        'Should remain viable while reducing raw launch-campaign dominance.',
      avgTurns:
        'Should increase modestly if setup actions become relevant before victory payoff.',
      publicVictoryRate:
        'Should stay stable or rise slightly if setup gating produces healthier public victories.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_pressure_defense_b',
    title: 'Make defense matter by sharpening pressure consequences and delaying rush closure.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      pressure: {
        crisisSpikeExtractionDelta: 1,
        maxExtractionAddedPerRound: 2,
      },
      setup: {
        seededExtractionTotalDelta: 1,
      },
      victoryGate: {
        minRoundBeforeVictory: 6,
      },
    },
    expectedEffects: {
      defeat_extraction_breach:
        'May rise slightly at first, but defend should become strategically necessary instead of irrelevant.',
      avgTurns:
        'Should lengthen if pressure stabilization becomes part of successful play.',
      successRate:
        'Should recover if defend meaningfully reduces collapse in later test runs.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c',
    title: 'Increase attention and evidence dependency for victory progression.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -2,
      },
      victoryGate: {
        requiredProgress: { extractionRemoved: 2 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 72,
        publicVictoryWeight: 40,
        mandatesWeight: 60,
        mandateProgressMode: 'progress',
      },
    },
    expectedEffects: {
      publicVictoryRate:
        'Should become more dependent on non-campaign setup, especially outreach and evidence handling.',
      successRate:
        'Should improve only if evidence and attention actions contribute meaningfully to progress.',
      avgTurns:
        'Should increase slightly as rushed victory lines become less sufficient on their own.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_campaign_suppression_d',
    title: 'Further suppress direct campaign rushing by requiring outreach before closure.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        northernWarMachineDelta: 1,
        globalGazeDelta: -1,
      },
      victoryGate: {
        minRoundBeforeVictory: 7,
        requiredAction: { actionId: 'international_outreach' },
      },
      victoryScoring: {
        threshold: 75,
        publicVictoryWeight: 35,
        mandatesWeight: 65,
        mandateProgressMode: 'progress',
      },
    },
    expectedEffects: {
      successRate:
        'Should only improve if campaign victory becomes properly setup-dependent rather than universally correct.',
      publicVictoryRate:
        'May dip initially while outreach relevance rises; accept only if overall success stabilizes.',
      avgTurns:
        'Should increase if the scenario shifts from rush lines to prepared victory lines.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c1',
    title: 'Follow-up C1: lighter gaze penalty with lower extraction requirement.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -1,
      },
      victoryGate: {
        requiredProgress: { extractionRemoved: 1 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
        mandateProgressMode: 'binary',
      },
    },
    expectedEffects: {
      successRate:
        'Should stay near baseline while making outreach and evidence lines slightly more relevant.',
      publicVictoryRate:
        'Should remain stable if the added requirement is not over-constraining.',
      avgTurns:
        'Should rise only slightly if the setup ask is mild enough.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c2',
    title: 'Follow-up C2: lighter gaze penalty with original extraction requirement.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -1,
      },
      victoryGate: {
        requiredProgress: { extractionRemoved: 2 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 72,
        publicVictoryWeight: 40,
        mandatesWeight: 60,
        mandateProgressMode: 'binary',
      },
    },
    expectedEffects: {
      successRate:
        'Should test whether the original C requirement works once the unsupported mandate progress mode is removed.',
      publicVictoryRate:
        'Should decline only modestly if the pressure remains fair.',
      avgTurns:
        'Should be similar to C if extraction progress remains the main pacing lever.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c3',
    title: 'Follow-up C3: original gaze penalty with lighter extraction requirement.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -2,
      },
      victoryGate: {
        requiredProgress: { extractionRemoved: 1 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 72,
        publicVictoryWeight: 40,
        mandatesWeight: 60,
        mandateProgressMode: 'binary',
      },
    },
    expectedEffects: {
      successRate:
        'Should test whether the gaze pressure is useful when the extraction requirement is softened.',
      publicVictoryRate:
        'Should stay closer to baseline than the original C if the bottleneck was too strict.',
      avgTurns:
        'Should rise modestly if setup actions matter without stalling the scenario.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c4',
    title: 'Follow-up C4: stronger mandate weighting with a minimum round gate.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -2,
      },
      victoryGate: {
        minRoundBeforeVictory: 6,
        requiredProgress: { extractionRemoved: 1 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 74,
        publicVictoryWeight: 35,
        mandatesWeight: 65,
        mandateProgressMode: 'binary',
      },
    },
    expectedEffects: {
      successRate:
        'Should only hold if the scenario can absorb slower, more prepared victories without collapsing.',
      publicVictoryRate:
        'May dip while setup dependence increases; accept only if the action mix improves materially.',
      avgTurns:
        'Should lengthen if direct rush lines are reduced.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_attention_evidence_c5',
    title: 'Follow-up C5: lighter gaze penalty with a minimum round gate and lower threshold.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: {
        globalGazeDelta: -1,
      },
      victoryGate: {
        minRoundBeforeVictory: 6,
        requiredProgress: { extractionRemoved: 1 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 35,
        mandatesWeight: 65,
        mandateProgressMode: 'binary',
      },
    },
    expectedEffects: {
      successRate:
        'Should test whether a softer setup tax plus a round gate can increase non-campaign preparation without crashing the scenario.',
      publicVictoryRate:
        'Should remain viable if the gate mainly slows closure rather than blocking it.',
      avgTurns:
        'Should increase into a healthier mid-game if the scenario is genuinely diversifying action timing.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_simulator_iso_s1',
    title: 'Simulator-only S1: mild underused-action encouragement on top of C1.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: { globalGazeDelta: -1 },
      victoryGate: { requiredProgress: { extractionRemoved: 1 } },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
        mandateProgressMode: 'binary',
      },
      simulator: {
        actionBias: {
          build_solidarity: 8,
          smuggle_evidence: 8,
          international_outreach: 8,
          defend: 8,
        },
      },
    },
    expectedEffects: {
      successRate: 'Should stay close to C1 while raising targeted-action usage modestly.',
      publicVictoryRate: 'Should remain near baseline if the added simulator bias is not over-steering.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_simulator_iso_s2',
    title: 'Simulator-only S2: penalize campaign without setup and reward prepared campaigns.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: { globalGazeDelta: -1 },
      victoryGate: { requiredProgress: { extractionRemoved: 1 } },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
        mandateProgressMode: 'binary',
      },
      simulator: {
        actionBias: {
          build_solidarity: 6,
          international_outreach: 6,
          smuggle_evidence: 6,
        },
        launchCampaignWithoutSetupPenalty: 14,
        launchCampaignWithSetupBonus: 8,
      },
    },
    expectedEffects: {
      successRate: 'Should hold if campaign spam is the main source of monoculture.',
      avgTurns: 'May increase slightly as setup becomes part of viable campaign lines.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_simulator_iso_s3',
    title: 'Simulator-only S3: emphasize defend and outreach in pressure windows.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: { globalGazeDelta: -1 },
      victoryGate: { requiredProgress: { extractionRemoved: 1 } },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
        mandateProgressMode: 'binary',
      },
      simulator: {
        actionBias: {
          defend: 10,
          international_outreach: 9,
          build_solidarity: 5,
        },
        highPressureDefendBonus: 14,
        lowGazeOutreachBonus: 12,
      },
    },
    expectedEffects: {
      successRate: 'Should improve if early defeats are partly a timing problem rather than a pure balance cap.',
      publicVictoryRate: 'Should remain viable if gaze-sensitive setup better prepares campaign windows.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_simulator_iso_s4',
    title: 'Simulator-only S4: evidence and outreach preparation push on top of C3.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: { globalGazeDelta: -2 },
      victoryGate: { requiredProgress: { extractionRemoved: 1 } },
      victoryScoring: {
        mode: 'score',
        threshold: 72,
        publicVictoryWeight: 40,
        mandatesWeight: 60,
        mandateProgressMode: 'binary',
      },
      simulator: {
        actionBias: {
          smuggle_evidence: 10,
          international_outreach: 10,
          build_solidarity: 6,
          defend: 6,
        },
        evidenceScarcitySmuggleBonus: 14,
        lowGazeOutreachBonus: 14,
        launchCampaignWithoutSetupPenalty: 10,
      },
    },
    expectedEffects: {
      successRate: 'Should hold only if evidence and attention can become useful without stalling victory too much.',
      avgTurns: 'Should move upward if successful paths become more prepared and less direct.',
    },
    decisionRule: SUCCESS_RULE,
  }),

  experiment({
    id: 'alg_action_diversity_simulator_iso_s5',
    title: 'Simulator-only S5: strongest isolated action-diversity push.',
    scenarioId: 'algerian_war_of_independence',
    victoryModes: ['liberation', 'symbolic'],
    patch: {
      setup: { globalGazeDelta: -1 },
      victoryGate: {
        minRoundBeforeVictory: 6,
        requiredProgress: { extractionRemoved: 1 },
      },
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 40,
        mandatesWeight: 60,
        mandateProgressMode: 'binary',
      },
      simulator: {
        actionBias: {
          build_solidarity: 10,
          smuggle_evidence: 10,
          international_outreach: 10,
          defend: 10,
        },
        launchCampaignWithoutSetupPenalty: 18,
        launchCampaignWithSetupBonus: 10,
        highPressureDefendBonus: 16,
        evidenceScarcitySmuggleBonus: 16,
        lowGazeOutreachBonus: 16,
      },
    },
    expectedEffects: {
      successRate: 'Should only hold if the simulator policy was a primary source of the action monoculture.',
      publicVictoryRate: 'May dip, but targeted-action share should move materially if the isolated override is effective.',
    },
    decisionRule: SUCCESS_RULE,
  }),

];

export function getExperimentById(id: string) {
  return EXPERIMENT_BACKLOG.find((e) => e.id === id) ?? null;
}
