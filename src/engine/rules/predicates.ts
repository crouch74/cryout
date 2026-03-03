import type { CoreGameState, RuleExpression, ScenarioModule } from '../types.ts';

export function evaluateRuleExpression(
  state: CoreGameState,
  expression: RuleExpression,
  scenario: ScenarioModule,
): boolean {
  switch (expression.kind) {
    case 'predicate': {
      const predicate = scenario.rules.predicates[expression.predicateId];
      return predicate ? predicate(state, expression.args, scenario) : false;
    }
    case 'all':
      return expression.rules.every((rule) => evaluateRuleExpression(state, rule, scenario));
    case 'any':
      return expression.rules.some((rule) => evaluateRuleExpression(state, rule, scenario));
    case 'not':
      return !evaluateRuleExpression(state, expression.rule, scenario);
  }
}
