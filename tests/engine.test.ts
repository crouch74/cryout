import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, listScenarios, type EngineCommand } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  scenarioId: 'witness_dignity',
  mode: 'CORE',
  playerCount: 2,
  roleIds: ['organizer', 'investigative_journalist'],
  seed: 4242,
  expansionIds: [],
};

test('same seed produces deterministic deck order', () => {
  const stateA = initializeGame(startCommand);
  const stateB = initializeGame(startCommand);
  const stateC = initializeGame({ ...startCommand, seed: 9999 });

  assert.deepEqual(stateA.decks.capture.drawPile, stateB.decks.capture.drawPile);
  assert.notDeepEqual(stateA.decks.capture.drawPile, stateC.decks.capture.drawPile);
});

test('phase gating rejects coalition actions during world phase', () => {
  const content = compileContent(startCommand.scenarioId);
  const state = initializeGame(startCommand);
  const next = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, actionId: 'community_mobilization', target: { kind: 'NONE' } },
    content,
  );

  assert.equal(next.phase, 'WORLD');
  assert.equal(next.players[0].queuedIntents.length, 0);
  assert.equal(next.eventLog.at(-1)?.emoji, '❌');
});

test('witness window cancels the first disinfo placement each round', () => {
  const content = compileContent(startCommand.scenarioId);
  let state = initializeGame(startCommand);
  state.resources.evidence = 3;
  state = dispatchCommand(state, { type: 'ResolveWorldPhase' }, content);
  state.fronts.POVERTY.pressure = 7;
  state.phase = 'END';

  const next = dispatchCommand(state, { type: 'ResolveEndPhase' }, content);

  assert.equal(next.roundFlags.witness_window_available, false);
  assert.equal(next.regions.MENA.tokens.disinfo, 0);
  assert.equal(next.regions.SoutheastAsia.tokens.disinfo, 1);
  assert.equal(next.regions.LatinAmerica.tokens.disinfo, 1);
});

test('aid corridor appears when war pressure crosses the trigger', () => {
  const content = compileContent(startCommand.scenarioId);
  const state = initializeGame({ ...startCommand, seed: 7 });
  state.fronts.WAR.pressure = 8;

  const next = dispatchCommand(state, { type: 'ResolveWorldPhase' }, content);

  assert.equal(next.regions.MENA.locks.includes('AidAccess'), true);
});

test('scenario registry exposes the booklet metadata and alternate scenario pack', () => {
  const scenarios = listScenarios();
  const greenResistance = compileContent('green_resistance').scenario;

  assert.equal(scenarios.length >= 2, true);
  assert.equal(greenResistance.name, 'Green Resistance');
  assert.match(greenResistance.gameplay, /climate/i);
  assert.match(greenResistance.mechanics, /Root Solidarity/i);
});
