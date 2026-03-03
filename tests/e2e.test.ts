import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomController } from '../room-service/server.ts';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand, type EngineState } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 7070,
};

function runLocalSequence() {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  const commands: EngineCommand[] = [
    { type: 'ResolveSystemPhase' },
    { type: 'QueueIntent', seat: 0, action: { actionId: 'organize', regionId: 'Congo' } },
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Congo' } },
    { type: 'SetReady', seat: 0, ready: true },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', bodiesCommitted: 1 } },
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

  return { commands, state };
}

test('room service stays in sync with the local table reducer', async () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as {
    roomId: string;
    ownerTokens: Array<{ ownerId: number; ownerToken: string }>;
    state: EngineState;
  };
  const local = runLocalSequence();
  let payload: { state: EngineState } | null = null;
  const ownerTokens = new Map(created.ownerTokens.map((credential) => [credential.ownerId, credential.ownerToken]));

  for (const command of local.commands) {
    const ownerId = 'seat' in command ? (startCommand.seatOwnerIds?.[command.seat] ?? 0) : 0;
    payload = controller.applyCommands(created.roomId, ownerTokens.get(ownerId) ?? '', [command]) as { state: EngineState };
  }

  assert.equal(payload?.state.phase, local.state.phase);
  assert.equal(payload?.state.round, local.state.round);
  assert.equal(payload?.state.globalGaze, local.state.globalGaze);
  assert.equal(payload?.state.northernWarMachine, local.state.northernWarMachine);
  assert.deepEqual(payload?.state.domains, local.state.domains);
  assert.deepEqual(payload?.state.regions, local.state.regions);
});

test('room snapshots reveal private data for all seats owned by the same human player', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as {
    roomId: string;
    ownerTokens: Array<{ ownerId: number; ownerToken: string }>;
    state: EngineState;
  };
  controller.applyCommands(created.roomId, created.ownerTokens[0]?.ownerToken ?? '', [
    { type: 'ResolveSystemPhase' },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', bodiesCommitted: 1 } },
  ]);

  const ownerZero = controller.getRoom(created.roomId, created.ownerTokens[0]?.ownerToken ?? '') as { state: EngineState; ownerId: number };
  const ownerOne = controller.getRoom(created.roomId, created.ownerTokens[1]?.ownerToken ?? '') as { state: EngineState; ownerId: number };

  assert.equal(ownerZero.ownerId, 0);
  assert.equal(ownerOne.ownerId, 1);
  assert.equal(ownerZero.state.players[1]?.queuedIntents.length, 1);
  assert.equal(ownerZero.state.players[1]?.queuedIntents[0]?.bodiesCommitted, 1);
  assert.equal(ownerOne.state.players[1]?.queuedIntents[0]?.actionId, 'defend');
  assert.equal(ownerOne.state.players[1]?.queuedIntents[0]?.bodiesCommitted, undefined);
  assert.equal(ownerOne.state.players[1]?.mandateId, '');
  assert.equal(ownerZero.state.players[2]?.resistanceHand.length, 0);
  assert.equal(ownerZero.state.players[3]?.resistanceHand.length, 0);
  assert.equal(ownerOne.state.players[0]?.resistanceHand.length, 0);
  assert.equal(ownerOne.state.players[1]?.resistanceHand.length, 0);
  assert.equal(ownerZero.state.eventLog.some((event) => event.context?.cardReveals?.[0]?.deckId === 'resistance'), true);
});

test('room service rejects commands for seats owned by another human player', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as {
    roomId: string;
    ownerTokens: Array<{ ownerId: number; ownerToken: string }>;
  };

  const response = controller.applyCommands(
    created.roomId,
    created.ownerTokens[0]?.ownerToken ?? '',
    [{ type: 'QueueIntent', seat: 2, action: { actionId: 'organize', regionId: 'Mekong' } }],
  );

  assert.deepEqual(response, { forbidden: true });
});

test('room service issues friendly 11-segment room keys', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as { roomId: string };

  assert.match(created.roomId, /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
});
