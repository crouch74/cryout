import { createGameState, dispatchCoreCommand } from '../../engine/index.ts';
import type { CoreCommand, CreateGameOptions, ScenarioModule } from '../types.ts';

export function createScenarioHarness(scenario: ScenarioModule, options: CreateGameOptions) {
  let state = createGameState(scenario, options);

  return {
    getState() {
      return state;
    },
    dispatch(command: CoreCommand) {
      const result = dispatchCoreCommand(state, command, scenario);
      state = result.state;
      return result;
    },
  };
}
