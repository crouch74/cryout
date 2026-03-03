import type { CoreGameState, GameResult, ScenarioModule } from '../types.ts';

export function evaluateGameResult(
  state: CoreGameState,
  scenario: ScenarioModule,
): GameResult | null {
  for (const evaluator of scenario.rules.loseEvaluators) {
    const result = evaluator(state, scenario);
    if (result) {
      return result;
    }
  }

  for (const evaluator of scenario.rules.winEvaluators) {
    const result = evaluator(state, scenario);
    if (result) {
      return result;
    }
  }

  return null;
}
