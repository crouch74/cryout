// Deprecated compatibility surface. Prefer `core/*` and `scenarios/*`.
import { CORE_VERSION } from '../../core/version.ts';
import type {
  CommandBridge,
  CoreCommand,
  CoreDeckState,
  CoreEntityState,
  CoreGameState,
  CorePlayerState,
  CoreTrackState,
  CoreZoneState,
  ScenarioCard,
  ScenarioModule,
  SerializedGameEnvelope,
  StructuredEvent,
} from '../../core/types.ts';
import { createBaseState } from '../../core/validation/state.ts';
import { buildBalancedSeatOwners, dispatchCommand, getDisabledActionReason, initializeGame, normalizeEngineState, replayCommands, serializeForReplay } from '../runtime.ts';
import { compileContent } from '../content.ts';
import type {
  ActionDefinition,
  CompiledContent,
  DomainEvent,
  EngineCommand,
  EngineState,
  StartGameCommand,
} from '../types.ts';

const LEGACY_PHASE_ORDER = ['SYSTEM', 'COALITION', 'RESOLUTION', 'WIN', 'LOSS'];

function toStructuredEvent(event: DomainEvent): StructuredEvent {
  return {
    id: `legacy:${event.seq}`,
    type: `legacy.${event.sourceType}.${event.sourceId}`,
    source: event.sourceId,
    payload: {
      round: event.round,
      phase: event.phase,
      sourceType: event.sourceType,
      message: event.message,
      context: (event.context ?? {}) as unknown as import('../../core/types.ts').JsonValue,
    },
    tags: ['legacy', event.sourceType, event.phase],
    level: event.emoji === '❌' ? 'warning' : 'info',
    messageKey: event.sourceId,
  };
}

function toScenarioCard(card: CompiledContent['cards'][string]): ScenarioCard {
  return {
    id: card.id,
    nameKey: `content.cards.${card.id}.name`,
    textKey: `content.cards.${card.id}.text`,
    resolverId: card.id,
    autoResolve: Array.isArray((card as { effects?: unknown[] }).effects) && ((card as { effects?: unknown[] }).effects?.length ?? 0) > 0,
    data: {
      deck: (card as { deck: string }).deck,
      kind: ('type' in card ? card.type : 'card') as string,
      name: card.name,
      text: card.text,
    },
  };
}

function toCoreDecks(content: CompiledContent, state: EngineState): Record<string, CoreDeckState> {
  return Object.fromEntries(
    Object.entries(state.decks).map(([deckId, deck]) => {
      const deckCards = Object.values(content.cards)
        .filter((card) => card.deck === deckId)
        .map((card) => toScenarioCard(card));
      return [
        deckId,
        {
          id: deckId,
          cards: Object.fromEntries(deckCards.map((card) => [card.id, card])),
          drawPile: [...deck.drawPile],
          discardPile: [...deck.discardPile],
          active: deckId === 'system' ? [...state.activeSystemCardIds] : [],
          metadata: {},
        } satisfies CoreDeckState,
      ];
    }),
  );
}

function toCorePlayers(state: EngineState): Record<string, CorePlayerState> {
  return Object.fromEntries(
    state.players.map((player) => [
      `seat:${player.seat}`,
      {
        id: `seat:${player.seat}`,
        seat: player.seat,
        ownerId: player.ownerId,
        ready: player.ready,
        queuedActions: player.queuedIntents.map((intent) => ({
          id: intent.actionId,
          actorId: `seat:${player.seat}`,
          zoneId: intent.regionId,
          targetIds: intent.targetSeat !== undefined ? [`seat:${intent.targetSeat}`] : [],
          params: {
            domainId: intent.domainId ?? null,
            bodiesCommitted: intent.bodiesCommitted ?? null,
            evidenceCommitted: intent.evidenceCommitted ?? null,
            cardId: intent.cardId ?? null,
          },
        })),
        resources: {
          evidence: player.evidence,
          actionsRemaining: player.actionsRemaining,
        },
        tags: [player.factionId],
        data: {
          factionId: player.factionId,
          mandateId: player.mandateId,
          mandateRevealed: player.mandateRevealed,
          resistanceHand: player.resistanceHand as unknown as import('../../core/types.ts').JsonValue,
        },
      } satisfies CorePlayerState,
    ]),
  );
}

function toCoreTracks(content: CompiledContent, state: EngineState): Record<string, CoreTrackState> {
  const domainTracks = Object.values(content.domains).map((domain) => [
    domain.id,
    {
      id: domain.id,
      value: state.domains[domain.id]?.progress ?? domain.initialProgress,
      min: 0,
      max: 12,
      thresholds: [3, 6, 9],
      metadata: {
        legacyType: 'domain',
        name: domain.name,
      },
    } satisfies CoreTrackState,
  ]);

  return Object.fromEntries([
    [
      'global_gaze',
      {
        id: 'global_gaze',
        value: state.globalGaze,
        min: 0,
        max: 20,
        thresholds: [5, 10, 15],
        metadata: { legacyType: 'track', name: 'Global Gaze' },
      } satisfies CoreTrackState,
    ],
    [
      'war_machine',
      {
        id: 'war_machine',
        value: state.northernWarMachine,
        min: 0,
        max: 12,
        thresholds: [4, 8, 10],
        metadata: { legacyType: 'track', name: 'War Machine' },
      } satisfies CoreTrackState,
    ],
    ...domainTracks,
  ]);
}

function toCoreZones(state: EngineState): Record<string, CoreZoneState> {
  return Object.fromEntries(
    Object.entries(state.regions).map(([regionId, region]) => [
      regionId,
      {
        id: regionId,
        counters: {
          extractionTokens: region.extractionTokens,
          defenseRating: region.defenseRating,
          hijabEnforcement: region.hijabEnforcement,
          ...Object.fromEntries(Object.entries(region.bodiesPresent).map(([seat, value]) => [`bodies:${seat}`, value])),
        },
        resources: {},
        entities: [],
        tags: [],
        data: {
          vulnerability: region.vulnerability as unknown as import('../../core/types.ts').JsonValue,
        },
      } satisfies CoreZoneState,
    ]),
  );
}

function toCoreEntities(state: EngineState): Record<string, CoreEntityState> {
  const beaconEntities = Object.values(state.beacons).map((beacon) => [
    `beacon:${beacon.id}`,
    {
      id: `beacon:${beacon.id}`,
      type: 'beacon',
      zoneId: null,
      ownerId: null,
      counters: {},
      tags: [
        beacon.active ? 'active' : 'inactive',
        beacon.complete ? 'complete' : 'incomplete',
      ],
      data: {
        active: beacon.active,
        complete: beacon.complete,
      },
    } satisfies CoreEntityState,
  ]);

  const systemEntities = state.activeSystemCardIds.map((cardId) => [
    `system-card:${cardId}`,
    {
      id: `system-card:${cardId}`,
      type: 'system-card',
      zoneId: null,
      ownerId: null,
      counters: {},
      tags: ['active'],
      data: { cardId },
    } satisfies CoreEntityState,
  ]);

  return Object.fromEntries([...beaconEntities, ...systemEntities]);
}

export function projectLegacyStateToCore(
  legacyState: EngineState,
  scenario: ScenarioModule,
  content: CompiledContent = compileContent(legacyState.rulesetId),
): CoreGameState {
  const status = legacyState.phase === 'WIN'
    ? 'won'
    : legacyState.phase === 'LOSS'
      ? 'lost'
      : 'running';

  return createBaseState({
    coreVersion: CORE_VERSION,
    scenarioId: scenario.metadata.id,
    scenarioVersion: scenario.metadata.version,
    seed: legacyState.seed,
    rng: legacyState.rng,
    round: legacyState.round,
    turn: legacyState.round,
    phase: {
      id: legacyState.phase.toLowerCase(),
      index: Math.max(0, LEGACY_PHASE_ORDER.indexOf(legacyState.phase)),
    },
    status,
    players: toCorePlayers(legacyState),
    tracks: toCoreTracks(content, legacyState),
    resources: {
      extraction_pool: {
        id: 'extraction_pool',
        amount: legacyState.extractionPool,
        metadata: { legacyType: 'resource' },
      },
    },
    zones: toCoreZones(legacyState),
    entities: toCoreEntities(legacyState),
    decks: toCoreDecks(content, legacyState),
    flags: {
      mode: legacyState.mode,
      winner: legacyState.winner ?? null,
      lossReason: legacyState.lossReason ?? null,
      mandatesResolved: legacyState.mandatesResolved,
      activeBeaconIds: legacyState.activeBeaconIds as unknown as import('../../core/types.ts').JsonValue,
      lastSystemCardIds: legacyState.lastSystemCardIds as unknown as import('../../core/types.ts').JsonValue,
      publicAttentionEvents: legacyState.publicAttentionEvents as unknown as import('../../core/types.ts').JsonValue,
      terminalOutcome: legacyState.terminalOutcome as unknown as import('../../core/types.ts').JsonValue,
    },
    counters: {
      extractionPool: legacyState.extractionPool,
      failedCampaigns: legacyState.failedCampaigns,
      tahrirEmptyRounds: legacyState.tahrirEmptyRounds,
      tahrirMartyrCount: legacyState.tahrirMartyrCount,
    },
    log: legacyState.eventLog.map((event) => ({
      ...toStructuredEvent(event),
      round: event.round,
      phaseId: event.phase,
    })),
    commandLog: legacyState.commandLog as unknown as CoreCommand[],
    scenarioState: {
      legacyRulesetId: legacyState.rulesetId,
      legacyState: legacyState as unknown as import('../../core/types.ts').JsonValue,
    },
  });
}

export function projectCoreStateToLegacy(state: CoreGameState): EngineState | null {
  const legacy = state.scenarioState.legacyState;
  if (!legacy) {
    return null;
  }
  return normalizeEngineState(legacy as unknown as EngineState);
}

function getLegacyRulesetId(scenario: ScenarioModule) {
  return scenario.metadata.legacyRulesetId ?? scenario.metadata.id;
}

function buildLegacyStartCommand(scenario: ScenarioModule, seed: number): StartGameCommand {
  const rulesetId = getLegacyRulesetId(scenario);
  const content = compileContent(rulesetId);
  const seatFactionIds = content.ruleset.factions.map((faction) => faction.id);
  const defaultHumanPlayers = Math.max(2, Math.min(4, seatFactionIds.length)) as 2 | 3 | 4;
  return {
    type: 'StartGame',
    rulesetId,
    mode: 'LIBERATION',
    humanPlayerCount: defaultHumanPlayers,
    seatFactionIds,
    seatOwnerIds: buildBalancedSeatOwners(defaultHumanPlayers, seatFactionIds),
    seed,
  };
}

function asLegacyCommand(command: CoreCommand): EngineCommand | null {
  if (command.payload?.legacyCommand) {
    return command.payload.legacyCommand as unknown as EngineCommand;
  }

  const knownLegacyCommands = new Set([
    'StartGame',
    'QueueIntent',
    'RemoveQueuedIntent',
    'ReorderQueuedIntent',
    'SetReady',
    'ResolveSystemPhase',
    'CommitCoalitionIntent',
    'ResolveResolutionPhase',
    'SaveSnapshot',
    'LoadSnapshot',
  ]);

  if (knownLegacyCommands.has(command.type)) {
    return command as unknown as EngineCommand;
  }

  return null;
}

export function createLegacyCommandBridge(): CommandBridge {
  return {
    createInitialState(scenario, options) {
      const start = buildLegacyStartCommand(scenario, options.seed);
      if (options.mode === 'SYMBOLIC') {
        start.mode = 'SYMBOLIC';
      }

      if (options.players && start.seatFactionIds && options.players.length === start.seatFactionIds.length) {
        const humanCount = Math.max(2, new Set(options.players.map((player) => player.ownerId ?? player.seat)).size) as 2 | 3 | 4;
        start.humanPlayerCount = humanCount;
        start.seatOwnerIds = options.players.map((player) => player.ownerId ?? player.seat);
      }

      if (options.initialScenarioState?.seatFactionIds && Array.isArray(options.initialScenarioState.seatFactionIds)) {
        start.seatFactionIds = options.initialScenarioState.seatFactionIds as unknown as StartGameCommand['seatFactionIds'];
      }

      const legacyState = initializeGame(start);
      return projectLegacyStateToCore(legacyState, scenario);
    },
    dispatch(state, command, scenario) {
      const legacyState = projectCoreStateToLegacy(state);
      const legacyCommand = asLegacyCommand(command);

      if (!legacyState || !legacyCommand) {
        return {
          state,
          emittedEvents: [],
          validationErrors: [
            {
              code: 'legacy.unsupported_command',
              message: `Legacy bridge cannot handle command ${command.type}.`,
            },
          ],
          debugTrace: [`🧱 Legacy bridge rejected ${command.type}.`],
        };
      }

      const rulesetId = getLegacyRulesetId(scenario);
      const content = compileContent(rulesetId);
      const previousEventSeq = legacyState.eventLog.at(-1)?.seq ?? 0;
      const nextLegacy = dispatchCommand(legacyState, legacyCommand, content);
      const nextCore = projectLegacyStateToCore(nextLegacy, scenario, content);
      const emittedEvents = nextLegacy.eventLog
        .filter((event) => event.seq > previousEventSeq)
        .map((event) => toStructuredEvent(event));

      return {
        state: nextCore,
        emittedEvents,
        validationErrors: [],
        debugTrace: [`🧱 Legacy bridge dispatched ${command.type} for ${rulesetId}.`],
      };
    },
  };
}

export function getLegacyActionDefinitions(rulesetId: string): ActionDefinition[] {
  return compileContent(rulesetId).ruleset.actions;
}

export function serializeLegacyReplayEnvelope(state: EngineState): SerializedGameEnvelope {
  const snapshot = serializeForReplay(state);
  return {
    coreVersion: CORE_VERSION,
    scenarioId: state.rulesetId,
    scenarioVersion: CORE_VERSION,
    state: projectLegacyStateToCore(state, {
      metadata: {
        id: state.rulesetId,
        name: state.rulesetId,
        version: CORE_VERSION,
        supportedLocales: ['en'],
        summary: 'Legacy replay envelope.',
        assets: {},
      },
      setup: {
        buildInitialState(_options, helpers) {
          return helpers.createBaseState();
        },
      },
      content: {
        dictionary: {},
        localeNamespaces: {},
        cards: {},
        decks: {},
        trackDefinitions: {},
        zoneDefinitions: {},
        assets: {},
      },
      rules: {
        phases: [],
        predicates: {},
        winEvaluators: [],
        loseEvaluators: [],
        actionValidators: [],
        actionCostCalculators: [],
        modifiers: [],
        difficultyHooks: [],
      },
      behaviors: {
        actionResolvers: {},
        cardResolvers: {},
        deckFactories: {},
        systemTurnScript: () => [],
      },
      ui: {
        getLabel(id, fallback) {
          return fallback ?? id;
        },
      },
      migrations: {
        migrateScenarioState: {},
      },
      hooks: {
        onScenarioLoad: () => undefined,
        onGameSetup: () => undefined,
        onRoundStart: () => undefined,
        onPhaseStart: () => undefined,
        onBeforeAction: () => undefined,
        onAfterAction: () => undefined,
        onEffectResolve: () => undefined,
        onCardDraw: () => undefined,
        onCardResolve: () => undefined,
        onRoundEnd: () => undefined,
        onGameEnd: () => undefined,
      },
    }),
    commandLog: snapshot.commands as unknown as CoreCommand[],
  };
}

export {
  buildBalancedSeatOwners,
  dispatchCommand,
  getDisabledActionReason,
  initializeGame,
  normalizeEngineState,
  replayCommands,
  serializeForReplay,
};
