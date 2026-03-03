import { validateScenarioModule } from '../validation/scenario.ts';
import type { ScenarioModule, ValidationError } from '../types.ts';

export function assertScenarioConformance(scenario: ScenarioModule): ValidationError[] {
  return validateScenarioModule(scenario);
}
