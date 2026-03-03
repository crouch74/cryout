import { createBaseState, createDefaultDeck, createDefaultPlayer } from './validation/state.ts';
import { validateScenarioModule } from './validation/scenario.ts';
import { resolveEffectQueue } from './effects/queue.ts';
import type { CoreDeckState, CoreGameState, CreateGameOptions, ScenarioModule, ScenarioSetupHelpers } from './types.ts';
import { CORE_VERSION } from './version.ts';

function createHelpers(): ScenarioSetupHelpers {
  return {
    createBaseState,
    createPlayer: createDefaultPlayer,
    createDeck(deckId, cards) {
      return createDefaultDeck(deckId, cards);
    },
  };
}

function appendHookEvents(
  state: CoreGameState,
  emittedEvents: import('./types.ts').StructuredEvent[],
  events: import('./types.ts').StructuredEvent[] | undefined,
) {
  for (const event of events ?? []) {
    emittedEvents.push(event);
    state.log.push({
      ...event,
      round: state.round,
      phaseId: state.phase.id,
    });
  }
}

function buildScenarioDecks(state: CoreGameState, scenario: ScenarioModule): Record<string, CoreDeckState> {
  const decks = { ...state.decks };

  for (const [deckId, factory] of Object.entries(scenario.behaviors.deckFactories)) {
    decks[deckId] = factory(state, scenario);
  }

  if (Object.keys(decks).length === 0) {
    for (const [deckId, cardIds] of Object.entries(scenario.content.decks)) {
      decks[deckId] = createDefaultDeck(deckId, cardIds.map((cardId) => scenario.content.cards[cardId]).filter(Boolean));
    }
  }

  return decks;
}

export function createGameState(scenario: ScenarioModule, options: CreateGameOptions): CoreGameState {
  const errors = validateScenarioModule(scenario);
  if (errors.length > 0) {
    throw new Error(`Scenario ${scenario.metadata.id} is invalid: ${errors.map((entry) => entry.message).join(' ')}`);
  }

  if (scenario.behaviors.commandBridge?.createInitialState) {
    return scenario.behaviors.commandBridge.createInitialState(scenario, options);
  }

  const helpers = createHelpers();
  const initial = scenario.setup.buildInitialState(options, helpers);
  const state = createBaseState({
    ...initial,
    coreVersion: CORE_VERSION,
    scenarioId: scenario.metadata.id,
    scenarioVersion: scenario.metadata.version,
    seed: options.seed,
    flags: {
      mode: options.mode ?? 'default',
      locale: options.locale ?? 'en',
      difficulty: options.difficulty ?? 'standard',
      ...(options.initialFlags ?? {}),
      ...(initial.flags ?? {}),
    },
    counters: {
      ...(options.initialCounters ?? {}),
      ...(initial.counters ?? {}),
    },
    scenarioState: {
      ...(options.initialScenarioState ?? {}),
      ...(initial.scenarioState ?? {}),
    },
  });

  state.decks = buildScenarioDecks(state, scenario);
  state.status = 'running';
  state.phase = scenario.rules.phases[0]
    ? { id: scenario.rules.phases[0].id, index: scenario.rules.phases[0].order }
    : state.phase;

  const emittedEvents: import('./types.ts').StructuredEvent[] = [];
  const debugTrace: string[] = [];

  const loadHook = scenario.hooks.onScenarioLoad({
    state,
    scenario,
    emittedEvents,
    debugTrace,
  });
  if (loadHook?.effects?.length) {
    resolveEffectQueue(state, loadHook.effects, scenario, undefined, undefined, emittedEvents, debugTrace);
  }
  appendHookEvents(state, emittedEvents, loadHook?.events);
  debugTrace.push(...(loadHook?.debug ?? []));

  const setupHook = scenario.hooks.onGameSetup({
    state,
    scenario,
    emittedEvents,
    debugTrace,
  });
  if (setupHook?.effects?.length) {
    resolveEffectQueue(state, setupHook.effects, scenario, undefined, undefined, emittedEvents, debugTrace);
  }
  appendHookEvents(state, emittedEvents, setupHook?.events);
  debugTrace.push(...(setupHook?.debug ?? []));

  const roundStartHook = scenario.hooks.onRoundStart({
    state,
    scenario,
    emittedEvents,
    debugTrace,
  });
  if (roundStartHook?.effects?.length) {
    resolveEffectQueue(state, roundStartHook.effects, scenario, undefined, undefined, emittedEvents, debugTrace);
  }
  appendHookEvents(state, emittedEvents, roundStartHook?.events);
  debugTrace.push(...(roundStartHook?.debug ?? []));

  const phaseStartHook = scenario.hooks.onPhaseStart(state.phase.id, {
    state,
    scenario,
    emittedEvents,
    debugTrace,
  });
  if (phaseStartHook?.effects?.length) {
    resolveEffectQueue(state, phaseStartHook.effects, scenario, undefined, undefined, emittedEvents, debugTrace);
  }
  appendHookEvents(state, emittedEvents, phaseStartHook?.events);
  debugTrace.push(...(phaseStartHook?.debug ?? []));

  if (debugTrace.length > 0) {
    state.scenarioState.__debugTrace = debugTrace as unknown as import('./types.ts').JsonValue;
  }

  return state;
}
