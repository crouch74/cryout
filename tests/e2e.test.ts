import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomController } from '../room-service/server.ts';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand, type EngineState } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  scenarioId: 'witness_dignity',
  mode: 'CORE',
  playerCount: 2,
  roleIds: ['organizer', 'investigative_journalist'],
  seed: 7070,
  expansionIds: [],
};

function runLocalSequence() {
  const content = compileContent(startCommand.scenarioId);
  let state = initializeGame(startCommand);
  const commands: EngineCommand[] = [
    { type: 'DrawWorldCards' },
    { type: 'AdoptResolution' },
    { type: 'QueueIntent', seat: 0, actionId: 'community_mobilization', target: { kind: 'NONE' } },
    { type: 'QueueIntent', seat: 0, actionId: 'safe_passage', target: { kind: 'REGION', regionId: 'Palestine' } },
    { type: 'ReorderQueuedIntent', seat: 0, fromSlot: 1, toSlot: 0 },
    { type: 'SetReady', seat: 0, ready: true },
    { type: 'QueueIntent', seat: 1, actionId: 'field_investigation', target: { kind: 'REGION', regionId: 'Palestine' } },
    { type: 'QueueIntent', seat: 1, actionId: 'counter_disinfo', target: { kind: 'REGION', regionId: 'Palestine' } },
    { type: 'SetReady', seat: 1, ready: true },
    { type: 'CommitCoalitionIntent' },
    { type: 'ResolveEndPhase' },
  ];

  for (const command of commands) {
    state = dispatchCommand(state, command, content);
  }

  return { commands, state };
}

test('room service stays in sync with the local table reducer', async () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as { roomId: string; state: EngineState };
  const local = runLocalSequence();
  const payload = controller.applyCommands(created.roomId, local.commands) as { state: EngineState };

  assert.equal(payload.state.phase, local.state.phase);
  assert.equal(payload.state.round, local.state.round);
  assert.deepEqual(payload.state.resources, local.state.resources);
  assert.deepEqual(payload.state.fronts, local.state.fronts);
  assert.deepEqual(payload.state.regions, local.state.regions);
});

test('room service issues friendly 9-letter room keys', () => {
  const controller = createRoomController();
  const created = controller.createRoom(startCommand) as { roomId: string; state: EngineState };

  assert.match(created.roomId, /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
});
