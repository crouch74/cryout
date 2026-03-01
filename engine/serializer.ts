import { normalizeEngineState, replayCommands } from './runtime.ts';
import type { EngineState, SerializedGame } from './types.ts';

const SERIALIZER_VERSION = 'design-cutover-1';

export function serializeGame(state: EngineState): string {
  const payload: SerializedGame = {
    contentVersion: SERIALIZER_VERSION,
    rulesetId: state.rulesetId,
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
  if (payload.contentVersion !== SERIALIZER_VERSION) {
    throw new Error(`Unsupported save version: ${payload.contentVersion}`);
  }
  payload.snapshot = normalizeEngineState(payload.snapshot);
  return payload;
}

export function replaySerializedGame(serialized: string): EngineState {
  const payload = deserializeGame(serialized);
  return replayCommands(payload.commandLog);
}
