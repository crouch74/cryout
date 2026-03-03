import type { CoreEffect, CoreGameState, ScenarioModule } from '../types.ts';

export function runSystemTurn(state: CoreGameState, scenario: ScenarioModule): CoreEffect[] {
  return scenario.behaviors.systemTurnScript(state, scenario, {
    state,
    scenario,
    emittedEvents: [],
    debugTrace: [],
  });
}
