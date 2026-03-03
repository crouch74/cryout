import type { ScenarioModule } from '../types.ts';

export function createFixtureScenario(overrides: Partial<ScenarioModule> = {}): ScenarioModule {
  const scenario: ScenarioModule = {
    metadata: {
      id: 'fixture',
      name: 'Fixture Scenario',
      version: '1.0.0',
      supportedLocales: ['en'],
      summary: 'Internal fixture scenario.',
      assets: {},
    },
    setup: {
      buildInitialState(_options, helpers) {
        return helpers.createBaseState({
          scenarioId: 'fixture',
          scenarioVersion: '1.0.0',
          players: {
            p1: helpers.createPlayer({ id: 'p1', seat: 0 }),
          },
          tracks: {
            momentum: { id: 'momentum', value: 0, min: 0, max: 10, thresholds: [3, 6, 9], metadata: {} },
          },
        });
      },
    },
    content: {
      dictionary: {},
      localeNamespaces: {},
      cards: {},
      decks: {},
      trackDefinitions: {},
      zoneDefinitions: {},
      assets: {},
    },
    rules: {
      phases: [{ id: 'opening', labelKey: 'fixture.phase.opening', order: 0 }],
      predicates: {},
      winEvaluators: [],
      loseEvaluators: [],
      actionValidators: [],
      actionCostCalculators: [],
      modifiers: [],
      difficultyHooks: [],
    },
    behaviors: {
      actionResolvers: {},
      cardResolvers: {},
      deckFactories: {},
      systemTurnScript: () => [],
    },
    ui: {
      getLabel(id, fallback) {
        return fallback ?? id;
      },
    },
    migrations: {
      migrateScenarioState: {},
    },
    hooks: {
      onScenarioLoad: () => undefined,
      onGameSetup: () => undefined,
      onRoundStart: () => undefined,
      onPhaseStart: () => undefined,
      onBeforeAction: () => undefined,
      onAfterAction: () => undefined,
      onEffectResolve: () => undefined,
      onCardDraw: () => undefined,
      onCardResolve: () => undefined,
      onRoundEnd: () => undefined,
      onGameEnd: () => undefined,
    },
  };

  return {
    ...scenario,
    ...overrides,
  };
}
