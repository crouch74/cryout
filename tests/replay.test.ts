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
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  playerCount: 2,
  factionIds: ['congo_basin_collective', 'levant_sumud'],
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
    { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', bodiesCommitted: 1 } },
    { type: 'QueueIntent', seat: 1, action: { actionId: 'international_outreach' } },
    { type: 'SetReady', seat: 1, ready: true },
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
});
