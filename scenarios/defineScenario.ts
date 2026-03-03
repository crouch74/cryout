import type { HookResult, ScenarioLifecycleHooks, ScenarioModule, ScenarioModuleInput, ScenarioRules } from './types.ts';

const NOOP_HOOK = (): HookResult | void => undefined;

function buildDefaultHooks(): ScenarioLifecycleHooks {
  return {
    onScenarioLoad: NOOP_HOOK,
    onGameSetup: NOOP_HOOK,
    onRoundStart: NOOP_HOOK,
    onPhaseStart: () => undefined,
    onBeforeAction: () => undefined,
    onAfterAction: () => undefined,
    onEffectResolve: () => undefined,
    onCardDraw: () => undefined,
    onCardResolve: () => undefined,
    onRoundEnd: NOOP_HOOK,
    onGameEnd: () => undefined,
  };
}

function buildDefaultRules(rules: ScenarioModuleInput['rules']): ScenarioRules {
  return {
    phases: rules.phases ?? [],
    predicates: rules.predicates ?? {},
    winEvaluators: rules.winEvaluators ?? [],
    loseEvaluators: rules.loseEvaluators ?? [],
    actionValidators: rules.actionValidators ?? [],
    actionCostCalculators: rules.actionCostCalculators ?? [],
    modifiers: rules.modifiers ?? [],
    difficultyHooks: rules.difficultyHooks ?? [],
  };
}

export function defineScenario(input: ScenarioModuleInput): ScenarioModule {
  return {
    metadata: input.metadata,
    setup: input.setup,
    content: {
      dictionary: input.content.dictionary ?? {},
      localeNamespaces: input.content.localeNamespaces ?? {},
      cards: input.content.cards ?? {},
      decks: input.content.decks ?? {},
      trackDefinitions: input.content.trackDefinitions ?? {},
      zoneDefinitions: input.content.zoneDefinitions ?? {},
      assets: input.content.assets ?? {},
      legacy: input.content.legacy ?? {},
    },
    rules: buildDefaultRules(input.rules),
    behaviors: {
      actionResolvers: input.behaviors.actionResolvers ?? {},
      cardResolvers: input.behaviors.cardResolvers ?? {},
      deckFactories: input.behaviors.deckFactories ?? {},
      systemTurnScript: input.behaviors.systemTurnScript,
      weightedRandomPolicies: input.behaviors.weightedRandomPolicies ?? {},
      crisisInjectionRules: input.behaviors.crisisInjectionRules ?? [],
      commandBridge: input.behaviors.commandBridge,
    },
    ui: input.ui,
    observability: input.observability,
    migrations: {
      migrateScenarioState: input.migrations?.migrateScenarioState ?? {},
    },
    hooks: {
      ...buildDefaultHooks(),
      ...(input.hooks ?? {}),
    },
  };
}
