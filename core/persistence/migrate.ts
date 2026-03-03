import type { CoreMigrationRegistry, ScenarioMigrationRegistry, SerializedGameEnvelope } from '../types.ts';

export const defaultCoreMigrations: CoreMigrationRegistry = {
  migrateCoreState: {},
};

function applyOrderedMigrations<T>(value: T, migrations: Record<string, (input: import('../types.ts').JsonValue) => import('../types.ts').JsonValue>): T {
  let next = value as unknown as import('../types.ts').JsonValue;
  for (const version of Object.keys(migrations).sort()) {
    next = migrations[version](next);
  }
  return next as unknown as T;
}

export function migrateEnvelope(
  payload: SerializedGameEnvelope,
  coreMigrations: CoreMigrationRegistry = defaultCoreMigrations,
  scenarioMigrations?: ScenarioMigrationRegistry,
) {
  const next = structuredClone(payload);
  next.state = applyOrderedMigrations(next.state, coreMigrations.migrateCoreState);
  if (scenarioMigrations) {
    next.state.scenarioState = applyOrderedMigrations(next.state.scenarioState, scenarioMigrations.migrateScenarioState);
  }
  return next;
}
