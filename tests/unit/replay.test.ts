import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  replaySerializedGame,
  serializeGame,
  type EngineCommand,
} from '../../src/engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 1111,
};

test('serialized command log replays to the same snapshot', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  const commands: EngineCommand[] = [
    { type: 'ResolveSystemPhase' },
    { type: 'QueueIntent', seat: 0, action: { actionId: 'organize', regionId: 'Congo' } },
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Congo' } },
    { type: 'SetReady', seat: 0, ready: true },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', comradesCommitted: 1 } },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'international_outreach' } },
    { type: 'SetReady', seat: 1, ready: true },
    { type: 'QueueIntent', seat: 2, action: { actionId: 'organize', regionId: 'Mekong' } },
    { type: 'QueueIntent', seat: 2, action: { actionId: 'investigate', regionId: 'Mekong' } },
    { type: 'SetReady', seat: 2, ready: true },
    { type: 'QueueIntent', seat: 3, action: { actionId: 'organize', regionId: 'Amazon' } },
    { type: 'QueueIntent', seat: 3, action: { actionId: 'international_outreach' } },
    { type: 'SetReady', seat: 3, ready: true },
    { type: 'CommitCoalitionIntent' },
    { type: 'ResolveResolutionPhase' },
  ];

  for (const command of commands) {
    state = dispatchCommand(state, command, content);
  }

  const serialized = serializeGame(state);
  const replayed = replaySerializedGame(serialized);
  const payload = deserializeGame(serialized);

  assert.deepEqual(replayed, payload.snapshot);
  assert.equal(payload.snapshot.eventLog.some((event) => event.context?.cardReveals?.length), true);
  assert.equal(payload.snapshot.eventLog.some((event) => event.context?.cardReveals?.[0]?.origin === 'startup_withdrawal'), true);
  assert.deepEqual(payload.snapshot.players.map((player) => player.ownerId), [0, 0, 1, 1]);
  assert.equal(payload.snapshot.secretMandatesEnabled, true);
  assert.equal(payload.snapshot.players.every((player) => typeof player.mandateSatisfied === 'boolean'), true);
});

test('serialized snapshots preserve local no-mandate tables', () => {
  const localState = initializeGame({ ...startCommand, secretMandates: 'disabled' });
  const payload = deserializeGame(serializeGame(localState));

  assert.equal(payload.snapshot.secretMandatesEnabled, false);
  assert.equal(payload.snapshot.players.every((player) => player.mandateId === ''), true);
  assert.equal(payload.snapshot.players.every((player) => player.mandateSatisfied === false), true);
});

test('deserialize defaults missing mandate satisfaction flags to false', () => {
  const initial = initializeGame(startCommand);
  const serialized = serializeGame(initial);
  const parsed = JSON.parse(serialized) as {
    snapshot: { players: Array<Record<string, unknown>> };
  };
  parsed.snapshot.players = parsed.snapshot.players.map((player) => {
    const next = { ...player };
    delete next.mandateSatisfied;
    return next;
  });

  const deserialized = deserializeGame(JSON.stringify(parsed));
  assert.equal(deserialized.snapshot.players.every((player) => player.mandateSatisfied === false), true);
});
