import { evaluateRuleExpression } from '../../../engine/index.ts';
import type { ActionCostCalculator, ActionValidator, OutcomeEvaluator, PredicateEvaluator } from '../../types.ts';

const predicates: Record<string, PredicateEvaluator> = {
  hope_at_least(state, args) {
    return state.tracks.hope.value >= Number(args?.value ?? 0);
  },
  pressure_at_least(state, args) {
    return state.tracks.pressure.value >= Number(args?.value ?? 0);
  },
  breakthrough_resolved(state) {
    return Boolean(state.flags.breakthroughResolved);
  },
};

const validators: ActionValidator[] = [
  (state, action) => {
    if (action.id === 'archive_testimony' && (state.players[action.actorId ?? '']?.resources.testimony ?? 0) <= 0) {
      return {
        code: 'example_hooks.no_testimony',
        message: 'archive_testimony requires at least 1 testimony.',
      };
    }
    return null;
  },
];

const costCalculators: ActionCostCalculator[] = [
  (state, action) => {
    if (action.id !== 'archive_testimony') {
      return [];
    }

    const cost = state.tracks.pressure.value >= 4 ? 2 : 1;
    return [
      {
        resourceId: 'testimony',
        amount: cost,
        source: 'example_hooks.archive_testimony',
      },
    ];
  },
];

const winEvaluators: OutcomeEvaluator[] = [
  (state, scenario) => {
    const expression = {
      kind: 'all' as const,
      rules: [
        { kind: 'predicate' as const, predicateId: 'hope_at_least', args: { value: 5 } },
        { kind: 'predicate' as const, predicateId: 'breakthrough_resolved' },
      ],
    };

    return evaluateRuleExpression(state, expression, scenario)
      ? {
          status: 'won',
          reasonId: 'example_hooks.collective_breakthrough',
          summary: { hope: state.tracks.hope.value },
        }
      : null;
  },
];

const loseEvaluators: OutcomeEvaluator[] = [
  (state, scenario) => {
    const expression = {
      kind: 'predicate' as const,
      predicateId: 'pressure_at_least',
      args: { value: 7 },
    };
    return evaluateRuleExpression(state, expression, scenario)
      ? {
          status: 'lost',
          reasonId: 'example_hooks.system_overrun',
          summary: { pressure: state.tracks.pressure.value },
        }
      : null;
  },
];

export const rules = {
  phases: [
    { id: 'briefing', labelKey: 'scenario.example_hooks.phase.briefing', order: 0 },
    { id: 'story_pulse', labelKey: 'scenario.example_hooks.phase.story_pulse', order: 1 },
    { id: 'system', labelKey: 'scenario.example_hooks.phase.system', order: 2 },
    { id: 'coalition', labelKey: 'scenario.example_hooks.phase.coalition', order: 3 },
    { id: 'resolution', labelKey: 'scenario.example_hooks.phase.resolution', order: 4 },
  ],
  predicates,
  winEvaluators,
  loseEvaluators,
  actionValidators: validators,
  actionCostCalculators: costCalculators,
  modifiers: [],
  difficultyHooks: [],
};
