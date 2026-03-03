import type { RulesetDefinition } from '../../engine/types.ts';
import type {
  CoreTrackState,
  CreateGameOptions,
  ScenarioBehaviors,
  ScenarioContent,
  ScenarioObservability,
  ScenarioRules,
  ScenarioSetup,
  ScenarioUiAdapter,
} from '../types.ts';

function buildTrackDefinitions(ruleset: RulesetDefinition): ScenarioContent['trackDefinitions'] {
  return Object.fromEntries([
    [
      'global_gaze',
      {
        id: 'global_gaze',
        value: 5,
        min: 0,
        max: 20,
        thresholds: [5, 10, 15],
        metadata: { legacy: 'globalGaze' },
      } satisfies Partial<CoreTrackState>,
    ],
    [
      'war_machine',
      {
        id: 'war_machine',
        value: 7,
        min: 0,
        max: 12,
        thresholds: [4, 8, 10],
        metadata: { legacy: 'northernWarMachine' },
      } satisfies Partial<CoreTrackState>,
    ],
    ...ruleset.domains.map((domain) => [
      domain.id,
      {
        id: domain.id,
        value: domain.initialProgress,
        min: 0,
        max: 12,
        thresholds: [3, 6, 9],
        metadata: { description: domain.description },
      } satisfies Partial<CoreTrackState>,
    ]),
  ]);
}

export function buildLegacyScenarioContent(ruleset: RulesetDefinition): ScenarioContent {
  const allCards = [...ruleset.resistanceCards, ...ruleset.crisisCards, ...ruleset.systemCards];

  return {
    dictionary: Object.fromEntries([
      [ruleset.id, ruleset.name],
      ...ruleset.actions.map((action) => [action.id, action.name]),
      ...ruleset.domains.map((domain) => [domain.id, domain.name]),
      ...ruleset.regions.map((region) => [region.id, region.name]),
      ...ruleset.factions.map((faction) => [faction.id, faction.name]),
      ...ruleset.beacons.map((beacon) => [beacon.id, beacon.title]),
      ...allCards.map((card) => [card.id, card.name]),
    ]),
    localeNamespaces: {},
    cards: Object.fromEntries(allCards.map((card) => [
      card.id,
      {
        id: card.id,
        nameKey: `content.cards.${card.id}.name`,
        textKey: `content.cards.${card.id}.text`,
        resolverId: card.id,
        autoResolve: Array.isArray((card as { effects?: unknown[] }).effects) && ((card as { effects?: unknown[] }).effects?.length ?? 0) > 0,
        data: {
          deck: card.deck,
          name: card.name,
          text: card.text,
        },
      },
    ])),
    decks: {
      system: ruleset.systemCards.map((card) => card.id),
      resistance: ruleset.resistanceCards.map((card) => card.id),
      crisis: ruleset.crisisCards.map((card) => card.id),
    },
    trackDefinitions: buildTrackDefinitions(ruleset),
    zoneDefinitions: Object.fromEntries(ruleset.regions.map((region) => [
      region.id,
      {
        id: region.id,
        counters: {
          extractionTokens: 0,
          defenseRating: 0,
        },
        data: {
          strapline: region.strapline,
          vulnerability: region.vulnerability as unknown as import('../../core/types.ts').JsonValue,
        },
      },
    ])),
    assets: {
      board: ruleset.board.assetPath,
    },
    legacy: {
      rulesetId: ruleset.id,
      liberationThreshold: ruleset.liberationThreshold,
      suddenDeathRound: ruleset.suddenDeathRound,
    },
  };
}

export function buildLegacyScenarioSetup(ruleset: RulesetDefinition): ScenarioSetup {
  return {
    buildInitialState(options: CreateGameOptions, helpers) {
      const players = Object.fromEntries(
        ruleset.factions.map((faction, seat) => [
          `seat:${seat}`,
          helpers.createPlayer({
            id: `seat:${seat}`,
            seat,
            ownerId: seat,
            resources: {
              evidence: 1,
              actionsRemaining: 2,
            },
            tags: [faction.id],
            data: {
              factionId: faction.id,
              homeRegion: faction.homeRegion,
            },
          }),
        ]),
      );

      return helpers.createBaseState({
        scenarioId: ruleset.id,
        scenarioVersion: 'legacy-placeholder',
        seed: options.seed,
        players,
        tracks: Object.fromEntries(
          Object.entries(buildTrackDefinitions(ruleset)).map(([trackId, definition]) => [
            trackId,
            {
              id: trackId,
              value: definition.value ?? 0,
              min: definition.min,
              max: definition.max,
              thresholds: definition.thresholds ?? [],
              metadata: definition.metadata ?? {},
            },
          ]),
        ),
        zones: Object.fromEntries(ruleset.regions.map((region) => [
          region.id,
          {
            id: region.id,
            counters: {
              extractionTokens: 0,
              defenseRating: 0,
            },
            resources: {},
            entities: [],
            tags: [],
            data: {
              name: region.name,
              strapline: region.strapline,
            },
          },
        ])),
        phase: { id: 'system', index: 0 },
        status: 'running',
      });
    },
  };
}

export function buildLegacyScenarioRules(): Partial<ScenarioRules> {
  return {
    phases: [
      { id: 'system', labelKey: 'scenario.phase.system', order: 0 },
      { id: 'coalition', labelKey: 'scenario.phase.coalition', order: 1 },
      { id: 'resolution', labelKey: 'scenario.phase.resolution', order: 2 },
      { id: 'win', labelKey: 'scenario.phase.win', order: 3 },
      { id: 'loss', labelKey: 'scenario.phase.loss', order: 4 },
    ],
  };
}

export function buildLegacyScenarioBehaviors(): ScenarioBehaviors {
  return {
    actionResolvers: {},
    cardResolvers: {},
    deckFactories: {},
    systemTurnScript: () => [],
  };
}

export function buildLegacyScenarioUi(ruleset: RulesetDefinition): ScenarioUiAdapter {
  const dictionary = Object.fromEntries([
    [ruleset.id, ruleset.name],
    ...ruleset.domains.map((domain) => [domain.id, domain.name]),
    ...ruleset.regions.map((region) => [region.id, region.name]),
    ...ruleset.actions.map((action) => [action.id, action.name]),
    ...ruleset.factions.map((faction) => [faction.id, faction.name]),
  ]);

  return {
    getLabel(id, fallback) {
      return dictionary[id] ?? fallback ?? id;
    },
    getBoardDefinition() {
      return ruleset.board;
    },
    getTrackOrder() {
      return ['global_gaze', 'war_machine', ...ruleset.domains.map((domain) => domain.id)];
    },
    getZoneOrder() {
      return ruleset.regions.map((region) => region.id);
    },
    formatEvent(event) {
      return typeof event.payload.message === 'string' ? event.payload.message : event.type;
    },
  };
}

export function buildLegacyScenarioObservability(ruleset: RulesetDefinition): ScenarioObservability {
  return {
    formatLogEntry(entry) {
      return `[${ruleset.id}] ${entry.type}`;
    },
    inspect(state) {
      return {
        round: state.round,
        phase: state.phase.id,
        scenarioId: state.scenarioId,
      };
    },
  };
}
