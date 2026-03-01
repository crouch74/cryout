import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, listRulesets, type EngineCommand } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  playerCount: 2,
  factionIds: ['congo_basin_collective', 'levant_sumud'],
  seed: 4242,
};

test('canonical ruleset registry exposes the design-faithful cutover ruleset', () => {
  const rulesets = listRulesets();
  assert.equal(rulesets.length, 1);
  assert.equal(rulesets[0]?.id, 'base_design');
  assert.equal(rulesets[0]?.regions.length, 6);
});

test('same seed produces deterministic system deck order', () => {
  const stateA = initializeGame(startCommand);
  const stateB = initializeGame(startCommand);
  const stateC = initializeGame({ ...startCommand, seed: 99 });

  assert.deepEqual(stateA.decks.system.drawPile, stateB.decks.system.drawPile);
  assert.notDeepEqual(stateA.decks.system.drawPile, stateC.decks.system.drawPile);
});

test('phase gating rejects coalition actions during system phase', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  const next = dispatchCommand(
    state,
    {
      type: 'QueueIntent',
      seat: 0,
      action: { actionId: 'organize', regionId: 'Congo' },
    },
    content,
  );

  assert.equal(next.phase, 'SYSTEM');
  assert.equal(next.players[0].queuedIntents.length, 0);
  assert.equal(next.eventLog.at(-1)?.emoji, '❌');
});

test('symbolic mode reveals exactly three active beacons', () => {
  const state = initializeGame({ ...startCommand, mode: 'SYMBOLIC' });
  assert.equal(state.activeBeaconIds.length, 3);
  assert.equal(state.activeBeaconIds.every((beaconId) => state.beacons[beaconId]?.active), true);
});

test('system cards use authored vulnerability to target local harm', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.decks.system.drawPile = ['sys_carceral_decree'];

  const next = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);

  assert.equal(next.regions.Levant.extractionTokens, state.regions.Levant.extractionTokens + 1);
  assert.equal(next.phase, 'COALITION');
});

test('any region reaching six extraction tokens causes immediate defeat', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.regions.Levant.extractionTokens = 5;
  state.decks.system.drawPile = ['sys_carceral_decree'];

  const next = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.match(next.lossReason ?? '', /Levant/);
});

test('liberation victory requires the public win and all active mandates', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 1;
  }
  state.northernWarMachine = 5;
  state.domains.DyingPlanet.progress = 2;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'WIN');
  assert.match(next.winner ?? '', /Liberation/);
});

test('a failed mandate voids a public liberation win', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 1;
  }
  state.northernWarMachine = 7;
  state.domains.DyingPlanet.progress = 0;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.match(next.lossReason ?? '', /secret mandate/i);
  assert.equal(next.players.every((player) => player.mandateRevealed), true);
});

test('launch campaign consumes 2d6 of rng and can remove extraction on success', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.players[0].actionsRemaining = 1;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Congo', domainId: 'DyingPlanet', bodiesCommitted: 2, evidenceCommitted: 1 } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  state.players[1].actionsRemaining = 0;
  state.players[1].ready = true;
  const rngCallsBefore = state.rng.calls;

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);

  assert.equal(next.rng.calls, rngCallsBefore + 2);
  assert.equal(next.phase, 'RESOLUTION');
  assert.equal(next.regions.Congo.extractionTokens <= state.regions.Congo.extractionTokens, true);
});
