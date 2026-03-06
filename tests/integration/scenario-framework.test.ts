import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_CORE_COMMANDS,
  assertScenarioConformance,
  createGameState,
  deserializeSave,
  dispatchCoreCommand,
  serializeSave,
  validateCoreInvariants,
} from '../../src/engine/index.ts';
import {
  getScenarioModule,
  listScenarioMetadata,
  listScenarioModules,
} from '../../src/scenarios/index.ts';
import { createScenarioHarness, exampleHooksScenario } from '../../src/scenarios/testing/index.ts';

const registry = {
  get(id: string) {
    return getScenarioModule(id) ?? (id === exampleHooksScenario.metadata.id ? exampleHooksScenario : undefined);
  },
  list() {
    return [...listScenarioModules(), exampleHooksScenario];
  },
};

test('scenario registry exposes only shipped scenarios', () => {
  const ids = listScenarioMetadata().map((scenario) => scenario.id).sort();

  assert.deepEqual(ids, ['algerian_war_of_independence', 'stones_cry_out', 'tahrir_square', 'woman_life_freedom']);
});

test('testing scenarios stay outside the shipped registry', () => {
  assert.equal(getScenarioModule(exampleHooksScenario.metadata.id), undefined);
});

test('all scenario modules conform to the required framework contract', () => {
  for (const scenario of listScenarioModules()) {
    const errors = assertScenarioConformance(scenario);
    assert.deepEqual(errors, [], scenario.metadata.id);
  }

  assert.deepEqual(assertScenarioConformance(exampleHooksScenario), []);
});

test('compat-backed shipped scenarios create deterministic projected core states', () => {
  const summaries = Object.fromEntries(
    ['stones_cry_out', 'tahrir_square', 'woman_life_freedom', 'algerian_war_of_independence'].map((scenarioId) => {
      const scenario = getScenarioModule(scenarioId);
      assert.ok(scenario);
      const state = createGameState(scenario, { seed: 4242, mode: 'LIBERATION' });
      return [
        scenarioId,
        {
          phase: state.phase.id,
          players: Object.keys(state.players).length,
          zones: Object.keys(state.zones).length,
          hasLegacyState: Boolean(state.scenarioState.legacyState),
          hopeLikeTracks: Object.keys(state.tracks).length >= 3,
        },
      ];
    }),
  );

  assert.deepEqual(summaries, {
    stones_cry_out: {
      phase: 'system',
      players: 4,
      zones: 6,
      hasLegacyState: true,
      hopeLikeTracks: true,
    },
    tahrir_square: {
      phase: 'system',
      players: 4,
      zones: 6,
      hasLegacyState: true,
      hopeLikeTracks: true,
    },
    woman_life_freedom: {
      phase: 'system',
      players: 4,
      zones: 6,
      hasLegacyState: true,
      hopeLikeTracks: true,
    },
    algerian_war_of_independence: {
      phase: 'system',
      players: 4,
      zones: 6,
      hasLegacyState: true,
      hopeLikeTracks: true,
    },
  });
});

test('compat-backed scenarios can dispatch through the command bridge', () => {
  const scenario = getScenarioModule('stones_cry_out');
  assert.ok(scenario);
  const state = createGameState(scenario, { seed: 1234, mode: 'LIBERATION' });

  const result = dispatchCoreCommand(state, { type: 'ResolveSystemPhase' }, scenario);

  assert.equal(result.validationErrors.length, 0);
  assert.equal(result.state.phase.id, 'coalition');
  assert.equal(result.emittedEvents.length > 0, true);
  assert.equal(Boolean(result.state.scenarioState.legacyState), true);
});

test('example_hooks scenario exercises native hooks, cards, win checks, and system events', () => {
  const harness = createScenarioHarness(exampleHooksScenario, { seed: 77 });

  const initial = harness.getState();
  assert.equal(initial.phase.id, 'briefing');
  assert.equal(Array.isArray(initial.scenarioState.__debugTrace), true);

  const organize = harness.dispatch({
    type: BUILT_IN_CORE_COMMANDS.action,
    action: {
      id: 'organize_cells',
      actorId: 'seat:0',
      zoneId: 'commons',
    },
  });

  assert.equal(organize.state.tracks.hope.value, 3);
  assert.equal(organize.state.zones.commons.counters.assemblies, 1);
  assert.equal(organize.debugTrace.some((entry) => entry.includes('Before action organize_cells')), true);
  assert.equal(organize.debugTrace.some((entry) => entry.includes('After action organize_cells')), true);

  const firstArchive = harness.dispatch({
    type: BUILT_IN_CORE_COMMANDS.action,
    action: {
      id: 'archive_testimony',
      actorId: 'seat:0',
      zoneId: 'commons',
    },
  });

  assert.equal(firstArchive.emittedEvents.some((event) => event.type === 'example_hooks.card_draw'), true);
  assert.equal(firstArchive.state.flags.breakthroughResolved ?? false, false);

  harness.getState().players['seat:0'].resources.testimony = 2;
  const secondArchive = harness.dispatch({
    type: BUILT_IN_CORE_COMMANDS.action,
    action: {
      id: 'archive_testimony',
      actorId: 'seat:0',
      zoneId: 'commons',
    },
  });

  assert.equal(secondArchive.emittedEvents.some((event) => event.type === 'example_hooks.card_resolve'), true);
  assert.equal(secondArchive.emittedEvents.some((event) => event.type === 'example_hooks.game_end'), true);
  assert.equal(secondArchive.state.flags.breakthroughResolved, true);
  assert.equal(secondArchive.state.status, 'won');

  const systemStep = harness.dispatch({ type: BUILT_IN_CORE_COMMANDS.runSystem });
  assert.equal(systemStep.emittedEvents.some((event) => event.type === 'example_hooks.system_step'), true);
  assert.equal(systemStep.emittedEvents.some((event) => event.type === 'example_hooks.weighted_policy'), true);
});

test('core saves round-trip through the scenario registry and run migrations', () => {
  const state = createGameState(exampleHooksScenario, { seed: 88 });
  state.scenarioState.custom = { value: 1 } as unknown as import('../../src/engine/types.ts').JsonValue;

  const payload = serializeSave(state);
  const restored = deserializeSave(JSON.stringify(payload), registry);

  assert.equal(restored.state.scenarioId, 'example_hooks');
  assert.equal((restored.state.scenarioState.migrationApplied as boolean | undefined) ?? false, true);
});

test('core invariant checks catch duplicate cards in a deck', () => {
  const state = createGameState(exampleHooksScenario, { seed: 99 });
  state.decks.spark.drawPile.push('scripted_breakthrough');
  state.decks.spark.discardPile.push('scripted_breakthrough');

  const errors = validateCoreInvariants(state);

  assert.equal(errors.some((entry) => entry.code === 'invariant.duplicate_card'), true);
});
