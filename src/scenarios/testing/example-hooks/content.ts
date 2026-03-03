import type { ScenarioCard } from '../../types.ts';

export const cards: Record<string, ScenarioCard> = {
  data_collective_memory: {
    id: 'data_collective_memory',
    nameKey: 'scenario.example_hooks.cards.data_collective_memory.name',
    textKey: 'scenario.example_hooks.cards.data_collective_memory.text',
    autoResolve: false,
    data: {
      kind: 'data-only',
      effect: 'hope+1',
    },
  },
  scripted_breakthrough: {
    id: 'scripted_breakthrough',
    nameKey: 'scenario.example_hooks.cards.scripted_breakthrough.name',
    textKey: 'scenario.example_hooks.cards.scripted_breakthrough.text',
    resolverId: 'resolve_scripted_breakthrough',
    autoResolve: true,
    data: {
      kind: 'scripted',
      effect: 'hope+2',
    },
  },
};

export const content = {
  dictionary: {
    hope: 'Hope',
    pressure: 'Pressure',
    commons: 'Commons',
    player: 'Movement',
  },
  localeNamespaces: {},
  cards,
  decks: {
    spark: ['data_collective_memory', 'scripted_breakthrough'] as string[],
  },
  trackDefinitions: {
    hope: {
      id: 'hope',
      value: 2,
      min: 0,
      max: 10,
      thresholds: [3, 6, 8],
      metadata: { tone: 'uplift' },
    },
    pressure: {
      id: 'pressure',
      value: 2,
      min: 0,
      max: 10,
      thresholds: [3, 6, 8],
      metadata: { tone: 'danger' },
    },
  },
  zoneDefinitions: {
    commons: {
      id: 'commons',
      counters: {
        assemblies: 0,
      },
      data: {
        strapline: 'Collective strategy grows in public.',
      },
    },
  },
  assets: {},
};
