import { compileContent } from './content.ts';
import { createRng, nextInt, shuffle } from './rng.ts';
import type {
  ActionDefinition,
  ActionId,
  CompiledContent,
  Condition,
  DisabledActionReason,
  DomainEvent,
  DomainId,
  Effect,
  EffectTrace,
  EngineCommand,
  EngineState,
  FactionDefinition,
  PlayerState,
  QueuedIntent,
  RegionId,
  RegionSelector,
  ResistanceCardDefinition,
  SeatSelector,
  StartGameCommand,
  StateDelta,
} from './types.ts';

const REGION_IDS: RegionId[] = ['Congo', 'Levant', 'Amazon', 'Sahel', 'Mekong', 'Andes'];
const ACTIONS_PER_TURN = 2;
const EXTRACTION_DEFEAT_THRESHOLD = 6;
const MAX_EXTRACTION_POOL = 36;

interface ResolveContext {
  actingSeat?: number;
  targetRegionId?: RegionId;
  targetDomainId?: DomainId;
  causedBy: string[];
}

interface ApplyEffectSource {
  sourceType: DomainEvent['sourceType'];
  sourceId: string;
  emoji: string;
  message: string;
  causedBy: string[];
  context: ResolveContext;
}

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function clamp(value: number, clampConfig: { min?: number; max?: number }): number {
  let next = value;
  if (clampConfig.min !== undefined) {
    next = Math.max(clampConfig.min, next);
  }
  if (clampConfig.max !== undefined) {
    next = Math.min(clampConfig.max, next);
  }
  return next;
}

function assertExists<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}

function nextEventSeq(state: EngineState) {
  return state.eventLog.length + 1;
}

function createDelta(
  kind: StateDelta['kind'],
  label: string,
  before: StateDelta['before'],
  after: StateDelta['after'],
): StateDelta {
  return { kind, label, before, after };
}

function addEvent(
  state: EngineState,
  sourceType: DomainEvent['sourceType'],
  sourceId: string,
  emoji: string,
  message: string,
  causedBy: string[],
  trace: EffectTrace[] = [],
): void {
  state.eventLog.push({
    seq: nextEventSeq(state),
    round: state.round,
    phase: state.phase,
    sourceType,
    sourceId,
    emoji,
    message,
    causedBy,
    deltas: trace.flatMap((entry) => entry.deltas),
    trace,
  });
}

function addSimpleEvent(
  state: EngineState,
  sourceType: DomainEvent['sourceType'],
  sourceId: string,
  emoji: string,
  message: string,
  causedBy: string[],
): void {
  addEvent(state, sourceType, sourceId, emoji, message, causedBy, []);
}

function addRejectedCommandEvent(state: EngineState, command: EngineCommand, reason: string): void {
  addSimpleEvent(state, 'command', command.type, '❌', reason, [command.type]);
}

function getSeatTotalBodies(state: EngineState, seat: number) {
  return Object.values(state.regions).reduce((sum, region) => sum + (region.bodiesPresent[seat] ?? 0), 0);
}

function calculateExtractionPool(state: EngineState) {
  const inPlay = Object.values(state.regions).reduce((sum, region) => sum + region.extractionTokens, 0);
  return Math.max(0, MAX_EXTRACTION_POOL - inPlay);
}

function revealMandates(state: EngineState) {
  for (const player of state.players) {
    player.mandateRevealed = true;
  }
  state.mandatesResolved = true;
}

function compareValues(left: number, right: number, op: '>' | '>=' | '<' | '<=' | '==' | '!=') {
  switch (op) {
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
  }
}

function resolveSeatSelector(selector: SeatSelector | 'seat_owner', context: ResolveContext): number {
  if (selector === 'acting_player' || selector === 'seat_owner') {
    return context.actingSeat ?? 0;
  }
  return selector;
}

function evaluateCondition(
  state: EngineState,
  content: CompiledContent,
  condition: Condition,
  context: ResolveContext,
): boolean {
  switch (condition.kind) {
    case 'compare': {
      let left = 0;
      switch (condition.left.type) {
        case 'global_gaze':
          left = state.globalGaze;
          break;
        case 'northern_war_machine':
          left = state.northernWarMachine;
          break;
        case 'round':
          left = state.round;
          break;
        case 'domain_progress':
          left = state.domains[assertExists(condition.left.domain, 'Missing domain on compare ref.')].progress;
          break;
        case 'region_extraction':
          left = state.regions[assertExists(condition.left.region, 'Missing region on compare ref.')].extractionTokens;
          break;
        case 'player_evidence':
          left = state.players[resolveSeatSelector(condition.left.player ?? 'seat_owner', context)]?.evidence ?? 0;
          break;
        case 'player_total_bodies':
          left = getSeatTotalBodies(state, resolveSeatSelector(condition.left.player ?? 'seat_owner', context));
          break;
      }
      return compareValues(left, condition.right, condition.op);
    }
    case 'all':
      return condition.conditions.every((entry) => evaluateCondition(state, content, entry, context));
    case 'any':
      return condition.conditions.some((entry) => evaluateCondition(state, content, entry, context));
    case 'not':
      return !evaluateCondition(state, content, condition.condition, context);
    case 'every_region_extraction_at_most':
      return REGION_IDS.every((regionId) => state.regions[regionId].extractionTokens <= condition.count);
    case 'all_active_beacons_complete':
      return state.activeBeaconIds.every((beaconId) => state.beacons[beaconId]?.complete);
  }
}

function resolveRegionSelector(
  state: EngineState,
  _content: CompiledContent,
  selector: RegionSelector,
  context: ResolveContext,
): RegionId[] {
  if (selector === 'target_region') {
    return context.targetRegionId ? [context.targetRegionId] : [];
  }

  if (typeof selector === 'string') {
    return [selector];
  }

  const candidates = REGION_IDS
    .map((regionId) => ({
      regionId,
      vulnerability: state.regions[regionId].vulnerability[selector.byVulnerability] ?? 0,
      extraction: state.regions[regionId].extractionTokens,
    }))
    .filter((entry) => entry.vulnerability > 0);

  if (candidates.length === 0) {
    return [];
  }

  const highest = Math.max(...candidates.map((entry) => entry.vulnerability));
  const tied = candidates.filter((entry) => entry.vulnerability === highest);
  if (tied.length === 1) {
    return [tied[0].regionId];
  }

  const [nextRng, index] = nextInt(state.rng, tied.length);
  state.rng = nextRng;
  return [tied[index].regionId];
}

function drawCard(state: EngineState, deckId: 'system' | 'resistance' | 'beacon'): string | null {
  const deck = state.decks[deckId];
  if (deck.drawPile.length === 0 && deck.discardPile.length > 0) {
    const [nextRng, shuffled] = shuffle(state.rng, deck.discardPile);
    state.rng = nextRng;
    deck.drawPile = shuffled;
    deck.discardPile = [];
  }
  return deck.drawPile.shift() ?? null;
}

function moveCardToDiscard(state: EngineState, deckId: 'system' | 'resistance', cardId: string) {
  state.decks[deckId].discardPile.push(cardId);
}

function removeCardFromHand(state: EngineState, seat: number, cardId: string) {
  const player = state.players[seat];
  player.resistanceHand = player.resistanceHand.filter((id) => id !== cardId);
}

function getFaction(content: CompiledContent, player: PlayerState): FactionDefinition {
  return content.factions[player.factionId];
}

function updateBeaconCompletion(state: EngineState, content: CompiledContent) {
  for (const beaconId of state.activeBeaconIds) {
    const beacon = content.beacons[beaconId];
    state.beacons[beaconId].complete = evaluateCondition(state, content, beacon.condition, { causedBy: [beaconId] });
  }
}

function checkExtractionLoss(state: EngineState) {
  const breachedRegion = REGION_IDS.find((regionId) => state.regions[regionId].extractionTokens >= EXTRACTION_DEFEAT_THRESHOLD);
  if (!breachedRegion) {
    return false;
  }

  state.phase = 'LOSS';
  state.lossReason = `${breachedRegion} reached ${EXTRACTION_DEFEAT_THRESHOLD} Extraction Tokens.`;
  revealMandates(state);
  addSimpleEvent(state, 'system', 'extraction_breach', '☠️', state.lossReason, ['extraction_breach']);
  return true;
}

function checkPositiveVictory(state: EngineState, content: CompiledContent): boolean {
  const liberationComplete = state.mode === 'LIBERATION'
    && REGION_IDS.every((regionId) => state.regions[regionId].extractionTokens <= content.ruleset.liberationThreshold);
  const symbolicComplete = state.mode === 'SYMBOLIC'
    && state.activeBeaconIds.every((beaconId) => state.beacons[beaconId]?.complete);

  if (!liberationComplete && !symbolicComplete) {
    return false;
  }

  const failedMandates = state.players.filter((player) => {
    const faction = getFaction(content, player);
    return !evaluateCondition(state, content, faction.mandate.condition, { actingSeat: player.seat, causedBy: [faction.mandate.id] });
  });

  revealMandates(state);
  if (failedMandates.length > 0) {
    state.phase = 'LOSS';
    state.lossReason = `Public victory was reached, but ${failedMandates.length} solemn charge(s) failed.`;
    addSimpleEvent(state, 'mandate', 'mandate_failure', '🕳️', state.lossReason, ['mandate_failure']);
    return true;
  }

  state.phase = 'WIN';
  state.winner = liberationComplete ? 'Liberation achieved.' : 'Symbolic beacons aligned.';
  addSimpleEvent(state, 'beacon', 'victory', '✨', state.winner, ['victory']);
  return true;
}

function resolveCardDraws(state: EngineState, seat: number, count: number): EffectTrace {
  const player = state.players[seat];
  const before = player.resistanceHand.length;
  for (let index = 0; index < count; index += 1) {
    const cardId = drawCard(state, 'resistance');
    if (cardId) {
      player.resistanceHand.push(cardId);
    }
  }
  return {
    effectType: 'draw_resistance',
    status: 'executed',
    message: `Seat ${seat + 1} drew ${player.resistanceHand.length - before} resistance card(s).`,
    causedBy: [`seat:${seat}`],
    deltas: [createDelta('card', `seat:${seat}:hand`, before, player.resistanceHand.length)],
  };
}

function applyEffects(state: EngineState, content: CompiledContent, effects: Effect[], source: ApplyEffectSource): EffectTrace[] {
  const traces: EffectTrace[] = [];

  for (const effect of effects) {
    const trace: EffectTrace = {
      effectType: effect.type,
      status: 'executed',
      message: source.message,
      causedBy: source.causedBy,
      deltas: [],
    };

    switch (effect.type) {
      case 'modify_gaze': {
        const before = state.globalGaze;
        state.globalGaze = clamp(state.globalGaze + effect.delta, effect.clamp ?? { min: 0, max: 20 });
        trace.message = `Global Gaze ${before} -> ${state.globalGaze}.`;
        trace.deltas.push(createDelta('track', 'globalGaze', before, state.globalGaze));
        break;
      }
      case 'modify_war_machine': {
        const before = state.northernWarMachine;
        state.northernWarMachine = clamp(
          state.northernWarMachine + effect.delta,
          effect.clamp ?? { min: 0, max: 12 },
        );
        trace.message = `Northern War Machine ${before} -> ${state.northernWarMachine}.`;
        trace.deltas.push(createDelta('track', 'northernWarMachine', before, state.northernWarMachine));
        break;
      }
      case 'modify_domain': {
        const domainId = effect.domain === 'target_domain' ? source.context.targetDomainId : effect.domain;
        if (!domainId) {
          trace.status = 'skipped';
          trace.message = 'No domain selected.';
          break;
        }
        const before = state.domains[domainId].progress;
        state.domains[domainId].progress = clamp(state.domains[domainId].progress + effect.delta, effect.clamp ?? { min: 0, max: 12 });
        trace.message = `${domainId} ${before} -> ${state.domains[domainId].progress}.`;
        trace.deltas.push(createDelta('domain', domainId, before, state.domains[domainId].progress));
        break;
      }
      case 'add_extraction':
      case 'remove_extraction': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        if (regionIds.length === 0) {
          trace.status = 'skipped';
          trace.message = 'No region selected.';
          break;
        }
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const beforeExtraction = region.extractionTokens;
          const beforeDefense = region.defenseRating;
          let pending = effect.amount;

          if (effect.type === 'add_extraction') {
            while (pending > 0 && region.defenseRating > 0) {
              region.defenseRating -= 1;
              pending -= 1;
            }
            if (beforeDefense !== region.defenseRating) {
              trace.deltas.push(createDelta('defense', `${regionId}.defense`, beforeDefense, region.defenseRating));
            }
            if (pending > 0) {
              region.extractionTokens = clamp(region.extractionTokens + pending, { min: 0, max: EXTRACTION_DEFEAT_THRESHOLD });
            }
          } else {
            region.extractionTokens = clamp(region.extractionTokens - pending, { min: 0, max: EXTRACTION_DEFEAT_THRESHOLD });
          }

          if (beforeExtraction !== region.extractionTokens) {
            trace.deltas.push(
              createDelta('extraction', `${regionId}.extraction`, beforeExtraction, region.extractionTokens),
            );
          }
        }
        state.extractionPool = calculateExtractionPool(state);
        break;
      }
      case 'add_bodies':
      case 'remove_bodies': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        const seat = resolveSeatSelector(effect.seat, source.context);
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const before = region.bodiesPresent[seat] ?? 0;
          region.bodiesPresent[seat] = effect.type === 'add_bodies'
            ? before + effect.amount
            : Math.max(0, before - effect.amount);
          trace.deltas.push(createDelta('bodies', `${regionId}.seat:${seat}`, before, region.bodiesPresent[seat]));
        }
        break;
      }
      case 'gain_evidence':
      case 'lose_evidence': {
        const seat = resolveSeatSelector(effect.seat, source.context);
        const player = state.players[seat];
        const before = player.evidence;
        player.evidence = effect.type === 'gain_evidence'
          ? player.evidence + effect.amount
          : Math.max(0, player.evidence - effect.amount);
        trace.deltas.push(createDelta('evidence', `seat:${seat}:evidence`, before, player.evidence));
        break;
      }
      case 'set_defense': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const before = region.defenseRating;
          region.defenseRating = Math.max(region.defenseRating, effect.amount);
          trace.deltas.push(createDelta('defense', `${regionId}.defense`, before, region.defenseRating));
        }
        break;
      }
      case 'draw_resistance': {
        traces.push(resolveCardDraws(state, resolveSeatSelector(effect.seat, source.context), effect.count));
        trace.status = 'skipped';
        trace.message = 'Draw handled by helper trace.';
        break;
      }
      case 'log':
        trace.message = effect.message;
        break;
    }

    traces.push(trace);
  }

  return traces;
}

function getCampaignSupportBonus(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  intent: QueuedIntent,
): { bonus: number; card: ResistanceCardDefinition | null } {
  if (!intent.cardId) {
    return { bonus: 0, card: null };
  }

  const card = content.cards[intent.cardId];
  const player = state.players[seat];
  if (!card || card.deck !== 'resistance' || card.type !== 'support' || !player.resistanceHand.includes(intent.cardId)) {
    return { bonus: 0, card: null };
  }

  let bonus = card.campaignBonus ?? 0;
  if (card.domainBonus && card.domainBonus !== intent.domainId) {
    bonus = 0;
  }
  if (card.regionBonus && card.regionBonus !== 'ANY' && card.regionBonus !== intent.regionId) {
    bonus = 0;
  }
  return { bonus, card };
}

function addSystemAttentionEvent(state: EngineState, message: string) {
  state.publicAttentionEvents.push(message);
  addSimpleEvent(state, 'system', 'public_attention', '👁️', message, ['public_attention']);
}

function resolveMilitaryIntervention(state: EngineState, content: CompiledContent) {
  if (state.northernWarMachine < 8) {
    return;
  }

  const [targetRegionId] = resolveRegionSelector(state, content, { byVulnerability: 'WarMachine' }, { causedBy: ['intervention'] });
  if (!targetRegionId) {
    return;
  }

  const region = state.regions[targetRegionId];
  if (region.defenseRating > 0) {
    const before = region.defenseRating;
    region.defenseRating -= 1;
    addEvent(state, 'system', 'military_intervention', '🛡️', `Defense absorbed intervention in ${targetRegionId}.`, ['intervention'], [
      {
        effectType: 'system_phase',
        status: 'executed',
        message: `Defense ${before} -> ${region.defenseRating}.`,
        causedBy: ['intervention'],
        deltas: [createDelta('defense', `${targetRegionId}.defense`, before, region.defenseRating)],
      },
    ]);
    return;
  }

  const seatPresence = state.players
    .map((player) => ({ seat: player.seat, bodies: region.bodiesPresent[player.seat] ?? 0 }))
    .sort((left, right) => right.bodies - left.bodies);
  const targetSeat = seatPresence[0]?.bodies ? seatPresence[0].seat : null;

  if (targetSeat !== null) {
    const before = region.bodiesPresent[targetSeat];
    region.bodiesPresent[targetSeat] = Math.max(0, before - 2);
    addEvent(state, 'system', 'military_intervention', '⚔️', `Military intervention hit ${targetRegionId}.`, ['intervention'], [
      {
        effectType: 'system_phase',
        status: 'executed',
        message: `Comrades ${before} -> ${region.bodiesPresent[targetSeat]}.`,
        causedBy: ['intervention'],
        deltas: [createDelta('bodies', `${targetRegionId}.seat:${targetSeat}`, before, region.bodiesPresent[targetSeat])],
      },
    ]);
    return;
  }

  const traces = applyEffects(
    state,
    content,
    [{ type: 'add_extraction', region: targetRegionId, amount: 1 }],
    {
      sourceType: 'system',
      sourceId: 'military_intervention',
      emoji: '⚔️',
      message: `Military intervention entrenched extraction in ${targetRegionId}.`,
      causedBy: ['intervention'],
      context: { causedBy: ['intervention'] },
    },
  );
  addEvent(state, 'system', 'military_intervention', '⚔️', `Military intervention entrenched extraction in ${targetRegionId}.`, ['intervention'], traces);
}

function resolveSystemCard(state: EngineState, content: CompiledContent, cardId: string) {
  const card = assertExists(content.cards[cardId], `Missing card ${cardId}.`);
  if (card.deck !== 'system') {
    throw new Error(`Card ${cardId} is not a system card.`);
  }
  const traces = applyEffects(
    state,
    content,
    card.effects,
    {
      sourceType: 'card',
      sourceId: card.id,
      emoji: '🂠',
      message: card.name,
      causedBy: [card.id],
      context: { causedBy: [card.id] },
    },
  );
  moveCardToDiscard(state, 'system', cardId);
  addEvent(state, 'card', card.id, '🂠', `${card.name}: ${card.text}`, [card.id], traces);
}

function createInitialPlayers(command: StartGameCommand, content: CompiledContent): PlayerState[] {
  return command.factionIds.slice(0, command.playerCount).map((factionId, seat) => ({
    seat,
    factionId,
    evidence: 1,
    actionsRemaining: ACTIONS_PER_TURN,
    ready: false,
    queuedIntents: [],
    resistanceHand: [],
    mandateId: content.factions[factionId].mandate.id,
    mandateRevealed: false,
  }));
}

function createInitialState(command: StartGameCommand, content: CompiledContent): EngineState {
  let rng = createRng(command.seed);
  const players = createInitialPlayers(command, content);

  const decks = {
    system: { drawPile: [] as string[], discardPile: [] as string[] },
    resistance: { drawPile: [] as string[], discardPile: [] as string[] },
    beacon: { drawPile: [] as string[], discardPile: [] as string[] },
  };

  for (const deckId of ['system', 'resistance', 'beacon'] as const) {
    const [nextRng, shuffled] = shuffle(rng, content.decks[deckId]);
    rng = nextRng;
    decks[deckId].drawPile = shuffled;
  }

  const regions = Object.fromEntries(
    REGION_IDS.map((regionId) => [
      regionId,
      {
        id: regionId,
        extractionTokens: regionId === 'Levant' || regionId === 'Congo' ? 2 : 1,
        vulnerability: { ...content.regions[regionId].vulnerability },
        defenseRating: 0,
        bodiesPresent: Object.fromEntries(players.map((player) => [player.seat, 0])),
      },
    ]),
  ) as EngineState['regions'];

  for (const player of players) {
    const faction = content.factions[player.factionId];
    regions[faction.homeRegion].bodiesPresent[player.seat] = 4;
  }

  const beacons = Object.fromEntries(
    content.decks.beacon.map((beaconId) => [
      beaconId,
      {
        id: beaconId,
        active: false,
        complete: false,
      },
    ]),
  ) as EngineState['beacons'];

  const activeBeaconIds: string[] = [];
  if (command.mode === 'SYMBOLIC') {
    for (let index = 0; index < 3; index += 1) {
      const beaconId = decks.beacon.drawPile.shift() ?? null;
      if (beaconId) {
        activeBeaconIds.push(beaconId);
        beacons[beaconId].active = true;
      }
    }
  }

  const state: EngineState = {
    version: 'design-cutover-1',
    seed: command.seed,
    rng,
    rulesetId: command.rulesetId,
    mode: command.mode,
    round: 1,
    phase: 'SYSTEM',
    extractionPool: 0,
    globalGaze: 5,
    northernWarMachine: 7,
    domains: Object.fromEntries(
      Object.values(content.domains).map((domain) => [domain.id, { id: domain.id, progress: domain.initialProgress }]),
    ) as EngineState['domains'],
    regions,
    players,
    decks,
    beacons,
    activeBeaconIds,
    lastSystemCardIds: [],
    publicAttentionEvents: [],
    commandLog: [cloneState(command)],
    eventLog: [],
    winner: null,
    lossReason: null,
    mandatesResolved: false,
  };

  for (const player of state.players) {
    const drawTrace = resolveCardDraws(state, player.seat, 1);
    addEvent(state, 'system', 'starting_hands', '🃏', `Seat ${player.seat + 1} drew an opening resistance card.`, ['StartGame'], [drawTrace]);
  }

  state.extractionPool = calculateExtractionPool(state);
  updateBeaconCompletion(state, content);
  addSimpleEvent(state, 'system', 'game_start', '🌍', `${content.ruleset.name} begins in ${state.mode} mode.`, ['StartGame']);
  return state;
}

function getBaseActionDefinition(content: CompiledContent, actionId: ActionId): ActionDefinition {
  return assertExists(content.actions[actionId], `Unknown action ${actionId}.`);
}

function getDisabledReasonForIntent(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  intent: Omit<QueuedIntent, 'slot'>,
  options?: { resolvingQueued?: boolean },
): string | undefined {
  const player = state.players[seat];
  const action = getBaseActionDefinition(content, intent.actionId);
  if (!player) {
    return 'Unknown seat';
  }
  if (state.phase !== 'COALITION') {
    return 'Phase locked';
  }
  if (!options?.resolvingQueued && player.ready) {
    return 'Seat already ready';
  }
  if (!options?.resolvingQueued && player.actionsRemaining <= 0) {
    return 'No actions remaining';
  }
  if (action.needsRegion && !intent.regionId) {
    return 'Select a region';
  }
  if (action.needsDomain && !intent.domainId) {
    return 'Select a domain';
  }
  if (action.needsTargetSeat && (intent.targetSeat === undefined || intent.targetSeat === seat)) {
    return 'Select another seat';
  }
  if (action.id === 'build_solidarity') {
    if ((state.regions[intent.regionId!].bodiesPresent[seat] ?? 0) < 3) {
      return 'Need 3 Bodies in region';
    }
  }
  if (action.id === 'international_outreach') {
    const faction = getFaction(content, player);
    const cost = 2 + faction.outreachPenalty;
    if (player.evidence < cost) {
      return 'Not enough Evidence';
    }
  }
  if (action.id === 'smuggle_evidence') {
    if (player.evidence <= 0) {
      return 'No Evidence to move';
    }
    if ((state.regions[intent.regionId!].bodiesPresent[seat] ?? 0) < 1) {
      return 'Need 1 Body in region';
    }
  }
  if (action.id === 'defend') {
    if (!intent.bodiesCommitted || intent.bodiesCommitted < 1) {
      return 'Commit at least 1 Body';
    }
    if ((state.regions[intent.regionId!].bodiesPresent[seat] ?? 0) < intent.bodiesCommitted) {
      return 'Not enough Bodies in region';
    }
  }
  if (action.id === 'launch_campaign') {
    if (!intent.bodiesCommitted || intent.bodiesCommitted < 1) {
      return 'Commit at least 1 Body';
    }
    if ((state.regions[intent.regionId!].bodiesPresent[seat] ?? 0) < intent.bodiesCommitted) {
      return 'Not enough Bodies in region';
    }
    if ((intent.evidenceCommitted ?? 0) > player.evidence) {
      return 'Not enough Evidence';
    }
    if (intent.cardId) {
      const card = content.cards[intent.cardId];
      if (!card || card.deck !== 'resistance' || card.type !== 'support' || !player.resistanceHand.includes(intent.cardId)) {
        return 'Support card unavailable';
      }
    }
  }
  if (action.id === 'play_card') {
    if (!intent.cardId) {
      return 'Select a card';
    }
    const card = content.cards[intent.cardId];
    if (!card || card.deck !== 'resistance' || card.type !== 'action' || !player.resistanceHand.includes(intent.cardId)) {
      return 'Action card unavailable';
    }
  }

  return undefined;
}

export function getDisabledActionReason(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  action: Omit<QueuedIntent, 'slot'>,
): DisabledActionReason {
  const reason = getDisabledReasonForIntent(state, content, seat, action);
  return {
    actionId: action.actionId,
    disabled: Boolean(reason),
    reason,
  };
}

function sortCoalitionIntents(content: CompiledContent, intents: Array<{ seat: number; intent: QueuedIntent }>) {
  return intents.slice().sort((left, right) => {
    const leftAction = getBaseActionDefinition(content, left.intent.actionId);
    const rightAction = getBaseActionDefinition(content, right.intent.actionId);
    if (leftAction.resolvePriority !== rightAction.resolvePriority) {
      return leftAction.resolvePriority - rightAction.resolvePriority;
    }
    if (left.seat !== right.seat) {
      return left.seat - right.seat;
    }
    return left.intent.slot - right.intent.slot;
  });
}

function rollDie(state: EngineState, sides: number): number {
  const [next, value] = nextInt(state.rng, sides);
  state.rng = next;
  return value + 1;
}

function resolveOrganize(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const player = state.players[seat];
  const faction = getFaction(content, player);
  const regionId = assertExists(intent.regionId, 'Organize requires region.');
  const region = state.regions[regionId];
  const roll = rollDie(state, 6);
  let bodies = roll + (region.extractionTokens >= 4 ? 2 : 0);
  if (regionId === faction.homeRegion) {
    bodies += faction.organizeBonus;
  } else if (faction.id === 'levant_sumud') {
    bodies = Math.max(1, bodies - 1);
  }

  return applyEffects(
    state,
    content,
    [{ type: 'add_bodies', region: regionId, seat, amount: bodies }],
    {
      sourceType: 'action',
      sourceId: 'organize',
      emoji: '✊',
      message: `Seat ${seat + 1} organized in ${regionId}.`,
      causedBy: ['organize'],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['organize'] },
    },
  );
}

function resolveInvestigate(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const player = state.players[seat];
  const faction = getFaction(content, player);
  const regionId = assertExists(intent.regionId, 'Investigate requires region.');
  const evidenceGain = 2 + (regionId === faction.homeRegion ? faction.investigateBonus : 0);
  const traces = applyEffects(
    state,
    content,
    [{ type: 'gain_evidence', seat, amount: evidenceGain }],
    {
      sourceType: 'action',
      sourceId: 'investigate',
      emoji: '🔎',
      message: `Seat ${seat + 1} investigated ${regionId}.`,
      causedBy: ['investigate'],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['investigate'] },
    },
  );
  traces.push(resolveCardDraws(state, seat, 1));
  return traces;
}

function resolveBuildSolidarity(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const regionId = assertExists(intent.regionId, 'Build Solidarity requires region.');
  const domainId = assertExists(intent.domainId, 'Build Solidarity requires domain.');
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_bodies', region: regionId, seat, amount: 3 },
      { type: 'modify_domain', domain: domainId, delta: 1 },
    ],
    {
      sourceType: 'action',
      sourceId: 'build_solidarity',
      emoji: '🤝',
      message: `Seat ${seat + 1} built solidarity in ${regionId}.`,
      causedBy: ['build_solidarity'],
      context: { actingSeat: seat, targetRegionId: regionId, targetDomainId: domainId, causedBy: ['build_solidarity'] },
    },
  );
}

function resolveSmuggleEvidence(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const regionId = assertExists(intent.regionId, 'Smuggle Witness requires region.');
  const targetSeat = assertExists(intent.targetSeat, 'Smuggle Witness requires target seat.');
  const faction = getFaction(content, state.players[seat]);
  const transferAmount = faction.id === 'amazon_guardians' ? 1 : Math.min(2, state.players[seat].evidence);
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_bodies', region: regionId, seat, amount: 1 },
      { type: 'lose_evidence', seat, amount: transferAmount },
      { type: 'gain_evidence', seat: targetSeat, amount: transferAmount },
    ],
    {
      sourceType: 'action',
      sourceId: 'smuggle_evidence',
      emoji: '📨',
      message: `Seat ${seat + 1} smuggled witness to seat ${targetSeat + 1}.`,
      causedBy: ['smuggle_evidence'],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['smuggle_evidence'] },
    },
  );
}

function resolveInternationalOutreach(state: EngineState, content: CompiledContent, seat: number): EffectTrace[] {
  const faction = getFaction(content, state.players[seat]);
  const cost = 2 + faction.outreachPenalty;
  return applyEffects(
    state,
    content,
    [
      { type: 'lose_evidence', seat, amount: cost },
      { type: 'modify_gaze', delta: 1 },
    ],
    {
      sourceType: 'action',
      sourceId: 'international_outreach',
      emoji: '📡',
      message: `Seat ${seat + 1} raised a global appeal.`,
      causedBy: ['international_outreach'],
      context: { actingSeat: seat, causedBy: ['international_outreach'] },
    },
  );
}

function resolveDefend(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const regionId = assertExists(intent.regionId, 'Defend requires region.');
  const bodies = assertExists(intent.bodiesCommitted, 'Defend requires committed bodies.');
  const faction = getFaction(content, state.players[seat]);
  const defenseAmount = bodies + (regionId === faction.homeRegion ? faction.defenseBonus : 0) - (faction.id === 'mekong_echo_network' && regionId !== 'Mekong' ? 1 : 0);
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_bodies', region: regionId, seat, amount: bodies },
      { type: 'set_defense', region: regionId, amount: Math.max(1, defenseAmount) },
    ],
    {
      sourceType: 'action',
      sourceId: 'defend',
      emoji: '🛡️',
      message: `Seat ${seat + 1} fortified ${regionId}.`,
      causedBy: ['defend'],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['defend'] },
    },
  );
}

function resolvePlayCard(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const cardId = assertExists(intent.cardId, 'Play Card requires card.');
  const regionId = intent.regionId;
  const card = assertExists(content.cards[cardId], `Missing card ${cardId}.`);
  if (card.deck !== 'resistance' || card.type !== 'action') {
    throw new Error(`${cardId} is not an action card.`);
  }
  removeCardFromHand(state, seat, cardId);
  moveCardToDiscard(state, 'resistance', cardId);
  return applyEffects(
    state,
    content,
    card.effects ?? [],
    {
      sourceType: 'card',
      sourceId: card.id,
      emoji: '🃏',
      message: `${card.name} resolved.`,
      causedBy: ['play_card', card.id],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['play_card', card.id] },
    },
  );
}

function resolveLaunchCampaign(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const regionId = assertExists(intent.regionId, 'Launch Campaign requires region.');
  const domainId = assertExists(intent.domainId, 'Launch Campaign requires domain.');
  const committedBodies = assertExists(intent.bodiesCommitted, 'Launch Campaign requires bodies.');
  const committedEvidence = intent.evidenceCommitted ?? 0;
  const player = state.players[seat];
  const faction = getFaction(content, player);
  const support = getCampaignSupportBonus(state, content, seat, intent);

  const spendTrace = applyEffects(
    state,
    content,
    [
      { type: 'remove_bodies', region: regionId, seat, amount: committedBodies },
      { type: 'lose_evidence', seat, amount: committedEvidence },
    ],
    {
      sourceType: 'action',
      sourceId: 'launch_campaign_spend',
      emoji: '⚔️',
      message: 'Campaign costs paid.',
      causedBy: ['launch_campaign'],
      context: { actingSeat: seat, targetRegionId: regionId, targetDomainId: domainId, causedBy: ['launch_campaign'] },
    },
  );

  if (support.card) {
    removeCardFromHand(state, seat, support.card.id);
    moveCardToDiscard(state, 'resistance', support.card.id);
  }

  const dieOne = rollDie(state, 6);
  const dieTwo = rollDie(state, 6);
  let modifier = Math.floor(committedBodies / 2) + committedEvidence;
  modifier += Math.floor(state.globalGaze / 5);
  modifier -= Math.floor(state.northernWarMachine / 4);
  if (regionId === faction.homeRegion) {
    modifier += faction.campaignBonus;
  }
  if (faction.campaignDomainBonus === domainId) {
    modifier += 1;
  }
  modifier += support.bonus;

  const total = dieOne + dieTwo + modifier;
  const success = total >= 8;
  const traces = [...spendTrace];

  traces.push({
    effectType: 'launch_campaign',
    status: 'executed',
    message: `Campaign rolled ${dieOne}+${dieTwo}+${modifier} = ${total}.`,
    causedBy: ['launch_campaign'],
    deltas: [],
  });

  if (success) {
    const victoryEffects: Effect[] = [
      { type: 'remove_extraction', region: regionId, amount: total >= 11 ? 2 : 1 },
      { type: 'modify_domain', domain: domainId, delta: 1 },
    ];
    if (domainId === 'WarMachine' && total >= 10) {
      victoryEffects.push({ type: 'modify_war_machine', delta: -1 });
    }
    traces.push(
      ...applyEffects(
        state,
        content,
        victoryEffects,
        {
          sourceType: 'action',
          sourceId: 'launch_campaign_success',
          emoji: '🔥',
          message: `Campaign succeeded in ${regionId}.`,
          causedBy: ['launch_campaign'],
          context: { actingSeat: seat, targetRegionId: regionId, targetDomainId: domainId, causedBy: ['launch_campaign'] },
        },
      ),
    );
  } else {
    const backlashEffects: Effect[] = total <= 5
      ? [
          { type: 'add_extraction', region: regionId, amount: 1 },
          { type: 'modify_war_machine', delta: 1 },
        ]
      : [{ type: 'modify_gaze', delta: 1 }];
    traces.push(
      ...applyEffects(
        state,
        content,
        backlashEffects,
        {
          sourceType: 'action',
          sourceId: 'launch_campaign_failure',
          emoji: '💥',
          message: `Campaign failed in ${regionId}.`,
          causedBy: ['launch_campaign'],
          context: { actingSeat: seat, targetRegionId: regionId, targetDomainId: domainId, causedBy: ['launch_campaign'] },
        },
      ),
    );
  }

  return traces;
}

function resolveQueuedAction(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent) {
  const action = getBaseActionDefinition(content, intent.actionId);
  let traces: EffectTrace[] = [];

  switch (action.id) {
    case 'organize':
      traces = resolveOrganize(state, content, seat, intent);
      break;
    case 'investigate':
      traces = resolveInvestigate(state, content, seat, intent);
      break;
    case 'launch_campaign':
      traces = resolveLaunchCampaign(state, content, seat, intent);
      break;
    case 'build_solidarity':
      traces = resolveBuildSolidarity(state, content, seat, intent);
      break;
    case 'smuggle_evidence':
      traces = resolveSmuggleEvidence(state, content, seat, intent);
      break;
    case 'international_outreach':
      traces = resolveInternationalOutreach(state, content, seat);
      break;
    case 'defend':
      traces = resolveDefend(state, content, seat, intent);
      break;
    case 'play_card':
      traces = resolvePlayCard(state, content, seat, intent);
      break;
  }

  addEvent(
    state,
    'action',
    action.id,
    '🪨',
    `Seat ${seat + 1} resolved ${action.name}.`,
    [action.id],
    traces,
  );
}

export function normalizeEngineState(state: EngineState): EngineState {
  const next = cloneState(state);
  next.extractionPool = calculateExtractionPool(next);
  next.activeBeaconIds = next.activeBeaconIds ?? [];
  next.publicAttentionEvents = next.publicAttentionEvents ?? [];
  next.lastSystemCardIds = next.lastSystemCardIds ?? [];
  next.mandatesResolved = next.mandatesResolved ?? false;
  return next;
}

export function initializeGame(command: StartGameCommand): EngineState {
  const content = compileContent(command.rulesetId);
  return createInitialState(command, content);
}

export function dispatchCommand(state: EngineState, command: EngineCommand, content: CompiledContent): EngineState {
  if (command.type === 'LoadSnapshot') {
    return normalizeEngineState(command.payload.snapshot);
  }

  if (command.type === 'SaveSnapshot') {
    const next = cloneState(state);
    next.commandLog.push(cloneState(command));
    addSimpleEvent(next, 'command', 'SaveSnapshot', '💾', 'Snapshot prepared.', ['SaveSnapshot']);
    return next;
  }

  if (command.type === 'StartGame') {
    return initializeGame(command);
  }

  const next = normalizeEngineState(state);
  next.commandLog.push(cloneState(command));

  switch (command.type) {
    case 'QueueIntent': {
      const reason = getDisabledReasonForIntent(next, content, command.seat, command.action);
      if (reason) {
        addRejectedCommandEvent(next, command, reason);
        return next;
      }
      const player = next.players[command.seat];
      player.queuedIntents.push({ ...command.action, slot: player.queuedIntents.length });
      player.actionsRemaining -= 1;
      addSimpleEvent(next, 'command', 'QueueIntent', '📝', `Seat ${command.seat + 1} queued ${command.action.actionId}.`, ['QueueIntent']);
      return next;
    }
    case 'RemoveQueuedIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Cannot remove intents outside Coalition.');
        return next;
      }
      const player = next.players[command.seat];
      const removed = player?.queuedIntents.find((intent) => intent.slot === command.slot);
      if (!player || !removed) {
        addRejectedCommandEvent(next, command, 'Queued intent not found.');
        return next;
      }
      player.queuedIntents = player.queuedIntents.filter((intent) => intent.slot !== command.slot).map((intent, slot) => ({ ...intent, slot }));
      player.actionsRemaining += 1;
      player.ready = false;
      addSimpleEvent(next, 'command', 'RemoveQueuedIntent', '↩️', `Seat ${command.seat + 1} pulled a queued move.`, ['RemoveQueuedIntent']);
      return next;
    }
    case 'ReorderQueuedIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Cannot reorder intents outside Coalition.');
        return next;
      }
      const player = next.players[command.seat];
      if (!player || command.fromSlot < 0 || command.fromSlot >= player.queuedIntents.length || command.toSlot < 0 || command.toSlot >= player.queuedIntents.length) {
        addRejectedCommandEvent(next, command, 'Queued intent not found.');
        return next;
      }
      const queue = player.queuedIntents.slice();
      const [moved] = queue.splice(command.fromSlot, 1);
      queue.splice(command.toSlot, 0, moved);
      player.queuedIntents = queue.map((intent, slot) => ({ ...intent, slot }));
      player.ready = false;
      addSimpleEvent(next, 'command', 'ReorderQueuedIntent', '🔀', `Seat ${command.seat + 1} reordered planned moves.`, ['ReorderQueuedIntent']);
      return next;
    }
    case 'SetReady': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Ready state is only valid in Coalition.');
        return next;
      }
      const player = next.players[command.seat];
      if (!player) {
        addRejectedCommandEvent(next, command, 'Unknown seat.');
        return next;
      }
      if (command.ready && player.actionsRemaining > 0) {
        addRejectedCommandEvent(next, command, 'Spend or queue all actions before readying.');
        return next;
      }
      player.ready = command.ready;
      addSimpleEvent(next, 'command', 'SetReady', command.ready ? '✅' : '⚪', `Seat ${command.seat + 1} is ${command.ready ? 'ready' : 'not ready'}.`, ['SetReady']);
      return next;
    }
    case 'ResolveSystemPhase': {
      if (next.phase !== 'SYSTEM') {
        addRejectedCommandEvent(next, command, 'System phase is not active.');
        return next;
      }

      next.lastSystemCardIds = [];
      next.publicAttentionEvents = [];
      const drawCount = next.globalGaze >= 10 ? 2 : 1;
      if (drawCount > 1) {
        addSystemAttentionEvent(next, 'Global Gaze is high. The system strikes twice this round.');
      }

      for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
        const cardId = drawCard(next, 'system');
        if (!cardId) {
          continue;
        }
        next.lastSystemCardIds.push(cardId);
        resolveSystemCard(next, content, cardId);
        if (checkExtractionLoss(next)) {
          return next;
        }
      }

      resolveMilitaryIntervention(next, content);
      if (checkExtractionLoss(next)) {
        return next;
      }

      for (const region of Object.values(next.regions)) {
        region.defenseRating = 0;
      }

      for (const player of next.players) {
        player.actionsRemaining = ACTIONS_PER_TURN;
        player.ready = false;
        player.queuedIntents = [];
      }

      next.phase = 'COALITION';
      addSimpleEvent(next, 'command', 'ResolveSystemPhase', '🌐', 'System phase resolved. Coalition planning opens.', ['ResolveSystemPhase']);
      return next;
    }
    case 'CommitCoalitionIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Coalition commit is only valid in Coalition.');
        return next;
      }
      if (!next.players.every((player) => player.ready)) {
        addRejectedCommandEvent(next, command, 'All seats must be ready before resolving.');
        return next;
      }

      const ordered = sortCoalitionIntents(
        content,
        next.players.flatMap((player) => player.queuedIntents.map((intent) => ({ seat: player.seat, intent }))),
      );

      for (const { seat, intent } of ordered) {
        const reason = getDisabledReasonForIntent(next, content, seat, intent, { resolvingQueued: true });
        if (reason) {
          addSimpleEvent(next, 'action', intent.actionId, '❌', `Seat ${seat + 1} failed to resolve ${intent.actionId}: ${reason}.`, [
            'CommitCoalitionIntent',
            intent.actionId,
          ]);
          continue;
        }
        resolveQueuedAction(next, content, seat, intent);
        if (checkExtractionLoss(next)) {
          return next;
        }
      }

      for (const player of next.players) {
        player.ready = false;
        player.queuedIntents = [];
      }

      next.phase = 'RESOLUTION';
      addSimpleEvent(next, 'command', 'CommitCoalitionIntent', '⚖️', 'Coalition intents resolved.', ['CommitCoalitionIntent']);
      return next;
    }
    case 'ResolveResolutionPhase': {
      if (next.phase !== 'RESOLUTION') {
        addRejectedCommandEvent(next, command, 'Resolution phase is not active.');
        return next;
      }

      updateBeaconCompletion(next, content);
      if (checkPositiveVictory(next, content)) {
        return next;
      }
      if (checkExtractionLoss(next)) {
        return next;
      }
      if (next.round >= content.ruleset.suddenDeathRound) {
        next.phase = 'LOSS';
        next.lossReason = `Round ${content.ruleset.suddenDeathRound} ended without a decisive victory.`;
        revealMandates(next);
        addSimpleEvent(next, 'system', 'sudden_death', '⌛', next.lossReason, ['sudden_death']);
        return next;
      }

      next.round += 1;
      next.phase = 'SYSTEM';
      addSimpleEvent(next, 'command', 'ResolveResolutionPhase', '🔁', `Round ${next.round} begins.`, ['ResolveResolutionPhase']);
      return next;
    }
    default:
      return next;
  }
}

export function serializeForReplay(state: EngineState) {
  return {
    rulesetId: state.rulesetId,
    mode: state.mode,
    seed: state.seed,
    commands: state.commandLog,
  };
}

export function replayCommands(commandLog: EngineCommand[]): EngineState {
  const start = commandLog[0];
  if (!start || start.type !== 'StartGame') {
    throw new Error('Replay requires a StartGame command at position 0.');
  }

  let state = initializeGame(start);
  const content = compileContent(start.rulesetId);
  for (const command of commandLog.slice(1)) {
    state = dispatchCommand(state, command, content);
  }
  return state;
}
