import { type RulesetDefinition } from '../../../engine/index.ts';

export interface MutationDescriptor {
  path: string;
  type: 'number' | 'boolean' | 'nullableInt';
  min?: number;
  max?: number;
}

export function buildMutationSpaceFromScenario(scenario: RulesetDefinition): MutationDescriptor[] {
  const space: MutationDescriptor[] = [];
  
  space.push({ path: 'setup.globalGazeDelta', type: 'number', min: -2, max: 3 });
  space.push({ path: 'setup.northernWarMachineDelta', type: 'number', min: -2, max: 2 });
  space.push({ path: 'setup.seededExtractionTotalDelta', type: 'number', min: -3, max: 3 });
  
  space.push({ path: 'pressure.crisisSpikeExtractionDelta', type: 'number', min: -2, max: 2 });
  space.push({ path: 'pressure.maxExtractionAddedPerRound', type: 'nullableInt', min: 1, max: 4 });
  
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
  if (patch.victoryScoring && (patch.victoryScoring.catastrophicCapEnabled !== undefined || patch.victoryScoring.catastrophicCapValue !== undefined)) {
    if (!scenarioHasCatastrophicCap(scenario)) {
      return false;
    }
  }
  return true;
}
