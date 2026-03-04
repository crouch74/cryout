import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomController } from '../../room-service/server.ts';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand, type EngineState } from '../../src/engine/index.ts';

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
  let state = initializeGame({ ...startCommand, secretMandates: 'enabled' });
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

function claimAndStartRoom(controller: ReturnType<typeof createRoomController>) {
  const created = controller.createRoom(startCommand);
  assert.equal(created.phase, 'LOBBY');
  assert.equal(created.hostCredential.ownerId, 0);

  const joined = controller.claimOwner(created.roomId, 1);
  if (!joined || !('ownerCredential' in joined)) {
    throw new Error('Expected owner 1 claim to succeed.');
  }

  const active = controller.startRoom(created.roomId, created.hostCredential.ownerToken);
  if (!active || active.phase !== 'ACTIVE') {
    throw new Error('Expected room to become active.');
  }

  return {
    roomId: created.roomId,
    ownerTokens: new Map<number, string>([
      [created.hostCredential.ownerId, created.hostCredential.ownerToken],
      [joined.ownerCredential.ownerId, joined.ownerCredential.ownerToken],
    ]),
    active,
  };
}

test('room creation returns a lobby snapshot and requires claims before start', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand);

  assert.equal(created.phase, 'LOBBY');
  assert.equal(created.owners.length, 2);
  assert.equal(created.owners[0]?.claimed, true);
  assert.equal(created.owners[1]?.claimed, false);
  assert.equal(created.config.secretMandates, 'enabled');

  const startBeforeClaim = controller.startRoom(created.roomId, created.hostCredential.ownerToken);
  assert.deepEqual(startBeforeClaim, { unclaimedOwners: true });
});

test('room service stays in sync with the local table reducer after lobby start', async () => {
  const controller = createRoomController();
  const activated = claimAndStartRoom(controller);
  const local = runLocalSequence();
  let payload: { state: EngineState } | null = null;

  for (const command of local.commands) {
    const ownerId = 'seat' in command ? (startCommand.seatOwnerIds?.[command.seat] ?? 0) : 0;
    payload = controller.applyCommands(activated.roomId, activated.ownerTokens.get(ownerId) ?? '', [command]) as { state: EngineState };
  }

  assert.equal(payload?.state.phase, local.state.phase);
  assert.equal(payload?.state.round, local.state.round);
  assert.equal(payload?.state.globalGaze, local.state.globalGaze);
  assert.equal(payload?.state.northernWarMachine, local.state.northernWarMachine);
  assert.deepEqual(payload?.state.domains, local.state.domains);
  assert.deepEqual(payload?.state.regions, local.state.regions);
});

test('room snapshots reveal private data only for seats owned by the same human player', () => {
  const controller = createRoomController();
  const activated = claimAndStartRoom(controller);
  controller.applyCommands(activated.roomId, activated.ownerTokens.get(0) ?? '', [
    { type: 'ResolveSystemPhase' },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', bodiesCommitted: 1 } },
  ]);

  const ownerZero = controller.getRoom(activated.roomId, activated.ownerTokens.get(0) ?? '') as { state: EngineState; ownerId: number; phase: 'ACTIVE' };
  const ownerOne = controller.getRoom(activated.roomId, activated.ownerTokens.get(1) ?? '') as { state: EngineState; ownerId: number; phase: 'ACTIVE' };

  assert.equal(ownerZero.phase, 'ACTIVE');
  assert.equal(ownerZero.ownerId, 0);
  assert.equal(ownerOne.ownerId, 1);
  assert.equal(ownerZero.state.players[1]?.queuedIntents.length, 1);
  assert.equal(ownerZero.state.players[1]?.queuedIntents[0]?.bodiesCommitted, 1);
  assert.equal(ownerOne.state.players[1]?.queuedIntents[0]?.actionId, 'defend');
  assert.equal(ownerOne.state.players[1]?.queuedIntents[0]?.bodiesCommitted, undefined);
  assert.equal(ownerOne.state.players[1]?.mandateId, '');
  assert.equal(ownerZero.state.secretMandatesEnabled, true);
});

test('room service rejects already-claimed slots and commands before activation', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand);

  assert.deepEqual(controller.claimOwner(created.roomId, 0), { conflict: true });
  assert.deepEqual(
    controller.applyCommands(created.roomId, created.hostCredential.ownerToken, [{ type: 'ResolveSystemPhase' }]),
    { inactive: true },
  );
});

test('room service rejects commands for seats owned by another human player', () => {
  const controller = createRoomController();
  const activated = claimAndStartRoom(controller);

  const response = controller.applyCommands(
    activated.roomId,
    activated.ownerTokens.get(0) ?? '',
    [{ type: 'QueueIntent', seat: 2, action: { actionId: 'organize', regionId: 'Mekong' } }],
  );

  assert.deepEqual(response, { forbidden: true });
});

test('room service issues friendly 11-segment room keys', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand);

  assert.match(created.roomId, /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
});
