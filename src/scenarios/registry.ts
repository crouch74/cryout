import { createCompatCommandBridge } from '../engine/adapters/compat/legacy/adapter.ts';
import type { ScenarioMetadata, ScenarioModule } from './types.ts';
import algerianWarOfIndependenceScenario from './algerian_war_of_independence/index.ts';
import stonesCryOutScenario from './stones_cry_out/index.ts';
import tahrirSquareScenario from './tahrir_square/index.ts';
import womanLifeFreedomScenario from './woman_life_freedom/index.ts';
import egypt1919RevolutionScenario from './egypt_1919_revolution/index.ts';

function withCompatBridge(scenario: ScenarioModule): ScenarioModule {
  return {
    ...scenario,
    behaviors: {
      ...scenario.behaviors,
      commandBridge: createCompatCommandBridge(),
    },
  };
}

const SCENARIO_MAP = new Map<string, ScenarioModule>([
  [stonesCryOutScenario.metadata.id, withCompatBridge(stonesCryOutScenario)],
  [tahrirSquareScenario.metadata.id, withCompatBridge(tahrirSquareScenario)],
  [womanLifeFreedomScenario.metadata.id, withCompatBridge(womanLifeFreedomScenario)],
  [algerianWarOfIndependenceScenario.metadata.id, withCompatBridge(algerianWarOfIndependenceScenario)],
  [egypt1919RevolutionScenario.metadata.id, withCompatBridge(egypt1919RevolutionScenario)],
]);

export function getScenarioModule(id: string): ScenarioModule | undefined {
  return SCENARIO_MAP.get(id);
}

export function listScenarioModules(): ScenarioModule[] {
  return Array.from(SCENARIO_MAP.values());
}

export function listScenarioMetadata(): ScenarioMetadata[] {
  return listScenarioModules().map((scenario) => scenario.metadata);
}
