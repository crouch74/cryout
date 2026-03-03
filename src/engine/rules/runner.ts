import type { ActionCost, CoreCommand, CoreGameState, GameAction, ScenarioModule, ValidationError } from '../types.ts';
import { collectActionModifiers } from './modifiers.ts';

export function validateCommandAction(
  state: CoreGameState,
  command: CoreCommand,
  scenario: ScenarioModule,
): ValidationError[] {
  const action = command.action;
  if (!action) {
    return [];
  }

  return scenario.rules.actionValidators
    .map((validator) => validator(state, action, scenario))
    .filter((entry): entry is ValidationError => Boolean(entry));
}

export function calculateActionCosts(
  state: CoreGameState,
  action: GameAction,
  scenario: ScenarioModule,
): ActionCost[] {
  return scenario.rules.actionCostCalculators.flatMap((calculator) => calculator(state, action, scenario));
}

export function getActionResolutionContext(
  state: CoreGameState,
  action: GameAction | undefined,
  scenario: ScenarioModule,
) {
  return {
    costs: action ? calculateActionCosts(state, action, scenario) : [],
    modifiers: collectActionModifiers(state, action, scenario),
  };
}
