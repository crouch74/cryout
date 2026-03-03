export const migrations = {
  migrateScenarioState: {
    '1.0.1': (value: import('../../../engine/types.ts').JsonValue) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }

      return {
        ...value,
        migrationApplied: true,
      };
    },
  },
};
