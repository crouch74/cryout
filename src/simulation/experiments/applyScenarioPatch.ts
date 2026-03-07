import {
  getRulesetDefinition,
  type BeaconDefinition,
  type RegionId,
  type RulesetDefinition,
} from '../../engine/index.ts';
import { logVerbose } from '../logging.ts';
import type { Condition } from '../../engine/adapters/compat/types.ts';
import { CONTENT_PACKS } from '../../scenarios/content-packs/index.ts';
import type { ScenarioPatch } from './patchDsl.ts';

export interface AppliedScenarioPatch {
  baselineScenarioId: string;
  treatmentScenarioId: string;
  baselineRuleset: RulesetDefinition;
  treatmentRuleset: RulesetDefinition;
  unregister: () => void;
}

interface ApplyScenarioPatchInput {
  experimentId: string;
  scenarioId: string;
  patch: ScenarioPatch;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function failPatch(message: string): never {
  throw new Error(`💥 Patch not applicable: ${message}`);
}

function ensureSetup(ruleset: RulesetDefinition) {
  if (!ruleset.setup) {
    ruleset.setup = {
      globalGaze: 0,
      northernWarMachine: 0,
      extractionSeeds: {},
    };
  }
  if (!ruleset.setup.extractionSeeds) {
    ruleset.setup.extractionSeeds = {};
  }
  return ruleset.setup;
}

function sortSeedEntries(entries: Array<[string, number]>) {
  entries.sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
}

function getHighestSeedFront(extractionSeeds: Partial<Record<RegionId, number>>) {
  const entries = Object.entries(extractionSeeds).map(([regionId, amount]) => [regionId, amount ?? 0] as const);
  if (entries.length === 0) {
    return null;
  }
  const sorted: Array<[string, number]> = entries.map(([regionId, amount]) => [regionId, amount]);
  sortSeedEntries(sorted);
  return sorted[0][0] as RegionId;
}

function resolveFrontKey(
  frontKey: string,
  extractionSeeds: Partial<Record<RegionId, number>>,
  ruleset: RulesetDefinition,
) {
  if (frontKey === 'highestSeedFront') {
    const highest = getHighestSeedFront(extractionSeeds);
    if (!highest) {
      failPatch(`frontSeedDeltas requested highestSeedFront but no extraction seeds exist in scenario=${ruleset.id}`);
    }
    return highest;
  }

  const regionExists = ruleset.regions.some((region) => region.id === frontKey);
  if (!regionExists) {
    failPatch(`frontSeedDeltas key=${frontKey} not found in scenario=${ruleset.id}`);
  }

  return frontKey as RegionId;
}

function applySeededExtractionTotalDelta(ruleset: RulesetDefinition, totalDelta: number) {
  if (totalDelta === 0) {
    return;
  }

  const setup = ensureSetup(ruleset);
  const seeds = setup.extractionSeeds;

  if (totalDelta < 0) {
    let remaining = Math.abs(totalDelta);
    while (remaining > 0) {
      const candidates = Object.entries(seeds)
        .map(([regionId, amount]) => [regionId, amount ?? 0] as [string, number])
        .filter(([, amount]) => amount > 0);
      if (candidates.length === 0) {
        failPatch(`seededExtractionTotalDelta=${totalDelta} exceeds available seeded extraction in scenario=${ruleset.id}`);
      }
      sortSeedEntries(candidates);
      const [regionId] = candidates[0];
      const current = seeds[regionId as RegionId] ?? 0;
      seeds[regionId as RegionId] = Math.max(0, current - 1);
      remaining -= 1;
    }
    return;
  }

  const allSeeds = Object.entries(seeds)
    .map(([regionId, amount]) => [regionId, amount ?? 0] as [string, number]);
  if (allSeeds.length === 0) {
    failPatch(`seededExtractionTotalDelta=${totalDelta} requires existing seeded fronts in scenario=${ruleset.id}`);
  }

  let remaining = totalDelta;
  while (remaining > 0) {
    sortSeedEntries(allSeeds);
    const [regionId] = allSeeds[0];
    const current = seeds[regionId as RegionId] ?? 0;
    const next = current + 1;
    seeds[regionId as RegionId] = next;
    allSeeds[0][1] = next;
    remaining -= 1;
  }
}

function visitCondition(condition: Condition, visit: (target: Condition) => void) {
  visit(condition);
  if (condition.kind === 'all' || condition.kind === 'any') {
    for (const entry of condition.conditions) {
      visitCondition(entry, visit);
    }
  }
  if (condition.kind === 'not') {
    visitCondition(condition.condition, visit);
  }
}

function applyOverrideLiberationExtractionCap(ruleset: RulesetDefinition, cap: number) {
  const liberationCondition = ruleset.victoryConditions?.liberation;
  if (!liberationCondition) {
    failPatch(`overrideLiberationExtractionCap=${cap} requires victoryConditions.liberation in scenario=${ruleset.id}`);
  }

  let found = false;
  visitCondition(liberationCondition, (condition) => {
    if (condition.kind === 'every_region_extraction_at_most') {
      condition.count = cap;
      found = true;
    }
  });

  if (!found) {
    failPatch(`overrideLiberationExtractionCap=${cap} could not find every_region_extraction_at_most in scenario=${ruleset.id}`);
  }
}

function applyNumericPathMutation(target: Record<string, unknown>, path: string, delta?: number, setTo?: number) {
  const segments = path.split('.').map((segment) => segment.trim()).filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    failPatch('beaconThresholdTweaks path must not be empty');
  }

  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const key: string | number = Array.isArray(cursor) ? Number.parseInt(segment, 10) : segment;
    const value = cursor[key as keyof typeof cursor];
    if (value === undefined || value === null || typeof value !== 'object') {
      failPatch(`path=${path} is missing segment=${segment}`);
    }
    cursor = value as Record<string, unknown> | unknown[];
  }

  const terminalSegment = segments[segments.length - 1];
  const terminalKey: string | number = Array.isArray(cursor) ? Number.parseInt(terminalSegment, 10) : terminalSegment;
  const currentValue = cursor[terminalKey as keyof typeof cursor];
  if (typeof currentValue !== 'number') {
    failPatch(`path=${path} does not resolve to a numeric value`);
  }

  if (setTo !== undefined) {
    cursor[terminalKey as keyof typeof cursor] = setTo;
    return;
  }

  if (delta === undefined) {
    failPatch(`path=${path} requires either delta or setTo`);
  }

  cursor[terminalKey as keyof typeof cursor] = currentValue + delta;
}

function adjustConditionForRelaxation(condition: Condition, step: number): number {
  let adjustments = 0;
  visitCondition(condition, (target) => {
    if (target.kind === 'compare') {
      if (target.left.type === 'scenario_flag') {
        return;
      }
      switch (target.op) {
        case '<=':
        case '<':
          target.right += step;
          adjustments += 1;
          return;
        case '>=':
        case '>':
          target.right -= step;
          adjustments += 1;
          return;
        case '==':
        case '!=':
          return;
      }
    }

    if (target.kind === 'every_region_extraction_at_most') {
      target.count += step;
      adjustments += 1;
    }
  });
  return adjustments;
}

function applyPatchToRuleset(ruleset: RulesetDefinition, patch: ScenarioPatch) {
  if (patch.simulator) {
    ruleset.simulatorOverrides = {
      ...(ruleset.simulatorOverrides ?? {}),
      ...(patch.simulator.actionBias ? {
        actionBias: {
          ...(ruleset.simulatorOverrides?.actionBias ?? {}),
          ...patch.simulator.actionBias,
        },
      } : {}),
      ...(patch.simulator.actionCountPenalty ? {
        actionCountPenalty: {
          ...(ruleset.simulatorOverrides?.actionCountPenalty ?? {}),
          ...patch.simulator.actionCountPenalty,
        },
      } : {}),
      ...(patch.simulator.launchCampaignWithoutSetupPenalty !== undefined
        ? { launchCampaignWithoutSetupPenalty: patch.simulator.launchCampaignWithoutSetupPenalty }
        : {}),
      ...(patch.simulator.launchCampaignWithSetupBonus !== undefined
        ? { launchCampaignWithSetupBonus: patch.simulator.launchCampaignWithSetupBonus }
        : {}),
      ...(patch.simulator.highPressureDefendBonus !== undefined
        ? { highPressureDefendBonus: patch.simulator.highPressureDefendBonus }
        : {}),
      ...(patch.simulator.evidenceScarcitySmuggleBonus !== undefined
        ? { evidenceScarcitySmuggleBonus: patch.simulator.evidenceScarcitySmuggleBonus }
        : {}),
      ...(patch.simulator.lowGazeOutreachBonus !== undefined
        ? { lowGazeOutreachBonus: patch.simulator.lowGazeOutreachBonus }
        : {}),
      ...(patch.simulator.repeatActionPenaltyPerUse !== undefined
        ? { repeatActionPenaltyPerUse: patch.simulator.repeatActionPenaltyPerUse }
        : {}),
      ...(patch.simulator.repeatActionPenaltyStartsAfter !== undefined
        ? { repeatActionPenaltyStartsAfter: patch.simulator.repeatActionPenaltyStartsAfter }
        : {}),
      ...(patch.simulator.firstUseTargetedActionBonus !== undefined
        ? { firstUseTargetedActionBonus: patch.simulator.firstUseTargetedActionBonus }
        : {}),
      ...(patch.simulator.preparedCampaignDiversityBonus !== undefined
        ? { preparedCampaignDiversityBonus: patch.simulator.preparedCampaignDiversityBonus }
        : {}),
    };
  }

  if (patch.setup) {
    const setup = ensureSetup(ruleset);

    if (patch.setup.globalGazeDelta !== undefined) {
      setup.globalGaze += patch.setup.globalGazeDelta;
    }
    if (patch.setup.northernWarMachineDelta !== undefined) {
      setup.northernWarMachine += patch.setup.northernWarMachineDelta;
    }
    if (patch.setup.seededExtractionTotalDelta !== undefined) {
      applySeededExtractionTotalDelta(ruleset, patch.setup.seededExtractionTotalDelta);
    }
    if (patch.setup.frontSeedDeltas) {
      for (const [frontKey, delta] of Object.entries(patch.setup.frontSeedDeltas)) {
        const resolvedFront = resolveFrontKey(frontKey, setup.extractionSeeds, ruleset);
        const current = setup.extractionSeeds[resolvedFront] ?? 0;
        const next = current + delta;
        if (next < 0) {
          failPatch(`frontSeedDeltas would make extraction seed negative for front=${resolvedFront} in scenario=${ruleset.id}`);
        }
        setup.extractionSeeds[resolvedFront] = next;
      }
    }
  }

  if (patch.victory) {
    if (patch.victory.liberationThresholdDelta !== undefined) {
      ruleset.liberationThreshold = Math.max(0, ruleset.liberationThreshold + patch.victory.liberationThresholdDelta);
    }

    if (patch.victory.overrideLiberationExtractionCap !== undefined) {
      applyOverrideLiberationExtractionCap(ruleset, patch.victory.overrideLiberationExtractionCap);
    }

    if (patch.victory.beaconThresholdTweaks) {
      const beaconIndex = new Map<string, BeaconDefinition>(ruleset.beacons.map((beacon) => [beacon.id, beacon]));
      for (const tweak of patch.victory.beaconThresholdTweaks) {
        const beacon = beaconIndex.get(tweak.beaconId);
        if (!beacon) {
          failPatch(`beaconId=${tweak.beaconId} not found in scenario=${ruleset.id}`);
        }
        applyNumericPathMutation(beacon as unknown as Record<string, unknown>, tweak.path, tweak.delta, tweak.setTo);
      }
    }
  }

  if (patch.pressure) {
    if (patch.pressure.crisisSpikeExtractionDelta !== undefined) {
      let touchedEffects = 0;
      for (const card of ruleset.crisisCards) {
        for (const effect of card.effects) {
          if (effect.type !== 'add_extraction') {
            continue;
          }
          effect.amount = Math.max(0, effect.amount + patch.pressure.crisisSpikeExtractionDelta);
          touchedEffects += 1;
        }
      }
      if (touchedEffects === 0) {
        failPatch(`crisisSpikeExtractionDelta found no add_extraction effects in scenario=${ruleset.id}`);
      }
    }

    if (patch.pressure.maxExtractionAddedPerRound !== undefined) {
      const cap = patch.pressure.maxExtractionAddedPerRound;
      if (!Number.isFinite(cap) || cap < 0) {
        failPatch(`maxExtractionAddedPerRound=${String(cap)} must be a non-negative number`);
      }

      const applyCap = (effects: Array<{ type: string; amount?: number }>) => {
        let extractionAssigned = 0;
        for (const effect of effects) {
          if (effect.type !== 'add_extraction' || typeof effect.amount !== 'number') {
            continue;
          }
          const remaining = Math.max(0, cap - extractionAssigned);
          const nextAmount = Math.min(effect.amount, remaining);
          extractionAssigned += nextAmount;
          effect.amount = nextAmount;
        }
      };

      for (const card of ruleset.crisisCards) {
        applyCap(card.effects as Array<{ type: string; amount?: number }>);
      }

      for (const card of ruleset.systemCards) {
        applyCap(card.onReveal as Array<{ type: string; amount?: number }>);
      }
    }
  }

  if (patch.victoryGate) {
    ruleset.victoryGate = ruleset.victoryGate ?? {};

    if (patch.victoryGate.minRoundBeforeVictory !== undefined) {
      const roundGate = Math.max(1, Math.floor(patch.victoryGate.minRoundBeforeVictory));
      ruleset.victoryGate.minRoundBeforeVictory = roundGate;
    }

    if (patch.victoryGate.requiredAction?.actionId !== undefined) {
      const actionId = patch.victoryGate.requiredAction.actionId.trim();
      if (actionId.length === 0) {
        failPatch('victoryGate.requiredAction.actionId must not be empty');
      }
      ruleset.victoryGate.requiredAction = { actionId };
    }

    if (patch.victoryGate.requiredProgress?.extractionRemoved !== undefined) {
      const extractionRemoved = Math.max(0, Math.floor(patch.victoryGate.requiredProgress.extractionRemoved));
      ruleset.victoryGate.requiredProgress = {
        ...(ruleset.victoryGate.requiredProgress ?? {}),
        extractionRemoved,
      };
    }
  }

  if (patch.victoryScoring) {
    ruleset.victoryScoring = ruleset.victoryScoring ?? {
      mode: 'score',
      threshold: 70,
      components: [],
      mandatesAsScore: {
        enabled: false,
        weight: 0,
        mandateProgressMode: 'binary',
      },
    };

    const scoring = ruleset.victoryScoring;
    if (patch.victoryScoring.mode !== undefined) {
      scoring.mode = patch.victoryScoring.mode;
    }
    if (patch.victoryScoring.threshold !== undefined) {
      const threshold = patch.victoryScoring.threshold;
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
        failPatch(`victoryScoring.threshold=${String(threshold)} must be between 0 and 100`);
      }
      scoring.threshold = threshold;
    }

    if (patch.victoryScoring.mandateProgressMode !== undefined) {
      scoring.mandatesAsScore = scoring.mandatesAsScore ?? {
        enabled: true,
        weight: 0,
        mandateProgressMode: 'binary',
      };
      scoring.mandatesAsScore.mandateProgressMode = patch.victoryScoring.mandateProgressMode;
    }

    const components = scoring.components ?? [];
    const existingPublicIndex = components.findIndex((component) => component.id === 'publicVictory');
    const ensurePublicComponent = () => {
      if (existingPublicIndex >= 0) {
        return existingPublicIndex;
      }
      components.push({
        id: 'publicVictory',
        label: 'Public Victory',
        weight: 0,
        type: 'binaryCondition',
        source: { type: 'publicVictory' },
      });
      return components.length - 1;
    };

    if (patch.victoryScoring.publicVictoryWeight !== undefined) {
      const weight = patch.victoryScoring.publicVictoryWeight;
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
        failPatch(`victoryScoring.publicVictoryWeight=${String(weight)} must be between 0 and 100`);
      }
      const index = ensurePublicComponent();
      components[index].weight = weight;
    }

    if (patch.victoryScoring.mandatesWeight !== undefined) {
      const weight = patch.victoryScoring.mandatesWeight;
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
        failPatch(`victoryScoring.mandatesWeight=${String(weight)} must be between 0 and 100`);
      }
      scoring.mandatesAsScore = scoring.mandatesAsScore ?? {
        enabled: true,
        weight: 0,
        mandateProgressMode: 'binary',
      };
      scoring.mandatesAsScore.enabled = true;
      scoring.mandatesAsScore.weight = weight;
    }

    const publicWeightPatched = patch.victoryScoring.publicVictoryWeight !== undefined;
    const mandateWeightPatched = patch.victoryScoring.mandatesWeight !== undefined;
    if (publicWeightPatched !== mandateWeightPatched) {
      const index = ensurePublicComponent();
      scoring.mandatesAsScore = scoring.mandatesAsScore ?? {
        enabled: true,
        weight: 0,
        mandateProgressMode: 'binary',
      };
      scoring.mandatesAsScore.enabled = true;
      if (publicWeightPatched) {
        scoring.mandatesAsScore.weight = 100 - components[index].weight;
      } else {
        components[index].weight = 100 - scoring.mandatesAsScore.weight;
      }
    }

    scoring.components = components;
    const caps = scoring.caps?.capScoreAtIf ?? [];
    const capIndex = caps.findIndex((rule) => rule.id === 'catastrophic_state');
    if (patch.victoryScoring.catastrophicCapEnabled !== undefined) {
      if (!patch.victoryScoring.catastrophicCapEnabled) {
        if (capIndex >= 0) {
          caps.splice(capIndex, 1);
        }
      } else if (capIndex < 0) {
        failPatch('victoryScoring.catastrophicCapEnabled=true requires an existing cap rule with id=catastrophic_state');
      }
    }
    if (patch.victoryScoring.catastrophicCapValue !== undefined) {
      const capValue = patch.victoryScoring.catastrophicCapValue;
      if (!Number.isFinite(capValue) || capValue < 0 || capValue > 100) {
        failPatch(`victoryScoring.catastrophicCapValue=${String(capValue)} must be between 0 and 100`);
      }
      const updatedIndex = caps.findIndex((rule) => rule.id === 'catastrophic_state');
      if (updatedIndex < 0) {
        failPatch('victoryScoring.catastrophicCapValue requires an existing cap rule with id=catastrophic_state');
      }
      caps[updatedIndex].maxScore = capValue;
    }
    if (caps.length > 0) {
      scoring.caps = scoring.caps ?? {};
      scoring.caps.capScoreAtIf = caps;
    } else if (scoring.caps) {
      delete scoring.caps.capScoreAtIf;
    }

    const componentWeight = (scoring.components ?? []).reduce((sum, component) => sum + component.weight, 0);
    const mandateWeight = scoring.mandatesAsScore?.enabled ? (scoring.mandatesAsScore.weight ?? 0) : 0;
    if (Math.abs(componentWeight + mandateWeight - 100) > 1e-9) {
      failPatch(`victoryScoring weights must sum to 100 (components=${componentWeight}, mandates=${mandateWeight})`);
    }
  }

  if (patch.mandates?.relaxAllThresholdsBy !== undefined) {
    const step = patch.mandates.relaxAllThresholdsBy;
    let totalAdjustments = 0;

    for (const faction of ruleset.factions) {
      totalAdjustments += adjustConditionForRelaxation(faction.mandate.condition, step);
    }

    for (const beacon of ruleset.beacons) {
      totalAdjustments += adjustConditionForRelaxation(beacon.condition, step);
    }

    if (ruleset.victoryConditions?.liberation) {
      totalAdjustments += adjustConditionForRelaxation(ruleset.victoryConditions.liberation, step);
    }
    if (ruleset.victoryConditions?.symbolic) {
      totalAdjustments += adjustConditionForRelaxation(ruleset.victoryConditions.symbolic, step);
    }

    if (totalAdjustments === 0) {
      failPatch(`relaxAllThresholdsBy=${step} found no numeric thresholds in scenario=${ruleset.id}`);
    }
  }

  if (patch.actions?.removeActionIds && patch.actions.removeActionIds.length > 0) {
    const toRemove = new Set(patch.actions.removeActionIds);
    const missing = patch.actions.removeActionIds.filter((actionId) => !ruleset.actions.some((action) => action.id === actionId));
    if (missing.length > 0) {
      failPatch(`removeActionIds missing in scenario=${ruleset.id}: ${missing.join(', ')}`);
    }
    ruleset.actions = ruleset.actions.filter((action) => !toRemove.has(action.id));
  }
}

function buildTreatmentScenarioId(experimentId: string, scenarioId: string) {
  const safeExperimentId = experimentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${scenarioId}__exp__${safeExperimentId}__B`;
}

export function applyScenarioPatch(input: ApplyScenarioPatchInput): AppliedScenarioPatch {
  const baseline = getRulesetDefinition(input.scenarioId);
  if (!baseline) {
    throw new Error(`Unknown scenario for experiment patching: ${input.scenarioId}`);
  }

  const treatmentScenarioId = buildTreatmentScenarioId(input.experimentId, input.scenarioId);
  const existingIndex = CONTENT_PACKS.findIndex((ruleset) => ruleset.id === treatmentScenarioId);
  if (existingIndex >= 0) {
    CONTENT_PACKS.splice(existingIndex, 1);
  }

  if (process.env.SIMULATION_WORKER !== '1') {
    logVerbose(`🧪 Applying patch arm=B scenario=${input.scenarioId} experiment=${input.experimentId}`);
  }

  const treatment = deepClone(baseline);
  treatment.id = treatmentScenarioId;
  treatment.name = `${baseline.name} [Experiment B: ${input.experimentId}]`;
  applyPatchToRuleset(treatment, input.patch);

  CONTENT_PACKS.push(treatment);

  const unregister = () => {
    const index = CONTENT_PACKS.findIndex((ruleset) => ruleset.id === treatmentScenarioId);
    if (index >= 0) {
      CONTENT_PACKS.splice(index, 1);
    }
  };

  return {
    baselineScenarioId: baseline.id,
    treatmentScenarioId,
    baselineRuleset: baseline,
    treatmentRuleset: treatment,
    unregister,
  };
}
