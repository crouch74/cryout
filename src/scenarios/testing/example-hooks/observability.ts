export const observability = {
  formatLogEntry(entry: import('../../types.ts').StructuredLogEntry) {
    return `[example_hooks] ${entry.type}`;
  },
  inspect(state: import('../../types.ts').CoreGameState) {
    return {
      hope: state.tracks.hope?.value ?? 0,
      pressure: state.tracks.pressure?.value ?? 0,
      systemSteps: state.counters.systemSteps ?? 0,
    };
  },
};
