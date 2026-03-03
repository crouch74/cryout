import type { ActionModifier, CoreGameState, GameAction, ScenarioModule } from '../types.ts';

export function collectActionModifiers(
  state: CoreGameState,
  action: GameAction | undefined,
  scenario: ScenarioModule,
): ActionModifier[] {
  return scenario.rules.modifiers.flatMap((provider) => provider(state, action, scenario));
}
