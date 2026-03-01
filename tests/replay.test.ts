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
} from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  scenarioId: 'witness_dignity',
  mode: 'CORE',
  playerCount: 2,
  roleIds: ['organizer', 'investigative_journalist'],
  seed: 1111,
  expansionIds: [],
};

test('serialized command log replays to the same snapshot', () => {
  const content = compileContent(startCommand.scenarioId);
  let state = initializeGame(startCommand);
  const commands: EngineCommand[] = [
    { type: 'DrawWorldCards' },
    { type: 'AdoptResolution' },
    { type: 'QueueIntent', seat: 0, actionId: 'community_mobilization', target: { kind: 'NONE' } },
    { type: 'QueueIntent', seat: 0, actionId: 'safe_passage', target: { kind: 'REGION', regionId: 'MENA' } },
    { type: 'ReorderQueuedIntent', seat: 0, fromSlot: 1, toSlot: 0 },
    { type: 'SetReady', seat: 0, ready: true },
    { type: 'QueueIntent', seat: 1, actionId: 'field_investigation', target: { kind: 'REGION', regionId: 'MENA' } },
    { type: 'QueueIntent', seat: 1, actionId: 'truth_window', target: { kind: 'REGION', regionId: 'MENA' } },
    { type: 'SetReady', seat: 1, ready: true },
    { type: 'CommitCoalitionIntent' },
    { type: 'ResolveEndPhase' },
  ];

  for (const command of commands) {
    state = dispatchCommand(state, command, content);
  }

  const serialized = serializeGame(state);
  const replayed = replaySerializedGame(serialized);
  const payload = deserializeGame(serialized);

  assert.deepEqual(replayed, payload.snapshot);
});
