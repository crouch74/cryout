import { content } from './content.ts';

export const setup = {
  buildInitialState(options: import('../../types.ts').CreateGameOptions, helpers: import('../../types.ts').ScenarioSetupHelpers) {
    return helpers.createBaseState({
      scenarioId: 'example_hooks',
      scenarioVersion: '1.0.0',
      seed: options.seed,
      phase: { id: 'briefing', index: 0 },
      status: 'running',
      players: {
        'seat:0': helpers.createPlayer({
          id: 'seat:0',
          seat: 0,
          ownerId: 0,
          resources: { support: 3, testimony: 1 },
          tags: ['movement_alpha'],
        }),
        'seat:1': helpers.createPlayer({
          id: 'seat:1',
          seat: 1,
          ownerId: 1,
          resources: { support: 3, testimony: 1 },
          tags: ['movement_beta'],
        }),
      },
      tracks: {
        hope: {
          id: 'hope',
          value: content.trackDefinitions.hope.value ?? 2,
          min: 0,
          max: 10,
          thresholds: [3, 6, 8],
          metadata: {},
        },
        pressure: {
          id: 'pressure',
          value: content.trackDefinitions.pressure.value ?? 2,
          min: 0,
          max: 10,
          thresholds: [3, 6, 8],
          metadata: {},
        },
      },
      zones: {
        commons: {
          id: 'commons',
          counters: { assemblies: 0 },
          resources: {},
          entities: [],
          tags: ['public'],
          data: {
            strapline: 'Collective strategy grows in public.',
          },
        },
      },
      counters: {
        roundsResolved: 0,
        systemSteps: 0,
      },
      flags: {
        injectedPhase: 'story_pulse',
      },
      scenarioState: {
        hookLog: [] as unknown as import('../../../engine/types.ts').JsonValue,
      },
      decks: {
        spark: helpers.createDeck('spark', Object.values(content.cards)),
      },
    });
  },
};
