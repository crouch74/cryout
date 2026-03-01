import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomController } from '../room-service/server.ts';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand, type EngineState } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  playerCount: 2,
  factionIds: ['congo_basin_collective', 'levant_sumud'],
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
    seatTokens: Array<{ seat: number; seatToken: string }>;
    state: EngineState;
  };
  const local = runLocalSequence();
  const payload = controller.applyCommands(created.roomId, created.seatTokens[0]?.seatToken ?? '', local.commands) as {
    state: EngineState;
  };

  assert.equal(payload.state.phase, local.state.phase);
  assert.equal(payload.state.round, local.state.round);
  assert.equal(payload.state.globalGaze, local.state.globalGaze);
  assert.equal(payload.state.northernWarMachine, local.state.northernWarMachine);
  assert.deepEqual(payload.state.domains, local.state.domains);
  assert.deepEqual(payload.state.regions, local.state.regions);
});

test('room snapshots redact private hands for other seats', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as {
    roomId: string;
    seatTokens: Array<{ seat: number; seatToken: string }>;
    state: EngineState;
  };

  const seatZero = controller.getRoom(created.roomId, created.seatTokens[0]?.seatToken ?? '') as { state: EngineState; seat: number };
  const seatOne = controller.getRoom(created.roomId, created.seatTokens[1]?.seatToken ?? '') as { state: EngineState; seat: number };

  assert.equal(seatZero.state.players[0]?.resistanceHand.length > 0, true);
  assert.equal(seatZero.state.players[1]?.resistanceHand.length, 0);
  assert.equal(seatOne.state.players[1]?.resistanceHand.length > 0, true);
  assert.equal(seatOne.state.players[0]?.resistanceHand.length, 0);
});

test('room service issues friendly 11-segment room keys', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as { roomId: string };

  assert.match(created.roomId, /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
});
