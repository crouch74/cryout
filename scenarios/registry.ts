import { createLegacyCommandBridge } from '../engine/legacy/adapter.ts';
import type { ScenarioMetadata, ScenarioModule } from './types.ts';
import baseDesignScenario from './base_design/index.ts';
import exampleHooksScenario from './example_hooks/index.ts';
import tahrirSquareScenario from './tahrir_square/index.ts';
import womanLifeFreedomScenario from './woman_life_freedom/index.ts';

function withLegacyBridge(scenario: ScenarioModule): ScenarioModule {
  return {
    ...scenario,
    behaviors: {
      ...scenario.behaviors,
      commandBridge: createLegacyCommandBridge(),
    },
  };
}

const SCENARIO_MAP = new Map<string, ScenarioModule>([
  [baseDesignScenario.metadata.id, withLegacyBridge(baseDesignScenario)],
  [tahrirSquareScenario.metadata.id, withLegacyBridge(tahrirSquareScenario)],
  [womanLifeFreedomScenario.metadata.id, withLegacyBridge(womanLifeFreedomScenario)],
  [exampleHooksScenario.metadata.id, exampleHooksScenario],
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
