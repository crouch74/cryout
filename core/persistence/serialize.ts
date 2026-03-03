import { migrateEnvelope } from './migrate.ts';
import { isSerializedGameEnvelope } from './schemas.ts';
import { validateCoreInvariants } from '../validation/invariants.ts';
import type { CoreGameState, DeserializedGame, ScenarioRegistry, SerializedGameEnvelope } from '../types.ts';

export function serializeSave(state: CoreGameState): SerializedGameEnvelope {
  return {
    coreVersion: state.coreVersion,
    scenarioId: state.scenarioId,
    scenarioVersion: state.scenarioVersion,
    state,
    commandLog: state.commandLog,
  };
}

export function stringifySave(state: CoreGameState) {
  return JSON.stringify(serializeSave(state), null, 2);
}

export function deserializeSave(payload: string, scenarioRegistry: ScenarioRegistry): DeserializedGame {
  const parsed = JSON.parse(payload) as unknown;
  if (!isSerializedGameEnvelope(parsed)) {
    throw new Error('Invalid save envelope.');
  }

  const scenario = scenarioRegistry.get(parsed.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario ${parsed.scenarioId}.`);
  }

  const migrated = migrateEnvelope(parsed, undefined, scenario.migrations);
  const invariantErrors = validateCoreInvariants(migrated.state);
  if (invariantErrors.length > 0) {
    throw new Error(`Invalid migrated state: ${invariantErrors.map((entry) => entry.message).join(' ')}`);
  }

  return {
    scenario,
    payload: migrated,
    state: migrated.state,
  };
}
