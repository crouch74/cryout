import { compileContent } from './content.ts';
import { createRng, nextInt, shuffle } from './rng.ts';
import { getRegionLabel, localizeDomainField, t } from '../../../i18n/index.ts';
import type { JsonValue, StructuredEvent } from '../../types.ts';
import type {
  ActionDefinition,
  ActionId,
  CampaignModifierEntry,
  CampaignResolvedEventPayload,
  CardRevealEvent,
  CompiledContent,
  DeckId,
  Condition,
  DisabledActionReason,
  DomainEvent,
  DomainId,
  Effect,
  EffectTrace,
  EngineCommand,
  EngineState,
  FactionDefinition,
  FactionId,
  PlayerState,
  QueuedIntent,
  RegionId,
  RegionSelector,
  ResistanceCardDefinition,
  RollResolution,
  SeatSelector,
  StartGameCommand,
  StateDelta,
  TerminalOutcomeCause,
  TerminalOutcomeSummary,
  VictoryScoreComponent,
  VictoryScoringConfig,
  SystemEscalationTriggerId,
  SystemPersistentModifiers,
} from './types.ts';


const ACTIONS_PER_TURN = 2;
const EXTRACTION_DEFEAT_THRESHOLD = 6;
const MAX_EXTRACTION_POOL = 36;
const BASE_CAMPAIGN_TARGET = 8;
const SYMBOLIC_ESCALATION_ROUND = 6;
const SYSTEM_ESCALATION_TRIGGER_PRIORITY: SystemEscalationTriggerId[] = [
  'extraction_threshold',
  'war_machine_threshold',
  'gaze_threshold',
  'failed_campaigns',
  'symbolic_round_six',
];

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
  crisisExtractionBonus?: number;
  suppressScenarioHooks?: boolean;
}

interface DisabledReasonDetail {
  code: NonNullable<DisabledActionReason['reasonCode']>;
  values?: Record<string, string | number>;
}

interface VictoryCheckContext {
  trigger: 'resolution' | 'action';
  actionId?: string;
}

function compactRecord<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function buildCampaignResolvedPayload(
  event: DomainEvent,
  roll: RollResolution,
): CampaignResolvedEventPayload {
  return compactRecord({
    eventSeq: event.seq,
    actionId: roll.actionId,
    seat: roll.seat,
    regionId: roll.regionId,
    domainId: roll.domainId,
    diceKind: '2d6' as const,
    dice: roll.dice,
    modifier: roll.modifier,
    modifiers: (event.context?.campaignModifiers ?? []) as CampaignModifierEntry[],
    total: roll.total,
    target: roll.target,
    success: roll.success,
    outcomeBand: roll.outcomeBand,
    extractionRemoved: roll.extractionRemoved,
    domainDelta: roll.domainDelta,
    globalGazeDelta: roll.globalGazeDelta,
    warMachineDelta: roll.warMachineDelta,
    committedComrades: event.context?.committedComrades,
    committedEvidence: event.context?.committedEvidence,
  });
}

export function toCompatStructuredEvent(event: DomainEvent): StructuredEvent {
  const roll = event.context?.roll;
  const isCampaignResolved = event.sourceType === 'action' && event.sourceId === 'launch_campaign' && roll;

  return {
    id: `legacy:${event.seq}`,
    type: isCampaignResolved ? 'ui.action.CAMPAIGN_RESOLVED' : `legacy.${event.sourceType}.${event.sourceId}`,
    source: event.sourceId,
    payload: (
      isCampaignResolved
        ? buildCampaignResolvedPayload(event, roll)
        : {
          round: event.round,
          phase: event.phase,
          sourceType: event.sourceType,
          message: event.message,
          context: (event.context ?? {}) as unknown as JsonValue,
        }
    ) as unknown as Record<string, JsonValue>,
    tags: isCampaignResolved ? ['legacy', 'action', 'campaign', event.phase] : ['legacy', event.sourceType, event.phase],
    level: event.emoji === '❌' ? 'warning' : 'info',
    messageKey: isCampaignResolved ? 'ui.action.CAMPAIGN_RESOLVED' : event.sourceId,
  };
}

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

interface NormalizedStartGameConfig {
  humanPlayerCount: number;
  seatFactionIds: FactionId[];
  seatOwnerIds: number[];
}

export function buildBalancedSeatOwners(humanPlayerCount: number, factionIds: FactionId[]): number[] {
  const owners: number[] = [];
  const baseSeatsPerOwner = Math.floor(factionIds.length / humanPlayerCount);
  const remainder = factionIds.length % humanPlayerCount;

  for (let ownerId = 0; ownerId < humanPlayerCount; ownerId += 1) {
    const seatsForOwner = baseSeatsPerOwner + (ownerId < remainder ? 1 : 0);
    for (let seat = 0; seat < seatsForOwner; seat += 1) {
      owners.push(ownerId);
    }
  }

  return owners.slice(0, factionIds.length);
}

function normalizeStartGameCommand(command: StartGameCommand): NormalizedStartGameConfig {
  const seatFactionIds = [...(command.seatFactionIds ?? command.factionIds ?? [])];
  const humanPlayerCount = command.humanPlayerCount ?? command.playerCount ?? 2;
  const seatOwnerIds = [...(
    command.seatOwnerIds
    ?? (humanPlayerCount === seatFactionIds.length
      ? seatFactionIds.map((_, seat) => seat)
      : buildBalancedSeatOwners(humanPlayerCount, seatFactionIds))
  )];

  return {
    humanPlayerCount,
    seatFactionIds,
    seatOwnerIds,
  };
}

function areSecretMandatesEnabled(command: Pick<StartGameCommand, 'secretMandates'>) {
  return command.secretMandates !== 'disabled';
}

function validateStartGameCommand(command: StartGameCommand, content: CompiledContent) {
  const scenarioFactionIds = content.ruleset.factions.map((faction) => faction.id);
  const { humanPlayerCount, seatFactionIds, seatOwnerIds } = normalizeStartGameCommand(command);

  if (humanPlayerCount < 2) {
    throw new Error(`Scenario startup rejected: humanPlayerCount ${humanPlayerCount} must be at least 2.`);
  }
  if (humanPlayerCount > scenarioFactionIds.length) {
    throw new Error(`Scenario startup rejected: ${content.ruleset.id} supports at most ${scenarioFactionIds.length} human players.`);
  }
  if (seatFactionIds.length !== scenarioFactionIds.length) {
    throw new Error(`Scenario startup rejected: ${content.ruleset.id} requires ${scenarioFactionIds.length} faction seats.`);
  }
  const invalidFactionIds = seatFactionIds.filter((factionId) => !scenarioFactionIds.includes(factionId));
  if (invalidFactionIds.length > 0) {
    throw new Error(`Scenario startup rejected: unsupported factions ${invalidFactionIds.join(', ')}.`);
  }
  const duplicateFactionIds = seatFactionIds.filter((factionId, index) => seatFactionIds.indexOf(factionId) !== index);
  if (duplicateFactionIds.length > 0) {
    throw new Error(`Scenario startup rejected: duplicate factions ${Array.from(new Set(duplicateFactionIds)).join(', ')}.`);
  }
  const missingFactionIds = scenarioFactionIds.filter((factionId) => !seatFactionIds.includes(factionId));
  if (missingFactionIds.length > 0) {
    throw new Error(`Scenario startup rejected: missing factions ${missingFactionIds.join(', ')}.`);
  }
  if (seatOwnerIds.length !== seatFactionIds.length) {
    throw new Error(`Scenario startup rejected: seatOwnerIds length ${seatOwnerIds.length} does not match faction seat count ${seatFactionIds.length}.`);
  }
  const invalidOwnerIds = seatOwnerIds.filter((ownerId) => !Number.isInteger(ownerId) || ownerId < 0 || ownerId >= humanPlayerCount);
  if (invalidOwnerIds.length > 0) {
    throw new Error(`Scenario startup rejected: invalid owner IDs ${Array.from(new Set(invalidOwnerIds)).join(', ')}.`);
  }
  for (let ownerId = 0; ownerId < humanPlayerCount; ownerId += 1) {
    if (!seatOwnerIds.includes(ownerId)) {
      throw new Error(`Scenario startup rejected: owner ${ownerId} has no assigned factions.`);
    }
  }
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

function compactContext(context: DomainEvent['context']) {
  if (!context) {
    return undefined;
  }

  const compacted = Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as DomainEvent['context'];

  return Object.keys(compacted as Record<string, unknown>).length > 0 ? compacted : undefined;
}

function addEvent(
  state: EngineState,
  sourceType: DomainEvent['sourceType'],
  sourceId: string,
  emoji: string,
  message: string,
  causedBy: string[],
  trace: EffectTrace[] = [],
  context?: DomainEvent['context'],
): void {
  const compactedContext = compactContext(context);
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
    ...(compactedContext ? { context: compactedContext } : {}),
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

function createTerminalOutcome(
  state: EngineState,
  kind: TerminalOutcomeSummary['kind'],
  cause: TerminalOutcomeCause,
  title: string,
  summary: string,
  extras: Partial<Omit<TerminalOutcomeSummary, 'kind' | 'cause' | 'title' | 'summary' | 'round' | 'triggeredByEventSeq'>> = {},
): TerminalOutcomeSummary {
  return {
    kind,
    cause,
    title,
    summary,
    round: state.round,
    triggeredByEventSeq: null,
    ...extras,
  };
}

function finalizeTerminalEvent(state: EngineState, outcome: TerminalOutcomeSummary) {
  outcome.triggeredByEventSeq = state.eventLog.at(-1)?.seq ?? null;
  state.terminalOutcome = outcome;
}

function addRejectedCommandEvent(state: EngineState, command: EngineCommand, reason: string): void {
  addSimpleEvent(state, 'command', command.type, '❌', reason, [command.type]);
}

function toLegacyDisabledReason(detail: DisabledReasonDetail): string {
  switch (detail.code) {
    case 'unknown_seat':
      return t('ui.game.unknownSeat', 'Unknown seat');
    case 'phase_locked':
      return t('ui.game.phaseLocked', 'Phase locked');
    case 'seat_already_ready':
      return t('ui.game.seatAlreadyReady', 'Seat already ready');
    case 'no_actions_remaining':
      return t('ui.game.noActionsRemaining', 'No actions remaining');
    case 'select_region':
      return t('ui.game.selectRegion', 'Select a region');
    case 'select_domain':
      return t('ui.game.selectDomain', 'Select a domain');
    case 'select_another_seat':
      return t('ui.game.selectAnotherSeat', 'Select another seat');
    case 'need_three_comrades':
      return t('ui.game.needThreeComrades', 'Need 3 Comrades in region');
    case 'not_enough_evidence':
      return t('ui.game.notEnoughEvidence', 'Not enough Evidence');
    case 'no_evidence_to_move':
      return t('ui.game.noEvidenceToMove', 'No Evidence to move');
    case 'need_one_body':
      return t('ui.game.needOneBody', 'Need 1 Comrade in region');
    case 'commit_one_body':
      return t('ui.game.commitOneBody', 'Commit at least 1 Comrade');
    case 'not_enough_comrades':
      return t('ui.game.notEnoughComrades', 'Not enough Comrades in region');
    case 'support_card_unavailable':
      return t('ui.game.supportCardUnavailable', 'Support card unavailable');
    case 'action_card_unavailable':
      return t('ui.game.actionCardUnavailable', 'Action card unavailable');
    case 'select_card':
      return t('ui.game.selectCard', 'Select a card');
  }
}

function addCardRevealEvent(
  state: EngineState,
  reveal: CardRevealEvent,
  sourceType: DomainEvent['sourceType'],
  sourceId: string,
  message: string,
  causedBy: string[],
): void {
  addEvent(
    state,
    sourceType,
    sourceId,
    '🃏',
    message,
    causedBy,
    [],
    {
      actingSeat: reveal.seat,
      sourceDeckId: reveal.deckId,
      cardReveals: [reveal],
    },
  );
}

function getSeatTotalComrades(state: EngineState, seat: number) {
  return Object.values(state.regions).reduce((sum, region) => sum + (region.comradesPresent[seat] ?? 0), 0);
}

function getTotalComrades(state: EngineState) {
  return state.players.reduce((sum, player) => sum + getSeatTotalComrades(state, player.seat), 0);
}

function getRulesetSetup(content: CompiledContent) {
  return content.ruleset.setup;
}

function calculateExtractionPool(state: EngineState, content: CompiledContent = compileContent(state.rulesetId)) {
  const inPlay = Object.values(state.regions).reduce((sum, region) => sum + region.extractionTokens, 0);
  const maxPool = getRulesetSetup(content)?.extractionPool ?? MAX_EXTRACTION_POOL;
  return Math.max(0, maxPool - inPlay);
}

function getCustomTrackState(state: EngineState, trackId: string) {
  return state.customTracks[trackId];
}

function getTotalExtractionTokens(state: EngineState) {
  return Object.values(state.regions).reduce((sum, region) => sum + region.extractionTokens, 0);
}

function createDefaultEscalationTriggers(): Record<SystemEscalationTriggerId, boolean> {
  return {
    extraction_threshold: false,
    war_machine_threshold: false,
    gaze_threshold: false,
    failed_campaigns: false,
    symbolic_round_six: false,
  };
}

function getSystemPersistentModifiers(state: EngineState, content: CompiledContent): Required<SystemPersistentModifiers> {
  const totals: Required<SystemPersistentModifiers> = {
    campaignTargetDelta: 0,
    campaignModifierDelta: 0,
    outreachCostDelta: 0,
    resistanceDrawDelta: 0,
    crisisDrawDelta: 0,
    crisisExtractionBonus: 0,
  };

  for (const cardId of state.activeSystemCardIds) {
    const card = content.cards[cardId];
    if (!card || card.deck !== 'system') {
      continue;
    }

    const modifiers = card.persistentModifiers ?? {};
    totals.campaignTargetDelta += modifiers.campaignTargetDelta ?? 0;
    totals.campaignModifierDelta += modifiers.campaignModifierDelta ?? 0;
    totals.outreachCostDelta += modifiers.outreachCostDelta ?? 0;
    totals.resistanceDrawDelta += modifiers.resistanceDrawDelta ?? 0;
    totals.crisisDrawDelta += modifiers.crisisDrawDelta ?? 0;
    totals.crisisExtractionBonus += modifiers.crisisExtractionBonus ?? 0;
  }

  if (state.scenarioFlags.stateOfEmergencyNationwide) {
    totals.campaignTargetDelta += 1;
  }

  return totals;
}

function revealMandates(state: EngineState) {
  for (const player of state.players) {
    player.mandateRevealed = true;
  }
  state.mandatesResolved = true;
}

function updatePersistentMandateSatisfaction(
  state: EngineState,
  content: CompiledContent,
  context: { actingSeat: number; actionId: ActionId },
) {
  if (!state.secretMandatesEnabled) {
    return;
  }

  for (const player of state.players) {
    if (player.mandateSatisfied) {
      continue;
    }

    const faction = getFaction(content, player);
    const satisfied = evaluateCondition(
      state,
      content,
      faction.mandate.condition,
      { actingSeat: player.seat, causedBy: [faction.mandate.id, context.actionId] },
    );
    if (!satisfied) {
      continue;
    }

    player.mandateSatisfied = true;
    addEvent(
      state,
      'mandate',
      'mandate_satisfied',
      '🧭',
      `🧭 Seat ${player.seat + 1} locked ${faction.mandate.title}.`,
      [faction.mandate.id, context.actionId, 'mandate_satisfied'],
      [],
      {
        actingSeat: context.actingSeat,
        actionId: context.actionId,
        causedBy: [faction.mandate.id, context.actionId],
      },
    );
  }
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
        case 'player_total_comrades':
          left = getSeatTotalComrades(state, resolveSeatSelector(condition.left.player ?? 'seat_owner', context));
          break;
        case 'custom_track':
          left = getCustomTrackState(state, assertExists(condition.left.track, 'Missing track on compare ref.'))?.value ?? 0;
          break;
        case 'scenario_flag':
          left = state.scenarioFlags[assertExists(condition.left.flag, 'Missing flag on compare ref.')] ? 1 : 0;
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
      return (Object.keys(state.regions) as RegionId[]).every((regionId) => state.regions[regionId].extractionTokens <= condition.count);
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

  const candidates = (Object.keys(state.regions) as RegionId[])
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

function drawCard(state: EngineState, deckId: DeckId): string | null {
  const deck = state.decks[deckId];
  if (deckId !== 'system' && deck.drawPile.length === 0 && deck.discardPile.length > 0) {
    const [nextRng, shuffled] = shuffle(state.rng, deck.discardPile);
    state.rng = nextRng;
    deck.drawPile = shuffled;
    deck.discardPile = [];
  }
  return deck.drawPile.shift() ?? null;
}

function moveCardToDiscard(state: EngineState, deckId: 'resistance' | 'crisis', cardId: string) {
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

function appendScenarioTrackTrace(
  traces: EffectTrace[],
  trackId: string,
  before: number,
  after: number,
  causedBy: string[],
  message: string,
) {
  traces.push({
    effectType: 'modify_custom_track',
    status: 'executed',
    message,
    causedBy,
    deltas: [createDelta('track', trackId, before, after)],
  });
}

function processScenarioThresholdRules(state: EngineState, content: CompiledContent, causedBy: string[]) {
  const rules = content.ruleset.scenarioHooks?.thresholdRules ?? [];

  for (const rule of rules) {
    const track = getCustomTrackState(state, rule.trackId);
    if (!track || track.value < rule.threshold) {
      continue;
    }

    const thresholdKey = `${rule.trackId}:${rule.threshold}`;
    if (rule.once && state.triggeredScenarioThresholds[thresholdKey]) {
      continue;
    }

    if (rule.once) {
      state.triggeredScenarioThresholds[thresholdKey] = true;
    }

    const traces = applyEffects(
      state,
      content,
      rule.effects,
      {
        sourceType: 'system',
        sourceId: `threshold_${rule.trackId}_${rule.threshold}`,
        emoji: '🚩',
        message: `${rule.trackId} crossed ${rule.threshold}.`,
        causedBy: [...causedBy, thresholdKey],
        context: { causedBy: [...causedBy, thresholdKey] },
        suppressScenarioHooks: true,
      },
    );

    addEvent(
      state,
      'system',
      `threshold_${rule.trackId}_${rule.threshold}`,
      '🚩',
      `${rule.trackId} crossed ${rule.threshold}.`,
      [...causedBy, thresholdKey],
      traces,
    );
  }
}

function processScenarioRoundPenalty(state: EngineState, content: CompiledContent) {
  const penalty = content.ruleset.scenarioHooks?.maxTrackRoundPenalty;
  if (!penalty) {
    return;
  }

  const track = getCustomTrackState(state, penalty.trackId);
  if (!track || track.value < track.max) {
    return;
  }

  const targetedRegion = Object.values(state.regions)
    .map((region) => ({
      regionId: region.id,
      comrades: Object.entries(region.comradesPresent).map(([seat, amount]) => ({ seat: Number(seat), amount })).sort((left, right) => right.amount - left.amount),
      totalComrades: Object.values(region.comradesPresent).reduce((sum, amount) => sum + amount, 0),
    }))
    .sort((left, right) => right.totalComrades - left.totalComrades)[0];

  const targetRegionId = targetedRegion?.totalComrades ? targetedRegion.regionId : undefined;
  const actingSeat = targetedRegion?.comrades[0]?.amount ? targetedRegion.comrades[0].seat : undefined;

  const traces = applyEffects(
    state,
    content,
    penalty.effects,
    {
      sourceType: 'system',
      sourceId: `round_penalty_${penalty.trackId}`,
      emoji: '☠️',
      message: `${penalty.trackId} is at maximum pressure.`,
      causedBy: ['round_penalty', penalty.trackId],
      context: { actingSeat, targetRegionId, causedBy: ['round_penalty', penalty.trackId] },
      suppressScenarioHooks: true,
    },
  );

  addEvent(
    state,
    'system',
    `round_penalty_${penalty.trackId}`,
    '☠️',
    `${penalty.trackId} is at maximum pressure.`,
    ['round_penalty', penalty.trackId],
    traces,
  );
}

function applyScenarioPostEffects(
  state: EngineState,
  content: CompiledContent,
  traces: EffectTrace[],
  source: ApplyEffectSource,
) {
  if (source.suppressScenarioHooks) {
    return;
  }

  const hooks = content.ruleset.scenarioHooks;
  if (!hooks) {
    return;
  }

  if (hooks.evidenceGainRaisesRepression && state.customTracks.repression_cycle) {
    const evidenceRaised = traces.some((trace) => trace.deltas.some((delta) => delta.kind === 'evidence'
      && typeof delta.before === 'number'
      && typeof delta.after === 'number'
      && delta.after > delta.before));
    if (evidenceRaised) {
      const track = state.customTracks.repression_cycle;
      const before = track.value;
      track.value = clamp(track.value + (hooks.evidenceGainRepressionDelta ?? 1), { min: track.min, max: track.max });
      if (track.value !== before) {
        appendScenarioTrackTrace(
          traces,
          'repression_cycle',
          before,
          track.value,
          [...source.causedBy, 'repression_cycle'],
          '🚨 Repression rose in response to new Evidence.',
        );
      }
    }
  }

  if (
    source.sourceId === 'launch_campaign_success'
    && source.context.targetRegionId
    && hooks.urbanCampaignRegions?.includes(source.context.targetRegionId)
    && (hooks.successfulUrbanCampaignWarMachineDelta ?? 0) !== 0
  ) {
    const before = state.northernWarMachine;
    state.northernWarMachine = clamp(
      state.northernWarMachine + (hooks.successfulUrbanCampaignWarMachineDelta ?? 0),
      { min: 0, max: 12 },
    );
    if (state.northernWarMachine !== before) {
      traces.push({
        effectType: 'modify_war_machine',
        status: 'executed',
        message: '🚩 Urban operations escalated the War Machine.',
        causedBy: [...source.causedBy, 'urban_operations'],
        deltas: [createDelta('track', 'northernWarMachine', before, state.northernWarMachine)],
      });
    }
  }

  if (
    source.sourceType === 'card'
    && state.scenarioFlags.tortureExposed
    && !state.scenarioFlags.tribunalAcknowledged
    && state.globalGaze >= 15
    && ['crs_alg_international_press_leak', 'res_alg_negotiation_delegation', 'crs_alg_evian_talks'].includes(source.sourceId)
  ) {
    state.scenarioFlags.tribunalAcknowledged = true;
    traces.push({
      effectType: 'set_scenario_flag',
      status: 'executed',
      message: '⚖️ International scrutiny acknowledged colonial abuses.',
      causedBy: [...source.causedBy, 'tribunalAcknowledged'],
      deltas: [createDelta('track', 'scenarioFlag:tribunalAcknowledged', false, true)],
    });
  }

  processScenarioThresholdRules(state, content, source.causedBy);
}

function getSystemEscalationTriggerMessage(triggerId: SystemEscalationTriggerId) {
  switch (triggerId) {
    case 'extraction_threshold':
      return t('ui.runtime.escalationExtraction', 'Extraction has spread across the board. A structural escalation enters play.');
    case 'war_machine_threshold':
      return t('ui.runtime.escalationWarMachine', 'War Machine pressure crossed its escalation line. A structural escalation enters play.');
    case 'gaze_threshold':
      return t('ui.runtime.escalationGlobalGaze', 'Global Gaze collapsed beneath the pressure line. A structural escalation enters play.');
    case 'failed_campaigns':
      return t('ui.runtime.escalationFailedCampaigns', 'Repeated failed campaigns hardened the system. A structural escalation enters play.');
    case 'symbolic_round_six':
      return t('ui.runtime.escalationSymbolicRound', 'The symbolic window narrowed. A structural escalation enters play.');
  }
}

function getNextSystemEscalationTrigger(state: EngineState): SystemEscalationTriggerId | null {
  for (const triggerId of SYSTEM_ESCALATION_TRIGGER_PRIORITY) {
    if (state.usedSystemEscalationTriggers[triggerId]) {
      continue;
    }

    switch (triggerId) {
      case 'extraction_threshold':
        if (getTotalExtractionTokens(state) >= 8) {
          return triggerId;
        }
        break;
      case 'war_machine_threshold':
        if (state.northernWarMachine >= 6) {
          return triggerId;
        }
        break;
      case 'gaze_threshold':
        if (state.globalGaze <= 5) {
          return triggerId;
        }
        break;
      case 'failed_campaigns':
        if (state.failedCampaigns >= 2) {
          return triggerId;
        }
        break;
      case 'symbolic_round_six':
        if (state.mode === 'SYMBOLIC' && state.round >= SYMBOLIC_ESCALATION_ROUND) {
          return triggerId;
        }
        break;
    }
  }

  return null;
}

function checkExtractionLoss(state: EngineState) {
  const breachedRegion = (Object.keys(state.regions) as RegionId[]).find((regionId) => state.regions[regionId].extractionTokens >= EXTRACTION_DEFEAT_THRESHOLD);
  if (!breachedRegion) {
    return false;
  }

  state.phase = 'LOSS';
  state.lossReason = t('ui.runtime.lossExtractionBreach', '{{region}} reached {{count}} Extraction Tokens.', {
    region: getRegionLabel(breachedRegion),
    count: EXTRACTION_DEFEAT_THRESHOLD,
  });
  revealMandates(state);
  addSimpleEvent(state, 'system', 'extraction_breach', '☠️', '☠️ Extraction breach ended the struggle.', ['extraction_breach']);
  finalizeTerminalEvent(
    state,
    createTerminalOutcome(
      state,
      'defeat',
      'extraction_breach',
      t('ui.runtime.outcomeDefeat', 'Defeat'),
      state.lossReason,
      { breachedRegionId: breachedRegion },
    ),
  );
  return true;
}

function checkComradesExhaustedLoss(state: EngineState) {
  const coalitionComrades = getTotalComrades(state);
  if (coalitionComrades > 0) {
    return false;
  }

  state.phase = 'LOSS';
  state.lossReason = t('ui.runtime.lossComradesExhaustedCoalition', 'Coalition was reduced to 0 Comrades.');
  revealMandates(state);
  addSimpleEvent(state, 'system', 'comrades_exhausted', '🫂', '🫂 Coalition Comrades were exhausted.', ['comrades_exhausted']);
  finalizeTerminalEvent(
    state,
    createTerminalOutcome(
      state,
      'defeat',
      'comrades_exhausted',
      t('ui.runtime.outcomeDefeat', 'Defeat'),
      state.lossReason,
    ),
  );
  return true;
}

function ensureVictoryProgress(state: EngineState) {
  if (!state.victoryProgress) {
    state.victoryProgress = {
      extractionRemoved: 0,
      actionsById: {},
      lastResolvedActionId: null,
      victoryPredicateSatisfiedBeforeAllowedRound: false,
    };
  }
  state.victoryProgress.victoryPredicateSatisfiedBeforeAllowedRound
    = state.victoryProgress.victoryPredicateSatisfiedBeforeAllowedRound ?? false;
  return state.victoryProgress;
}

function getVictoryScoringMode(content: CompiledContent) {
  return content.ruleset.victoryScoring?.mode ?? 'binary';
}

function isScoreVictoryMode(content: CompiledContent) {
  return getVictoryScoringMode(content) === 'score';
}

function assertValidWeightTotal(components: VictoryScoreComponent[], label: string) {
  const total = components.reduce((sum, component) => sum + component.weight, 0);
  if (Math.abs(total - 100) > 1e-9) {
    throw new Error(`Invalid victoryScoring.${label}: component weights must sum to 100 (received ${total}).`);
  }
}

function validateVictoryScoringConfig(content: CompiledContent): VictoryScoringConfig | null {
  const config = content.ruleset.victoryScoring;
  if (!config || getVictoryScoringMode(content) !== 'score') {
    return null;
  }

  const threshold = config.threshold ?? 70;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error(`Invalid victoryScoring.threshold=${String(config.threshold)}. Expected 0..100.`);
  }
  if (
    config.survivalScorePerRound !== undefined
    && (!Number.isFinite(config.survivalScorePerRound) || config.survivalScorePerRound < 0 || config.survivalScorePerRound > 25)
  ) {
    throw new Error(
      `Invalid victoryScoring.survivalScorePerRound=${String(config.survivalScorePerRound)}. Expected 0..25.`,
    );
  }
  if (
    config.beaconProgressScore !== undefined
    && (!Number.isFinite(config.beaconProgressScore) || config.beaconProgressScore < 0 || config.beaconProgressScore > 100)
  ) {
    throw new Error(
      `Invalid victoryScoring.beaconProgressScore=${String(config.beaconProgressScore)}. Expected 0..100.`,
    );
  }

  const components = config.components ?? [];
  const penalties = config.penalties ?? [];
  if (penalties.length > 0) {
    assertValidWeightTotal(penalties, 'penalties');
  }

  if (config.mandatesAsScore?.enabled) {
    const weight = config.mandatesAsScore.weight;
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      throw new Error(`Invalid victoryScoring.mandatesAsScore.weight=${String(weight)}. Expected 0..100.`);
    }
  }

  for (const capRule of config.caps?.capScoreAtIf ?? []) {
    if (!Number.isFinite(capRule.maxScore) || capRule.maxScore < 0 || capRule.maxScore > 100) {
      throw new Error(`Invalid victoryScoring.caps.capScoreAtIf[${capRule.id}].maxScore=${String(capRule.maxScore)}. Expected 0..100.`);
    }
  }

  const componentWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const mandateWeight = config.mandatesAsScore?.enabled ? (config.mandatesAsScore.weight ?? 0) : 0;
  if (Math.abs(componentWeight + mandateWeight - 100) > 1e-9) {
    throw new Error(`Invalid victoryScoring weights: components + mandate bucket must sum to 100 (received ${componentWeight + mandateWeight}).`);
  }

  return config;
}

function getMinRoundBeforePublicVictory(content: CompiledContent) {
  return Math.max(1, Math.floor(content.ruleset.victoryGate?.minRoundBeforeVictory ?? 1));
}

function canResolvePublicVictory(state: EngineState, content: CompiledContent, context: VictoryCheckContext) {
  const gate = content.ruleset.victoryGate;
  if (state.round < getMinRoundBeforePublicVictory(content)) {
    return false;
  }

  const requiredActionId = gate?.requiredAction?.actionId;
  if (requiredActionId) {
    if (context.trigger !== 'action') {
      return false;
    }
    if (context.actionId !== requiredActionId) {
      return false;
    }
  }

  const requiredExtractionRemoved = gate.requiredProgress?.extractionRemoved;
  if (requiredExtractionRemoved !== undefined && ensureVictoryProgress(state).extractionRemoved < requiredExtractionRemoved) {
    return false;
  }

  return true;
}

function evaluatePublicVictoryPredicates(state: EngineState, content: CompiledContent) {
  const liberationCondition = content.ruleset.victoryConditions?.liberation;
  const symbolicCondition = content.ruleset.victoryConditions?.symbolic;
  const liberationComplete = state.mode === 'LIBERATION'
    && (
      liberationCondition
        ? evaluateCondition(state, content, liberationCondition, { causedBy: ['victory', 'liberation'] })
        : (Object.keys(state.regions) as RegionId[]).every((regionId) => state.regions[regionId].extractionTokens <= content.ruleset.liberationThreshold)
    );
  const symbolicComplete = state.mode === 'SYMBOLIC'
    && (
      symbolicCondition
        ? evaluateCondition(state, content, symbolicCondition, { causedBy: ['victory', 'symbolic'] })
        : state.activeBeaconIds.every((beaconId) => state.beacons[beaconId]?.complete)
    );

  return { liberationComplete, symbolicComplete };
}

function computeMandateCompletionRatio(state: EngineState) {
  if (!state.secretMandatesEnabled || state.players.length === 0) {
    return 1;
  }
  const satisfied = state.players.filter((player) => player.mandateSatisfied).length;
  return Math.max(0, Math.min(1, satisfied / state.players.length));
}

function computeActiveBeaconCompletionRatio(state: EngineState) {
  if (state.activeBeaconIds.length === 0) {
    return 0;
  }
  const completed = state.activeBeaconIds.filter((beaconId) => state.beacons[beaconId]?.complete).length;
  return Math.max(0, Math.min(1, completed / state.activeBeaconIds.length));
}

function evaluateComponentRatio(
  component: VictoryScoreComponent,
  state: EngineState,
  content: CompiledContent,
  context: VictoryCheckContext,
  publicVictorySatisfied: boolean,
): number {
  if (component.source.type === 'publicVictory') {
    return publicVictorySatisfied ? 1 : 0;
  }

  if (component.source.type === 'mandates') {
    const ratio = computeMandateCompletionRatio(state);
    if (component.type === 'binaryCondition') {
      return ratio >= 1 ? 1 : 0;
    }
    if (component.type === 'stepCondition') {
      const steps = (component.steps ?? [])
        .slice()
        .sort((left, right) => left.atLeast - right.atLeast);
      const completedMandates = state.players.filter((player) => player.mandateSatisfied).length;
      let stepRatio = 0;
      for (const step of steps) {
        if (completedMandates >= step.atLeast) {
          stepRatio = Math.max(stepRatio, step.ratio);
        }
      }
      return Math.max(0, Math.min(1, stepRatio));
    }
    return ratio;
  }

  if (component.type === 'ratioCondition') {
    const numeratorSatisfied = evaluateCondition(state, content, component.ratio?.numerator ?? component.source.condition, {
      actingSeat: 0,
      actionId: context.actionId as ActionId | undefined,
      causedBy: [component.id, 'score_ratio'],
    } as ResolveContext);
    const denominatorSatisfied = evaluateCondition(state, content, component.ratio?.denominator ?? component.source.condition, {
      actingSeat: 0,
      actionId: context.actionId as ActionId | undefined,
      causedBy: [component.id, 'score_ratio'],
    } as ResolveContext);
    if (!denominatorSatisfied) {
      return 0;
    }
    return numeratorSatisfied ? 1 : 0;
  }

  if (component.type === 'stepCondition') {
    const steps = (component.steps ?? [])
      .slice()
      .sort((left, right) => left.atLeast - right.atLeast);
    // Step conditions for Condition sources evaluate as 0/1 progress until richer progress semantics exist.
    const satisfied = evaluateCondition(state, content, component.source.condition, {
      actingSeat: 0,
      actionId: context.actionId as ActionId | undefined,
      causedBy: [component.id, 'score_step'],
    } as ResolveContext);
    const progress = satisfied ? 1 : 0;
    let stepRatio = 0;
    for (const step of steps) {
      if (progress >= step.atLeast) {
        stepRatio = Math.max(stepRatio, step.ratio);
      }
    }
    return Math.max(0, Math.min(1, stepRatio));
  }

  return evaluateCondition(state, content, component.source.condition, {
    actingSeat: 0,
    actionId: context.actionId as ActionId | undefined,
    causedBy: [component.id, 'score_binary'],
  } as ResolveContext)
    ? 1
    : 0;
}

function resolveScoreBandId(config: VictoryScoringConfig, score: number) {
  for (const band of config.outcomeBands ?? []) {
    const max = band.max ?? Infinity;
    if (score >= band.min && score <= max) {
      return band.id;
    }
  }
  return undefined;
}

function computeVictoryScore(
  state: EngineState,
  content: CompiledContent,
  context: VictoryCheckContext,
  publicVictorySatisfied: boolean,
) {
  const config = validateVictoryScoringConfig(content);
  if (!config) {
    return null;
  }

  const threshold = config.threshold ?? 70;
  const breakdown: Record<string, number> = {};
  let score = 0;

  console.log('🧮 Scoring victory');

  for (const component of config.components ?? []) {
    const ratio = evaluateComponentRatio(component, state, content, context, publicVictorySatisfied);
    const points = Math.max(0, Math.min(component.weight, component.weight * ratio));
    breakdown[component.id] = Number(points.toFixed(6));
    score += points;
  }

  if (config.mandatesAsScore?.enabled) {
    const progressMode = config.mandatesAsScore.mandateProgressMode ?? 'binary';
    if (progressMode === 'progress') {
      console.log('⚠️ mandateProgressMode=progress has no native mandate progress signal yet. Falling back to binary mandate completion.');
    }
    const ratio = computeMandateCompletionRatio(state);
    const points = config.mandatesAsScore.weight * ratio;
    breakdown.mandates_bucket = Number(points.toFixed(6));
    score += points;
  }

  // Survivability should matter: sustained resistance contributes incremental score over time.
  if (config.survivalScorePerRound && config.survivalScorePerRound > 0) {
    const survivalPoints = Math.max(0, Math.min(100, state.round * config.survivalScorePerRound));
    breakdown.survival_rounds = Number(survivalPoints.toFixed(6));
    score += survivalPoints;
    console.log(`⏳ Survival score applied: round=${state.round} perRound=${config.survivalScorePerRound.toFixed(2)} points=${survivalPoints.toFixed(2)}`);
  }

  if (config.beaconProgressScore && config.beaconProgressScore > 0) {
    const beaconCompletionRatio = computeActiveBeaconCompletionRatio(state);
    const beaconPoints = Math.max(0, Math.min(config.beaconProgressScore, config.beaconProgressScore * beaconCompletionRatio));
    breakdown.beacon_progress = Number(beaconPoints.toFixed(6));
    score += beaconPoints;
    console.log(`🕯️ Beacon progress score applied: ratio=${beaconCompletionRatio.toFixed(2)} points=${beaconPoints.toFixed(2)}`);
  }

  for (const penalty of config.penalties ?? []) {
    const ratio = evaluateComponentRatio(penalty, state, content, context, publicVictorySatisfied);
    const deduction = Math.max(0, Math.min(penalty.weight, penalty.weight * ratio));
    breakdown[`penalty:${penalty.id}`] = Number((-deduction).toFixed(6));
    score -= deduction;
  }

  let capApplied: { capId: string; maxScore: number } | null = null;
  for (const capRule of config.caps?.capScoreAtIf ?? []) {
    const active = evaluateCondition(state, content, capRule.condition, {
      actingSeat: 0,
      actionId: context.actionId as ActionId | undefined,
      causedBy: [capRule.id, 'score_cap'],
    } as ResolveContext);
    if (!active) {
      continue;
    }
    if (score > capRule.maxScore) {
      score = capRule.maxScore;
      capApplied = { capId: capRule.id, maxScore: capRule.maxScore };
    }
  }

  score = Math.max(0, Math.min(100, score));
  const roundedScore = Number(score.toFixed(6));
  const success = roundedScore >= threshold;
  const scoreBandId = resolveScoreBandId(config, roundedScore);

  console.log(`📊 VictoryScore=${roundedScore.toFixed(2)} threshold=${threshold.toFixed(2)}`);
  if (success) {
    console.log('🏁 Success by score');
  }

  return {
    score: roundedScore,
    threshold,
    success,
    breakdown,
    capApplied,
    scoreBandId,
  };
}

function checkPositiveVictory(state: EngineState, content: CompiledContent, context: VictoryCheckContext): boolean {
  const { liberationComplete, symbolicComplete } = evaluatePublicVictoryPredicates(state, content);

  if (!liberationComplete && !symbolicComplete) {
    return false;
  }

  if (!canResolvePublicVictory(state, content, context)) {
    if (state.round < getMinRoundBeforePublicVictory(content)) {
      ensureVictoryProgress(state).victoryPredicateSatisfiedBeforeAllowedRound = true;
    }
    return false;
  }

  if (isScoreVictoryMode(content)) {
    const scoreEvaluation = computeVictoryScore(state, content, context, liberationComplete || symbolicComplete);
    if (!scoreEvaluation || !scoreEvaluation.success) {
      if (scoreEvaluation) {
        const progress = ensureVictoryProgress(state);
        progress.lastVictoryScore = scoreEvaluation.score;
        progress.lastVictoryThreshold = scoreEvaluation.threshold;
        progress.lastScoreBreakdown = scoreEvaluation.breakdown;
        progress.lastScoreBandId = scoreEvaluation.scoreBandId;
      }
      return false;
    }

    const cause: TerminalOutcomeCause = liberationComplete ? 'liberation' : 'symbolic';
    state.phase = 'WIN';
    state.winner = liberationComplete
      ? t('ui.runtime.winnerLiberation', 'Liberation achieved.')
      : t('ui.runtime.winnerSymbolic', 'Symbolic beacons aligned.');
    addSimpleEvent(
      state,
      'beacon',
      'victory',
      '✨',
      liberationComplete ? '✨ Liberation score threshold secured.' : '✨ Symbolic score threshold secured.',
      ['victory', 'score_mode'],
    );
    const progress = ensureVictoryProgress(state);
    progress.lastVictoryScore = scoreEvaluation.score;
    progress.lastVictoryThreshold = scoreEvaluation.threshold;
    progress.lastScoreBreakdown = scoreEvaluation.breakdown;
    progress.lastScoreBandId = scoreEvaluation.scoreBandId;
    finalizeTerminalEvent(
      state,
      createTerminalOutcome(
        state,
        'victory',
        cause,
        t('ui.runtime.outcomeVictory', 'Victory'),
        state.winner,
        {
          victoryScore: scoreEvaluation.score,
          victoryThreshold: scoreEvaluation.threshold,
          scoreBandId: scoreEvaluation.scoreBandId,
          scoreBreakdown: scoreEvaluation.breakdown,
        },
      ),
    );
    return true;
  }

  if (!state.secretMandatesEnabled) {
    const cause: TerminalOutcomeCause = liberationComplete ? 'liberation' : 'symbolic';
    state.phase = 'WIN';
    state.winner = liberationComplete
      ? t('ui.runtime.winnerLiberation', 'Liberation achieved.')
      : t('ui.runtime.winnerSymbolic', 'Symbolic beacons aligned.');
    addSimpleEvent(
      state,
      'beacon',
      'victory',
      '🕯️',
      state.winner,
      ['victory'],
    );
    finalizeTerminalEvent(
      state,
      createTerminalOutcome(
        state,
        'victory',
        cause,
        t('ui.runtime.outcomeVictory', 'Victory'),
        state.winner,
      ),
    );
    return true;
  }

  const failedMandates = state.players.filter((player) => !player.mandateSatisfied);

  revealMandates(state);
  if (failedMandates.length > 0) {
    state.phase = 'LOSS';
    state.lossReason = t('ui.runtime.lossMandateFailure', 'Public victory was reached, but {{count}} Secret Mandate(s) failed.', {
      count: failedMandates.length,
    });
    addSimpleEvent(state, 'mandate', 'mandate_failure', '🕳️', '🕳️ Secret Mandates fractured the coalition.', ['mandate_failure']);
    finalizeTerminalEvent(
      state,
      createTerminalOutcome(
        state,
        'defeat',
        'mandate_failure',
        t('ui.runtime.outcomeDefeat', 'Defeat'),
        state.lossReason,
        {
          failedMandateSeatIds: failedMandates.map((player) => player.seat),
          failedMandateIds: failedMandates.map((player) => getFaction(content, player).mandate.id),
        },
      ),
    );
    return true;
  }

  state.phase = 'WIN';
  state.winner = liberationComplete
    ? t('ui.runtime.winnerLiberation', 'Liberation achieved.')
    : t('ui.runtime.winnerSymbolic', 'Symbolic beacons aligned.');
  addSimpleEvent(
    state,
    'beacon',
    'victory',
    '✨',
    liberationComplete ? '✨ Liberation victory secured.' : '✨ Symbolic victory secured.',
    ['victory'],
  );
  finalizeTerminalEvent(
    state,
    createTerminalOutcome(
      state,
      'victory',
      liberationComplete ? 'liberation' : 'symbolic',
      t('ui.runtime.outcomeVictory', 'Victory'),
      state.winner,
    ),
  );
  return true;
}

function resolveCardDraws(
  state: EngineState,
  seat: number,
  count: number,
  origin: CardRevealEvent['origin'] = 'other',
): EffectTrace {
  let cardsDrawn = 0;
  for (let index = 0; index < count; index += 1) {
    const cardId = drawCard(state, 'resistance');
    if (!cardId) {
      continue;
    }

    cardsDrawn += 1;
    moveCardToDiscard(state, 'resistance', cardId);
    addCardRevealEvent(
      state,
      {
        deckId: 'resistance',
        cardId,
        destination: 'discard',
        seat,
        public: true,
        origin,
      },
      'card',
      'draw_resistance',
      t('ui.runtime.revealResistanceCard', '🃏 Seat {{seat}} revealed a resistance card.', {
        seat: seat + 1,
      }),
      ['draw_resistance'],
    );
  }

  return {
    effectType: 'draw_resistance',
    status: 'executed',
    message: t('ui.runtime.drawResistanceSummary', 'Seat {{seat}} revealed {{count}} resistance card(s) and moved them to discard.', {
      seat: seat + 1,
      count: cardsDrawn,
    }),
    causedBy: [`seat:${seat}`],
    deltas: cardsDrawn > 0
      ? [createDelta('card', `resistance:discard`, state.decks.resistance.discardPile.length - cardsDrawn, state.decks.resistance.discardPile.length)]
      : [],
  };
}

function resolveStartupWithdrawal(
  state: EngineState,
  content: CompiledContent,
  seat: number,
): void {
  const cardId = drawCard(state, 'resistance');
  if (!cardId) {
    return;
  }

  const card = assertExists(content.cards[cardId], `Missing card ${cardId}.`);
  if (card.deck !== 'resistance') {
    throw new Error(`Card ${cardId} is not a resistance card.`);
  }

  const targetRegionId = getFaction(content, state.players[seat]).homeRegion;
  const discardBefore = state.decks.resistance.discardPile.length;
  const traces = (card.effects?.length ?? 0) > 0
    ? applyEffects(
      state,
      content,
      card.effects ?? [],
      {
        sourceType: 'card',
        sourceId: card.id,
        emoji: '🃏',
        message: `${card.name} shaped the opening position.`,
        causedBy: ['startup_withdrawal', card.id],
        context: {
          actingSeat: seat,
          targetRegionId,
          causedBy: ['startup_withdrawal', card.id],
        },
        suppressScenarioHooks: true,
      },
    )
    : [];

  moveCardToDiscard(state, 'resistance', cardId);
  traces.push({
    effectType: 'draw_resistance',
    status: 'executed',
    message: t('ui.runtime.startupWithdrawalSummary', 'Seat {{seat}} withdrew a startup resistance card.', {
      seat: seat + 1,
    }),
    causedBy: ['startup_withdrawal', card.id],
    deltas: [createDelta('card', 'resistance:discard', discardBefore, state.decks.resistance.discardPile.length)],
  });

  addEvent(
    state,
    'card',
    card.id,
    '🃏',
    `${card.name}: ${card.text}`,
    ['StartGame', 'startup_withdrawal', card.id],
    traces,
    {
      actingSeat: seat,
      targetRegionId,
      sourceDeckId: 'resistance',
      cardReveals: [{
        deckId: 'resistance',
        cardId,
        destination: 'discard',
        seat,
        public: true,
        origin: 'startup_withdrawal',
      }],
      causedBy: ['startup_withdrawal', card.id],
    },
  );
}

function resolveStartupWithdrawals(state: EngineState, content: CompiledContent) {
  for (const player of state.players) {
    resolveStartupWithdrawal(state, content, player.seat);
  }
}

function getOutreachCost(state: EngineState, content: CompiledContent, seat: number) {
  const faction = getFaction(content, state.players[seat]);
  const pressure = getSystemPersistentModifiers(state, content);
  return Math.max(0, 2 + faction.outreachPenalty + pressure.outreachCostDelta);
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
        trace.message = t('ui.runtime.traceGlobalGaze', 'Global Gaze {{before}} -> {{after}}.', {
          before,
          after: state.globalGaze,
        });
        trace.deltas.push(createDelta('track', 'globalGaze', before, state.globalGaze));
        break;
      }
      case 'modify_war_machine': {
        const before = state.northernWarMachine;
        state.northernWarMachine = clamp(
          state.northernWarMachine + effect.delta,
          effect.clamp ?? { min: 0, max: 12 },
        );
        trace.message = t('ui.runtime.traceWarMachine', 'War Machine {{before}} -> {{after}}.', {
          before,
          after: state.northernWarMachine,
        });
        trace.deltas.push(createDelta('track', 'northernWarMachine', before, state.northernWarMachine));
        break;
      }
      case 'modify_domain': {
        const domainId = effect.domain === 'target_domain' ? source.context.targetDomainId : effect.domain;
        if (!domainId) {
          trace.status = 'skipped';
          trace.message = t('ui.runtime.traceNoDomain', 'No Domain was selected for this effect.');
          break;
        }
        const before = state.domains[domainId].progress;
        state.domains[domainId].progress = clamp(state.domains[domainId].progress + effect.delta, effect.clamp ?? { min: 0, max: 12 });
        trace.message = t('ui.runtime.traceDomain', '{{domain}} {{before}} -> {{after}}.', {
          domain: localizeDomainField(domainId, 'name', content.domains[domainId].name),
          before,
          after: state.domains[domainId].progress,
        });
        trace.deltas.push(createDelta('domain', domainId, before, state.domains[domainId].progress));
        break;
      }
      case 'modify_custom_track': {
        const track = getCustomTrackState(state, effect.trackId);
        if (!track) {
          trace.status = 'skipped';
          trace.message = `Missing custom track ${effect.trackId}.`;
          break;
        }
        const before = track.value;
        track.value = clamp(track.value + effect.delta, effect.clamp ?? { min: track.min, max: track.max });
        trace.message = `${effect.trackId} ${before} -> ${track.value}.`;
        trace.deltas.push(createDelta('track', effect.trackId, before, track.value));
        break;
      }
      case 'add_extraction':
      case 'remove_extraction': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        if (regionIds.length === 0) {
          trace.status = 'skipped';
          trace.message = t('ui.runtime.traceNoRegion', 'No region was selected for this effect.');
          break;
        }
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const beforeExtraction = region.extractionTokens;
          const beforeDefense = region.defenseRating;
          let pending = effect.amount + (effect.type === 'add_extraction' ? source.crisisExtractionBonus ?? 0 : 0);

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
            if (effect.type === 'remove_extraction' && region.extractionTokens < beforeExtraction) {
              const progress = ensureVictoryProgress(state);
              progress.extractionRemoved += beforeExtraction - region.extractionTokens;
            }
          }
        }
        state.extractionPool = calculateExtractionPool(state, content);
        break;
      }
      case 'add_comrades':
      case 'remove_comrades': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        const seat = resolveSeatSelector(effect.seat, source.context);
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const before = region.comradesPresent[seat] ?? 0;
          region.comradesPresent[seat] = effect.type === 'add_comrades'
            ? before + effect.amount
            : Math.max(0, before - effect.amount);
          trace.deltas.push(createDelta('comrades', `${regionId}.seat:${seat}`, before, region.comradesPresent[seat]));
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
        trace.message = t('ui.runtime.traceDrawHandled', 'Card draw was resolved by its dedicated trace.');
        break;
      }
      case 'modify_hijab': {
        const regionIds = resolveRegionSelector(state, content, effect.region, source.context);
        for (const regionId of regionIds) {
          const region = state.regions[regionId];
          const before = region.hijabEnforcement;
          region.hijabEnforcement = clamp(region.hijabEnforcement + effect.delta, { min: 0, max: 2 });
          trace.deltas.push(createDelta('hijab', `${regionId}.hijab`, before, region.hijabEnforcement));
        }
        break;
      }
      case 'set_scenario_flag': {
        const before = state.scenarioFlags[effect.flag] ?? false;
        state.scenarioFlags[effect.flag] = effect.value;
        trace.deltas.push(createDelta('track', `scenarioFlag:${effect.flag}`, before, effect.value));
        break;
      }
      case 'open_replanning': {
        // This is a UI-level signal, but we can log it here.
        addSimpleEvent(state, 'system', 'replanning', '📡', 'Digital coordination has opened the coalition planning window.', source.causedBy);
        break;
      }
      case 'log':
        trace.message = effect.message;
        break;
    }

    traces.push(trace);
  }

  // MARTYRDOM LOGIC (Tahrir Square)
  if (state.rulesetId === 'tahrir_square' && source.context.actingSeat !== undefined) {
    const comradesDelta = traces.filter(t => t.effectType === 'remove_comrades').reduce((sum, t) => {
      const d = t.deltas.find(d => d.kind === 'comrades' && d.label.includes('Cairo'));
      if (d && typeof d.before === 'number' && typeof d.after === 'number') {
        return sum + (d.before - d.after);
      }
      return sum;
    }, 0);
    if (comradesDelta > 0) {
      state.tahrirMartyrCount += comradesDelta;
      const waveGain = Math.floor(state.tahrirMartyrCount / 4);
      if (waveGain > 0) {
        state.tahrirMartyrCount %= 4;
        state.domains['RevolutionaryWave'].progress = clamp(state.domains['RevolutionaryWave'].progress + waveGain, { max: 12 });
        addSimpleEvent(state, 'system', 'martyrdom', '🕯️', `Martyrdom in the Square has strengthened the Revolutionary Wave.`, ['martyrdom']);
      }
    }
  }

  applyScenarioPostEffects(state, content, traces, source);

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
    .map((player) => ({ seat: player.seat, comrades: region.comradesPresent[player.seat] ?? 0 }))
    .sort((left, right) => right.comrades - left.comrades);
  const targetSeat = seatPresence[0]?.comrades ? seatPresence[0].seat : null;

  if (targetSeat !== null) {
    const before = region.comradesPresent[targetSeat];
    region.comradesPresent[targetSeat] = Math.max(0, before - 2);
    addEvent(state, 'system', 'military_intervention', '⚔️', `Military intervention hit ${targetRegionId}.`, ['intervention'], [
      {
        effectType: 'system_phase',
        status: 'executed',
        message: t('ui.runtime.traceComrades', 'Comrades {{before}} -> {{after}}.', {
          before,
          after: region.comradesPresent[targetSeat],
        }),
        causedBy: ['intervention'],
        deltas: [createDelta('comrades', `${targetRegionId}.seat:${targetSeat}`, before, region.comradesPresent[targetSeat])],
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

function resolveCrisisCard(state: EngineState, content: CompiledContent, cardId: string) {
  const card = assertExists(content.cards[cardId], `Missing card ${cardId}.`);
  if (card.deck !== 'crisis') {
    throw new Error(`Card ${cardId} is not a crisis card.`);
  }

  const pressure = getSystemPersistentModifiers(state, content);
  const traces = applyEffects(
    state,
    content,
    card.effects,
    {
      sourceType: 'card',
      sourceId: card.id,
      emoji: '🃏',
      message: card.name,
      causedBy: [card.id],
      context: { causedBy: [card.id] },
      crisisExtractionBonus: pressure.crisisExtractionBonus,
    },
  );
  moveCardToDiscard(state, 'crisis', cardId);
  addEvent(state, 'card', card.id, '🃏', `${card.name}: ${card.text}`, [card.id], traces, {
    sourceDeckId: 'crisis',
    cardReveals: [{ deckId: 'crisis', cardId, destination: 'discard', public: true, origin: 'system_phase' }],
  });
}

function resolveSystemCard(state: EngineState, content: CompiledContent, cardId: string) {
  const card = assertExists(content.cards[cardId], `Missing card ${cardId}.`);
  if (card.deck !== 'system') {
    throw new Error(`Card ${cardId} is not a system card.`);
  }
  const activeBefore = state.activeSystemCardIds.length;
  const traces = applyEffects(
    state,
    content,
    card.onReveal,
    {
      sourceType: 'card',
      sourceId: card.id,
      emoji: '🂠',
      message: card.name,
      causedBy: [card.id],
      context: { causedBy: [card.id] },
    },
  );
  state.activeSystemCardIds.push(cardId);
  traces.push({
    effectType: 'system_phase',
    status: 'executed',
    message: `Active escalations ${activeBefore} -> ${state.activeSystemCardIds.length}.`,
    causedBy: [card.id],
    deltas: [createDelta('card', 'system:active', activeBefore, state.activeSystemCardIds.length)],
  });
  addEvent(state, 'card', card.id, '🂠', `${card.name}: ${card.text}`, [card.id], traces, {
    sourceDeckId: 'system',
    cardReveals: [{ deckId: 'system', cardId, destination: 'active', public: true, origin: 'system_phase' }],
  });
}

function resolveSystemEscalation(state: EngineState, content: CompiledContent) {
  const triggerId = getNextSystemEscalationTrigger(state);
  if (!triggerId) {
    return;
  }

  state.usedSystemEscalationTriggers[triggerId] = true;
  addSimpleEvent(state, 'system', triggerId, '🚩', getSystemEscalationTriggerMessage(triggerId), [triggerId]);
  const cardId = drawCard(state, 'system');
  if (!cardId) {
    addSimpleEvent(state, 'system', 'system_deck_empty', '🪵', 'The System deck is exhausted.', [triggerId, 'system_deck_empty']);
    return;
  }

  state.lastSystemCardIds.push(cardId);
  resolveSystemCard(state, content, cardId);
}

function createInitialPlayers(command: StartGameCommand, content: CompiledContent): PlayerState[] {
  const { seatFactionIds, seatOwnerIds } = normalizeStartGameCommand(command);
  const secretMandatesEnabled = areSecretMandatesEnabled(command);

  return seatFactionIds.map((factionId, seat) => ({
    seat,
    ownerId: seatOwnerIds[seat] ?? seat,
    factionId,
    evidence: 1,
    actionsRemaining: ACTIONS_PER_TURN,
    ready: false,
    queuedIntents: [],
    resistanceHand: [],
    mandateId: secretMandatesEnabled ? content.factions[factionId].mandate.id : '',
    mandateRevealed: !secretMandatesEnabled,
    mandateSatisfied: false,
  }));
}

function createInitialState(command: StartGameCommand, content: CompiledContent): EngineState {
  let rng = createRng(command.seed);
  const players = createInitialPlayers(command, content);
  const setup = getRulesetSetup(content);
  const secretMandatesEnabled = areSecretMandatesEnabled(command);

  const decks = {
    system: { drawPile: [] as string[], discardPile: [] as string[] },
    resistance: { drawPile: [] as string[], discardPile: [] as string[] },
    crisis: { drawPile: [] as string[], discardPile: [] as string[] },
  };

  for (const deckId of ['system', 'resistance', 'crisis'] as const) {
    const [nextRng, shuffled] = shuffle(rng, content.decks[deckId]);
    rng = nextRng;
    decks[deckId].drawPile = shuffled;
  }

  const regions = Object.fromEntries(
    (Object.keys(content.regions) as RegionId[]).map((regionId) => [
      regionId,
      {
        id: regionId,
        extractionTokens: 0,
        vulnerability: content.regions[regionId]?.vulnerability ?? {
          WarMachine: 0, DyingPlanet: 0, GildedCage: 0, SilencedTruth: 0, EmptyStomach: 0, FossilGrip: 0, StolenVoice: 0,
          RevolutionaryWave: 0, PatriarchalGrip: 0, UnfinishedJustice: 0
        },
        defenseRating: 0,
        comradesPresent: Object.fromEntries(players.map((player) => [player.seat, 0])),
        hijabEnforcement: 0,
      },
    ]),
  ) as EngineState['regions'];

  for (const [regionId, extractionTokens] of Object.entries(setup?.extractionSeeds ?? {})) {
    if (regions[regionId as RegionId]) {
      regions[regionId as RegionId].extractionTokens = extractionTokens ?? 0;
    }
  }
  for (const [regionId, enforcement] of Object.entries(setup?.regionHijabEnforcement ?? {})) {
    if (regions[regionId as RegionId]) {
      regions[regionId as RegionId].hijabEnforcement = enforcement ?? 0;
    }
  }

  for (const player of players) {
    const faction = content.factions[player.factionId];
    regions[faction.homeRegion].comradesPresent[player.seat] = 4;
  }

  const beacons = Object.fromEntries(
    Object.keys(content.beacons).map((beaconId) => [
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
    const [nextRng, shuffledBeacons] = shuffle(rng, Object.keys(content.beacons));
    rng = nextRng;
    for (let index = 0; index < 3; index += 1) {
      const beaconId = shuffledBeacons[index] ?? null;
      if (beaconId) {
        activeBeaconIds.push(beaconId);
        beacons[beaconId].active = true;
      }
    }
  }

  const state: EngineState = {
    version: 'design-cutover-2',
    seed: command.seed,
    rng,
    rulesetId: command.rulesetId,
    mode: command.mode,
    secretMandatesEnabled,
    round: 1,
    phase: 'SYSTEM',
    extractionPool: 0,
    globalGaze: setup?.globalGaze ?? 5,
    northernWarMachine: setup?.northernWarMachine ?? 7,
    customTracks: Object.fromEntries(
      (content.ruleset.customTracks ?? []).map((track) => [
        track.id,
        {
          id: track.id,
          value: track.initialValue,
          min: track.min,
          max: track.max,
          thresholds: track.thresholds,
        },
      ]),
    ),
    domains: Object.fromEntries(
      Object.values(content.domains).map((domain) => [domain.id, { id: domain.id, progress: domain.initialProgress }]),
    ) as EngineState['domains'],
    regions,
    players,
    decks,
    beacons,
    activeBeaconIds,
    activeSystemCardIds: [],
    usedSystemEscalationTriggers: createDefaultEscalationTriggers(),
    failedCampaigns: 0,
    lastSystemCardIds: [],
    publicAttentionEvents: [],
    commandLog: [cloneState(command)],
    eventLog: [],
    winner: null,
    lossReason: null,
    terminalOutcome: null,
    mandatesResolved: !secretMandatesEnabled,
    tahrirEmptyRounds: 0,
    tahrirMartyrCount: 0,
    scenarioFlags: Object.fromEntries((content.ruleset.scenarioFlags ?? []).map((flag) => [flag, false])),
    triggeredScenarioThresholds: {},
    victoryProgress: {
      extractionRemoved: 0,
      actionsById: {},
      lastResolvedActionId: null,
      victoryPredicateSatisfiedBeforeAllowedRound: false,
    },
  };

  resolveStartupWithdrawals(state, content);

  for (const beaconId of activeBeaconIds) {
    addSimpleEvent(
      state,
      'beacon',
      beaconId,
      '🕯️',
      `${content.beacons[beaconId]?.title ?? beaconId} was activated as a symbolic objective.`,
      ['StartGame', beaconId],
    );
  }

  state.extractionPool = calculateExtractionPool(state, content);
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
): DisabledReasonDetail | undefined {
  const player = state.players[seat];
  const action = getBaseActionDefinition(content, intent.actionId);
  if (!player) {
    return { code: 'unknown_seat' };
  }
  if (state.phase !== 'COALITION') {
    return { code: 'phase_locked' };
  }
  if (!options?.resolvingQueued && player.ready) {
    return { code: 'seat_already_ready' };
  }
  if (!options?.resolvingQueued && player.actionsRemaining <= 0) {
    return { code: 'no_actions_remaining' };
  }
  if (action.needsRegion && !intent.regionId) {
    return { code: 'select_region' };
  }
  if (action.needsDomain && !intent.domainId) {
    return { code: 'select_domain' };
  }
  if (action.needsTargetSeat && (intent.targetSeat === undefined || intent.targetSeat === seat)) {
    return { code: 'select_another_seat' };
  }
  if (action.id === 'build_solidarity') {
    if ((state.regions[intent.regionId!].comradesPresent[seat] ?? 0) < 3) {
      return { code: 'need_three_comrades' };
    }
  }
  if (action.id === 'international_outreach') {
    const cost = getOutreachCost(state, content, seat);
    if (player.evidence < cost) {
      return { code: 'not_enough_evidence', values: { count: cost } };
    }
  }
  if (action.id === 'smuggle_evidence') {
    if (player.evidence <= 0) {
      return { code: 'no_evidence_to_move' };
    }
    if ((state.regions[intent.regionId!].comradesPresent[seat] ?? 0) < 1) {
      return { code: 'need_one_body' };
    }
  }
  if (action.id === 'defend') {
    if (!intent.comradesCommitted || intent.comradesCommitted < 1) {
      return { code: 'commit_one_body' };
    }
    if ((state.regions[intent.regionId!].comradesPresent[seat] ?? 0) < intent.comradesCommitted) {
      return { code: 'not_enough_comrades' };
    }
  }
  if (action.id === 'launch_campaign') {
    if (!intent.comradesCommitted || intent.comradesCommitted < 1) {
      return { code: 'commit_one_body' };
    }
    if ((state.regions[intent.regionId!].comradesPresent[seat] ?? 0) < intent.comradesCommitted) {
      return { code: 'not_enough_comrades' };
    }
    if ((intent.evidenceCommitted ?? 0) > player.evidence) {
      return { code: 'not_enough_evidence', values: { count: intent.evidenceCommitted ?? 0 } };
    }
    if (intent.cardId) {
      const card = content.cards[intent.cardId];
      if (!card || card.deck !== 'resistance' || card.type !== 'support' || !player.resistanceHand.includes(intent.cardId)) {
        return { code: 'support_card_unavailable' };
      }
    }
  }
  if (action.id === 'play_card') {
    if (!intent.cardId) {
      return { code: 'select_card' };
    }
    const card = content.cards[intent.cardId];
    if (!card || card.deck !== 'resistance' || card.type !== 'action' || !player.resistanceHand.includes(intent.cardId)) {
      return { code: 'action_card_unavailable' };
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
  const detail = getDisabledReasonForIntent(state, content, seat, action);
  return {
    actionId: action.actionId,
    disabled: Boolean(detail),
    reasonCode: detail?.code,
    reasonValues: detail?.values,
    reason: detail ? toLegacyDisabledReason(detail) : undefined,
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
  let comrades = roll + (region.extractionTokens >= 4 ? 2 : 0);
  if (regionId === faction.homeRegion) {
    comrades += faction.organizeBonus;
  } else if (faction.id === 'levant_sumud') {
    comrades = Math.max(1, comrades - 1);
  }

  return applyEffects(
    state,
    content,
    [{ type: 'add_comrades', region: regionId, seat, amount: comrades }],
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
  const pressure = getSystemPersistentModifiers(state, content);
  traces.push(resolveCardDraws(state, seat, Math.max(0, 1 + pressure.resistanceDrawDelta), 'investigate'));
  return traces;
}

function resolveBuildSolidarity(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent): EffectTrace[] {
  const regionId = assertExists(intent.regionId, 'Build Solidarity requires region.');
  const domainId = assertExists(intent.domainId, 'Build Solidarity requires domain.');
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_comrades', region: regionId, seat, amount: 3 },
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
  const regionId = assertExists(intent.regionId, 'Smuggle Evidence requires region.');
  const targetSeat = assertExists(intent.targetSeat, 'Smuggle Evidence requires target seat.');
  const faction = getFaction(content, state.players[seat]);
  const transferAmount = faction.id === 'amazon_guardians' ? 1 : Math.min(2, state.players[seat].evidence);
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_comrades', region: regionId, seat, amount: 1 },
      { type: 'lose_evidence', seat, amount: transferAmount },
      { type: 'gain_evidence', seat: targetSeat, amount: transferAmount },
    ],
    {
      sourceType: 'action',
      sourceId: 'smuggle_evidence',
      emoji: '📨',
      message: `Seat ${seat + 1} smuggled Evidence to seat ${targetSeat + 1}.`,
      causedBy: ['smuggle_evidence'],
      context: { actingSeat: seat, targetRegionId: regionId, causedBy: ['smuggle_evidence'] },
    },
  );
}

function resolveInternationalOutreach(state: EngineState, content: CompiledContent, seat: number): EffectTrace[] {
  const cost = getOutreachCost(state, content, seat);
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
  const comrades = assertExists(intent.comradesCommitted, 'Defend requires committed comrades.');
  const faction = getFaction(content, state.players[seat]);
  const defenseAmount = comrades + (regionId === faction.homeRegion ? faction.defenseBonus : 0) - (faction.id === 'mekong_echo_network' && regionId !== 'Mekong' ? 1 : 0);
  return applyEffects(
    state,
    content,
    [
      { type: 'remove_comrades', region: regionId, seat, amount: comrades },
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
  addCardRevealEvent(
    state,
    {
      deckId: 'resistance',
      cardId,
      destination: 'discard',
      seat,
      public: true,
      origin: 'played_action_card',
    },
    'card',
    card.id,
    `${card.name} was played.`,
    ['play_card', card.id],
  );
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

function resolveLaunchCampaign(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  intent: QueuedIntent,
): { traces: EffectTrace[]; roll: RollResolution; modifiers: CampaignModifierEntry[] } {
  const regionId = assertExists(intent.regionId, 'Launch Campaign requires region.');
  const domainId = assertExists(intent.domainId, 'Launch Campaign requires domain.');
  const committedComrades = assertExists(intent.comradesCommitted, 'Launch Campaign requires comrades.');
  const committedEvidence = intent.evidenceCommitted ?? 0;
  const player = state.players[seat];
  const faction = getFaction(content, player);
  const support = getCampaignSupportBonus(state, content, seat, intent);
  const pressure = getSystemPersistentModifiers(state, content);
  const campaignModifiers: CampaignModifierEntry[] = [];

  const spendTrace = applyEffects(
    state,
    content,
    [
      { type: 'remove_comrades', region: regionId, seat, amount: committedComrades },
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
  let modifier = 0;

  const comradesModifier = Math.floor(committedComrades / 2);
  if (comradesModifier !== 0) {
    campaignModifiers.push({ source: 'committed_comrades', value: comradesModifier });
    modifier += comradesModifier;
  }

  if (committedEvidence !== 0) {
    campaignModifiers.push({ source: 'committed_evidence', value: committedEvidence });
    modifier += committedEvidence;
  }

  const gazeModifier = Math.floor(state.globalGaze / 5);
  if (gazeModifier !== 0) {
    campaignModifiers.push({ source: 'global_gaze', value: gazeModifier });
    modifier += gazeModifier;
  }

  const warMachineModifier = -Math.floor(state.northernWarMachine / 4);
  if (warMachineModifier !== 0) {
    campaignModifiers.push({ source: 'war_machine', value: warMachineModifier });
    modifier += warMachineModifier;
  }

  if (regionId === faction.homeRegion) {
    campaignModifiers.push({ source: 'home_region', value: faction.campaignBonus });
    modifier += faction.campaignBonus;
  }
  if (faction.campaignDomainBonus === domainId) {
    campaignModifiers.push({ source: 'faction_domain', value: 1 });
    modifier += 1;
  }
  if (support.bonus !== 0) {
    campaignModifiers.push({ source: 'support', value: support.bonus });
    modifier += support.bonus;
  }
  if (pressure.campaignModifierDelta !== 0) {
    campaignModifiers.push({ source: 'system_pressure', value: pressure.campaignModifierDelta });
    modifier += pressure.campaignModifierDelta;
  }

  const total = dieOne + dieTwo + modifier;
  const successTarget = BASE_CAMPAIGN_TARGET + pressure.campaignTargetDelta;
  const success = total >= successTarget;
  const extractionRemoved = success ? (total >= 11 ? 2 : 1) : 0;
  const domainDelta = success ? 1 : 0;
  const globalGazeDelta = success ? 0 : total <= 5 ? 0 : 1;
  const warMachineDelta = success ? (domainId === 'WarMachine' && total >= 10 ? -1 : 0) : total <= 5 ? 1 : 0;
  const roll: RollResolution = {
    actionId: 'launch_campaign',
    seat,
    regionId,
    domainId,
    dice: [dieOne, dieTwo],
    modifier,
    total,
    target: successTarget,
    success,
    outcomeBand: success ? (total >= 11 ? 'surge' : 'success') : (total <= 5 ? 'backlash' : 'attention'),
    extractionRemoved,
    domainDelta,
    globalGazeDelta,
    warMachineDelta,
  };
  const traces = [...spendTrace];

  traces.push({
    effectType: 'launch_campaign',
    status: 'executed',
    message: `Campaign rolled ${dieOne}+${dieTwo}+${modifier} = ${total} against ${successTarget}+.`,
    causedBy: ['launch_campaign'],
    deltas: [],
  });

  if (success) {
    const victoryEffects: Effect[] = [
      { type: 'remove_extraction', region: regionId, amount: extractionRemoved },
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
    const failedCampaignsBefore = state.failedCampaigns;
    state.failedCampaigns += 1;
    traces.push({
      effectType: 'launch_campaign',
      status: 'executed',
      message: `Failed campaigns ${failedCampaignsBefore} -> ${state.failedCampaigns}.`,
      causedBy: ['launch_campaign'],
      deltas: [createDelta('track', 'failedCampaigns', failedCampaignsBefore, state.failedCampaigns)],
    });
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

  return { traces, roll, modifiers: campaignModifiers };
}

function resolveQueuedAction(state: EngineState, content: CompiledContent, seat: number, intent: QueuedIntent) {
  const action = getBaseActionDefinition(content, intent.actionId);
  let traces: EffectTrace[] = [];
  const eventContext: NonNullable<DomainEvent['context']> = {
    actingSeat: seat,
    targetRegionId: intent.regionId,
    targetDomainId: intent.domainId,
    committedComrades: intent.comradesCommitted,
    committedEvidence: intent.evidenceCommitted,
    causedBy: [],
  };

  switch (action.id) {
    case 'organize':
      traces = resolveOrganize(state, content, seat, intent);
      break;
    case 'investigate':
      traces = resolveInvestigate(state, content, seat, intent);
      break;
    case 'launch_campaign': {
      const resolution = resolveLaunchCampaign(state, content, seat, intent);
      traces = resolution.traces;
      eventContext.roll = resolution.roll;
      eventContext.campaignModifiers = resolution.modifiers;
      break;
    }
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
    case 'go_viral':
      traces = applyEffects(state, content, [{ type: 'lose_evidence', seat, amount: 1 }, { type: 'modify_gaze', delta: 1 }], {
        sourceType: 'action', sourceId: 'go_viral', emoji: '📱', message: 'Going viral.', causedBy: ['go_viral'], context: eventContext as ResolveContext
      });
      break;
    case 'burn_veil':
      traces = applyEffects(state, content, [{ type: 'remove_comrades', region: intent.regionId!, seat, amount: 1 }, { type: 'modify_gaze', delta: 2 }], {
        sourceType: 'action', sourceId: 'burn_veil', emoji: '🔥', message: 'Burning the veil.', causedBy: ['burn_veil'], context: eventContext as ResolveContext
      });
      break;
    case 'schoolgirl_network':
      traces = applyEffects(state, content, [{ type: 'gain_evidence', seat, amount: 1 }], {
        sourceType: 'action', sourceId: 'schoolgirl_network', emoji: '🎒', message: 'Schoolgirl network gathered info.', causedBy: ['schoolgirl_network'], context: eventContext as ResolveContext
      });
      break;
    case 'compose_chant':
      traces = applyEffects(state, content, [{ type: 'lose_evidence', seat, amount: 1 }], {
        sourceType: 'action', sourceId: 'compose_chant', emoji: '📣', message: 'Composing a chant.', causedBy: ['compose_chant'], context: eventContext as ResolveContext
      });
      break;
    case 'coordinate_digital':
      traces = applyEffects(state, content, [{ type: 'lose_evidence', seat, amount: 1 }, { type: 'open_replanning' }], {
        sourceType: 'action', sourceId: 'coordinate_digital', emoji: '🖥️', message: 'Coordinating digitally.', causedBy: ['coordinate_digital'], context: eventContext as ResolveContext
      });
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
    eventContext,
  );

  const progress = ensureVictoryProgress(state);
  progress.lastResolvedActionId = action.id;
  progress.actionsById[action.id] = (progress.actionsById[action.id] ?? 0) + 1;
}

export function normalizeEngineState(state: EngineState): EngineState {
  const next = cloneState(state);
  next.extractionPool = calculateExtractionPool(next);
  next.players = next.players.map((player) => ({
    ...player,
    ownerId: player.ownerId ?? player.seat,
    mandateSatisfied: player.mandateSatisfied ?? false,
  }));
  next.secretMandatesEnabled = next.secretMandatesEnabled ?? true;
  next.customTracks = next.customTracks ?? {};
  next.activeBeaconIds = next.activeBeaconIds ?? [];
  next.activeSystemCardIds = next.activeSystemCardIds ?? [];
  next.usedSystemEscalationTriggers = next.usedSystemEscalationTriggers ?? createDefaultEscalationTriggers();
  next.failedCampaigns = next.failedCampaigns ?? 0;
  next.publicAttentionEvents = next.publicAttentionEvents ?? [];
  next.lastSystemCardIds = next.lastSystemCardIds ?? [];
  next.mandatesResolved = next.mandatesResolved ?? !next.secretMandatesEnabled;
  next.terminalOutcome = next.terminalOutcome ?? null;
  next.scenarioFlags = next.scenarioFlags ?? {};
  next.triggeredScenarioThresholds = next.triggeredScenarioThresholds ?? {};
  next.victoryProgress = next.victoryProgress ?? {
    extractionRemoved: 0,
    actionsById: {},
    lastResolvedActionId: null,
    victoryPredicateSatisfiedBeforeAllowedRound: false,
  };
  next.victoryProgress.victoryPredicateSatisfiedBeforeAllowedRound
    = next.victoryProgress.victoryPredicateSatisfiedBeforeAllowedRound ?? false;
  next.eventLog = (next.eventLog ?? []).map((event) => ({
    ...event,
    ...(event.context
      ? {
        context: {
          ...event.context,
          cardReveals: event.context.cardReveals?.map((reveal) => ({
            ...reveal,
            origin: (reveal.origin as string | undefined) === 'opening_hand' ? 'startup_withdrawal' : (reveal.origin ?? 'other'),
          })),
          ...(event.context.roll
            ? {
              roll: {
                ...event.context.roll,
                target: event.context.roll.target ?? BASE_CAMPAIGN_TARGET,
                outcomeBand: event.context.roll.outcomeBand
                  ?? (event.context.roll.success
                    ? (event.context.roll.total >= 11 ? 'surge' : 'success')
                    : (event.context.roll.total <= 5 ? 'backlash' : 'attention')),
                extractionRemoved: event.context.roll.extractionRemoved ?? (event.context.roll.success ? (event.context.roll.total >= 11 ? 2 : 1) : 0),
                domainDelta: event.context.roll.domainDelta ?? (event.context.roll.success ? 1 : 0),
                globalGazeDelta: event.context.roll.globalGazeDelta ?? (!event.context.roll.success && event.context.roll.total > 5 ? 1 : 0),
                warMachineDelta: event.context.roll.warMachineDelta
                  ?? (event.context.roll.success
                    ? (event.context.roll.domainId === 'WarMachine' && event.context.roll.total >= 10 ? -1 : 0)
                    : (event.context.roll.total <= 5 ? 1 : 0)),
              },
            }
            : {}),
        },
      }
      : {}),
  }));
  if (!next.decks.crisis) {
    next.decks.crisis = { drawPile: [], discardPile: [] };
  }
  return next;
}

export function initializeGame(command: StartGameCommand): EngineState {
  const content = compileContent(command.rulesetId);
  validateVictoryScoringConfig(content);
  validateStartGameCommand(command, content);
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
        addRejectedCommandEvent(next, command, toLegacyDisabledReason(reason));
        return next;
      }
      const player = next.players[command.seat];
      player.queuedIntents.push({ ...command.action, slot: player.queuedIntents.length });
      player.actionsRemaining -= 1;
      addEvent(next, 'command', 'QueueIntent', '📝', `Seat ${command.seat + 1} queued ${command.action.actionId}.`, ['QueueIntent'], [], {
        actingSeat: command.seat,
        actionId: command.action.actionId,
        targetRegionId: command.action.regionId,
        targetDomainId: command.action.domainId,
        causedBy: ['QueueIntent'],
      });
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
      addEvent(next, 'command', 'RemoveQueuedIntent', '↩️', `Seat ${command.seat + 1} pulled a queued move.`, ['RemoveQueuedIntent'], [], {
        actingSeat: command.seat,
        causedBy: ['RemoveQueuedIntent'],
      });
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
      addEvent(next, 'command', 'ReorderQueuedIntent', '🔀', `Seat ${command.seat + 1} reordered planned moves.`, ['ReorderQueuedIntent'], [], {
        actingSeat: command.seat,
        causedBy: ['ReorderQueuedIntent'],
      });
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
      addEvent(next, 'command', 'SetReady', command.ready ? '✅' : '⚪', `Seat ${command.seat + 1} is ${command.ready ? 'ready' : 'not ready'}.`, ['SetReady'], [], {
        actingSeat: command.seat,
        readyState: command.ready,
        causedBy: ['SetReady'],
      });
      return next;
    }
    case 'ResolveSystemPhase': {
      if (next.phase !== 'SYSTEM') {
        addRejectedCommandEvent(next, command, 'System phase is not active.');
        return next;
      }

      next.lastSystemCardIds = [];
      next.publicAttentionEvents = [];
      processScenarioRoundPenalty(next, content);
      if (next.terminalOutcome) {
        return next;
      }
      const pressure = getSystemPersistentModifiers(next, content);
      const drawCount = Math.max(1, 1 + (next.globalGaze >= 10 ? 1 : 0) + pressure.crisisDrawDelta);
      if (next.globalGaze >= 10) {
        addSystemAttentionEvent(next, 'Global Gaze is high. The Crisis deck strikes twice this round.');
      }
      if (pressure.crisisDrawDelta > 0) {
        addSystemAttentionEvent(next, 'A structural escalation forces additional Crisis draws this round.');
      }

      for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
        const cardId = drawCard(next, 'crisis');
        if (!cardId) {
          continue;
        }
        resolveCrisisCard(next, content, cardId);
        if (next.terminalOutcome) {
          return next;
        }
        if (checkExtractionLoss(next)) {
          return next;
        }
      }

      resolveSystemEscalation(next, content);
      if (next.terminalOutcome) {
        return next;
      }
      if (checkExtractionLoss(next)) {
        return next;
      }

      resolveMilitaryIntervention(next, content);
      if (next.terminalOutcome) {
        return next;
      }
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

      // THE SQUARE (Tahrir Square)
      if (next.rulesetId === 'tahrir_square') {
        const cairoComrades = Object.values(next.regions['Cairo'].comradesPresent).reduce((a, b) => a + b, 0);
        if (cairoComrades === 0) {
          next.tahrirEmptyRounds += 1;
          if (next.tahrirEmptyRounds >= 2) {
            next.domains['RevolutionaryWave'].progress = Math.max(0, next.domains['RevolutionaryWave'].progress - 1);
            addSimpleEvent(next, 'system', 'the_square_empty', '🏚️', 'Tahrir is empty. The Revolutionary Wave recedes.', ['the_square_empty']);
          }
        } else {
          next.tahrirEmptyRounds = 0;
        }
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
          addSimpleEvent(next, 'action', intent.actionId, '❌', `Seat ${seat + 1} failed to resolve ${intent.actionId}: ${toLegacyDisabledReason(reason)}.`, [
            'CommitCoalitionIntent',
            intent.actionId,
          ]);
          continue;
        }
        resolveQueuedAction(next, content, seat, intent);
        updatePersistentMandateSatisfaction(next, content, { actingSeat: seat, actionId: intent.actionId });
        if (next.terminalOutcome) {
          return next;
        }
        if (content.ruleset.victoryGate?.requiredAction?.actionId) {
          updateBeaconCompletion(next, content);
          if (checkPositiveVictory(next, content, { trigger: 'action', actionId: intent.actionId })) {
            return next;
          }
        }
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
      if (checkComradesExhaustedLoss(next)) {
        return next;
      }
      if (checkPositiveVictory(next, content, { trigger: 'resolution' })) {
        return next;
      }
      if (checkExtractionLoss(next)) {
        return next;
      }
      if (next.round >= content.ruleset.suddenDeathRound) {
        next.phase = 'LOSS';
        next.lossReason = t('ui.runtime.lossSuddenDeath', 'Round {{round}} ended without a decisive victory.', {
          round: content.ruleset.suddenDeathRound,
        });
        revealMandates(next);
        addSimpleEvent(next, 'system', 'sudden_death', '⌛', '⌛ Sudden death ended the struggle.', ['sudden_death']);
        finalizeTerminalEvent(
          next,
          createTerminalOutcome(
            next,
            'defeat',
            'sudden_death',
            t('ui.runtime.outcomeDefeat', 'Defeat'),
            next.lossReason,
          ),
        );
        return next;
      }

      next.round += 1;
      next.phase = 'SYSTEM';
      addSimpleEvent(
        next,
        'command',
        'ResolveResolutionPhase',
        '🔁',
        t('ui.runtime.roundBegins', 'Round {{round}} begins.', { round: next.round }),
        ['ResolveResolutionPhase'],
      );
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
