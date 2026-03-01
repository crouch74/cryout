import { normalizeEngineState, replayCommands } from './runtime.ts';
import type { EngineState, SerializedGame } from './types.ts';

export function serializeGame(state: EngineState): string {
  const payload: SerializedGame = {
    contentVersion: '1.0.0',
    scenarioId: state.scenarioId,
    mode: state.mode,
    seed: state.seed,
    rngState: state.rng,
    snapshot: state,
    commandLog: state.commandLog,
  };

  return JSON.stringify(payload, null, 2);
}

export function deserializeGame(serialized: string): SerializedGame {
  const payload = JSON.parse(serialized) as SerializedGame;
  payload.snapshot = normalizeEngineState(payload.snapshot);
  return payload;
}

export function replaySerializedGame(serialized: string): EngineState {
  const payload = deserializeGame(serialized);
  return replayCommands(payload.commandLog);
}
