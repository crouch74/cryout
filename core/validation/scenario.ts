import type { ScenarioModule, ValidationError } from '../types.ts';

export function validateScenarioModule(scenario: ScenarioModule): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!scenario.metadata.id) {
    errors.push({ code: 'scenario.missing_id', message: 'Scenario metadata.id is required.', path: 'metadata.id' });
  }
  if (!scenario.metadata.version) {
    errors.push({ code: 'scenario.missing_version', message: 'Scenario metadata.version is required.', path: 'metadata.version' });
  }
  if (scenario.rules.phases.length === 0) {
    errors.push({ code: 'scenario.missing_phases', message: 'Scenario rules must define at least one phase.', path: 'rules.phases' });
  }

  const hookNames = [
    'onScenarioLoad',
    'onGameSetup',
    'onRoundStart',
    'onPhaseStart',
    'onBeforeAction',
    'onAfterAction',
    'onEffectResolve',
    'onCardDraw',
    'onCardResolve',
    'onRoundEnd',
    'onGameEnd',
  ] as const;

  for (const hookName of hookNames) {
    if (typeof scenario.hooks[hookName] !== 'function') {
      errors.push({
        code: 'scenario.missing_hook',
        message: `Scenario hook ${hookName} must be defined.`,
        path: `hooks.${hookName}`,
      });
    }
  }

  return errors;
}
