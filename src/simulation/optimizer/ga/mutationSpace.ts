import { type RulesetDefinition } from '../../../engine/index.ts';

export interface MutationDescriptor {
  path: string;
  type: 'number' | 'boolean' | 'nullableInt';
  min?: number;
  max?: number;
}

function rulesetHasCrisisExtractionAdds(scenario: RulesetDefinition) {
  return scenario.crisisCards.some((card) => card.effects.some((effect) => effect.type === 'add_extraction'));
}

function rulesetHasAnyExtractionAdds(scenario: RulesetDefinition) {
  return scenario.crisisCards.some((card) => card.effects.some((effect) => effect.type === 'add_extraction'))
    || scenario.systemCards.some((card) => card.onReveal.some((effect) => effect.type === 'add_extraction'));
}

function getSeededExtractionMutationBounds(scenario: RulesetDefinition) {
  const seedEntries = Object.values(scenario.setup?.extractionSeeds ?? {});
  const seededFrontCount = seedEntries.length;
  const totalSeededExtraction = seedEntries.reduce((sum, amount) => sum + (amount ?? 0), 0);

  if (seededFrontCount === 0) {
    return undefined;
  }

  return {
    min: -Math.min(3, totalSeededExtraction),
    max: 3,
  };
}

export function buildMutationSpaceFromScenario(scenario: RulesetDefinition): MutationDescriptor[] {
  const space: MutationDescriptor[] = [];
  
  space.push({ path: 'setup.globalGazeDelta', type: 'number', min: -2, max: 3 });
  space.push({ path: 'setup.northernWarMachineDelta', type: 'number', min: -2, max: 2 });
  const seededExtractionBounds = getSeededExtractionMutationBounds(scenario);
  if (seededExtractionBounds) {
    space.push({
      path: 'setup.seededExtractionTotalDelta',
      type: 'number',
      min: seededExtractionBounds.min,
      max: seededExtractionBounds.max,
    });
  }
  
  if (rulesetHasCrisisExtractionAdds(scenario)) {
    space.push({ path: 'pressure.crisisSpikeExtractionDelta', type: 'number', min: -2, max: 2 });
  }
  if (rulesetHasAnyExtractionAdds(scenario)) {
    space.push({ path: 'pressure.maxExtractionAddedPerRound', type: 'nullableInt', min: 1, max: 4 });
  }
  
  space.push({ path: 'victory.liberationThresholdDelta', type: 'number', min: -2, max: 2 });
  space.push({ path: 'mandates.relaxAllThresholdsBy', type: 'number', min: -1, max: 3 });
  
  space.push({ path: 'victoryScoring.scoreThreshold', type: 'number', min: 65, max: 75 });
  space.push({ path: 'victoryScoring.publicVictoryWeight', type: 'number', min: 30, max: 50 });
  space.push({ path: 'victoryScoring.mandatesWeight', type: 'number', min: 40, max: 60 });

  if (scenarioHasCatastrophicCap(scenario)) {
    space.push({ path: 'victoryScoring.catastrophicCapEnabled', type: 'boolean' });
    space.push({ path: 'victoryScoring.catastrophicCapValue', type: 'number', min: 60, max: 75 });
  }

  return space;
}

export function scenarioHasCatastrophicCap(scenario: RulesetDefinition) {
  return Boolean(scenario?.victoryScoring?.caps?.capScoreAtIf?.some((rule) => rule.id === 'catastrophic_state'));
}

export function pathExists(scenario: RulesetDefinition, path: string): boolean {
  if (path === 'victoryScoring.catastrophicCapEnabled' || path === 'victoryScoring.catastrophicCapValue') {
    return scenarioHasCatastrophicCap(scenario);
  }
  // All other fields are structurally defined in ScenarioPatch and valid
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateScenarioPatch(patch: any, scenario: RulesetDefinition): boolean {
  const seededExtractionDelta = patch.setup?.seededExtractionTotalDelta;
  if (typeof seededExtractionDelta === 'number') {
    const seededExtractionBounds = getSeededExtractionMutationBounds(scenario);
    if (!seededExtractionBounds) {
      return false;
    }
    if (seededExtractionDelta < seededExtractionBounds.min || seededExtractionDelta > seededExtractionBounds.max) {
      return false;
    }
  }
  if (patch.pressure?.crisisSpikeExtractionDelta !== undefined && !rulesetHasCrisisExtractionAdds(scenario)) {
    return false;
  }
  if (patch.pressure?.maxExtractionAddedPerRound !== undefined && !rulesetHasAnyExtractionAdds(scenario)) {
    return false;
  }
  if (patch.victoryScoring && (patch.victoryScoring.catastrophicCapEnabled !== undefined || patch.victoryScoring.catastrophicCapValue !== undefined)) {
    if (!scenarioHasCatastrophicCap(scenario)) {
      return false;
    }
  }
  return true;
}
