import { compileContent } from './content.ts';
import { createRng, nextRandom, shuffle } from './rng.ts';
import type {
  ActionDefinition,
  ActionTarget,
  ActiveCompromise,
  CivicSpace,
  CompiledContent,
  Condition,
  DeckId,
  DelayedEffectState,
  DisabledActionReason,
  DomainEvent,
  Effect,
  EffectContext,
  EffectTrace,
  EndingSummary,
  EngineCommand,
  EngineState,
  FlagScope,
  FlagValue,
  FrontId,
  FrontSelector,
  InstitutionInstance,
  InstitutionStatus,
  InstitutionType,
  LockType,
  PlayerSelector,
  PlayerState,
  QueuedIntent,
  RegionId,
  RegionSelector,
  ResourceType,
  StateDelta,
  ValueRef,
} from './types.ts';

const FRONT_IDS: FrontId[] = ['WAR', 'CLIMATE', 'RIGHTS', 'SPEECH_INFO', 'POVERTY', 'ENERGY', 'CULTURE'];
const REGION_IDS: RegionId[] = [
  'MENA',
  'SubSaharanAfrica',
  'SouthAsia',
  'SoutheastAsia',
  'LatinAmerica',
  'Europe',
  'NorthAmerica',
  'PacificIslands',
];

function cloneState<T>(value: T): T {
  return structuredClone(value);
}

function createEmptyStagedWorldPhase(): EngineState['stagedWorldPhase'] {
  return {
    captureCardId: null,
    crisisCardIds: [],
    activeCrisisId: null,
    band: 0,
    status: 'idle',
  };
}

export function normalizeEngineState(state: EngineState): EngineState {
  const next = cloneState(state);
  next.stagedWorldPhase = {
    ...createEmptyStagedWorldPhase(),
    ...(state.stagedWorldPhase ?? {}),
  };
  return next;
}

function assertExists<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }

  return value;
}

function clamp(value: number, limits?: { min?: number; max?: number }): number {
  let next = value;

  if (limits?.min !== undefined) {
    next = Math.max(limits.min, next);
  }

  if (limits?.max !== undefined) {
    next = Math.min(limits.max, next);
  }

  return next;
}

function civicSpaceIndex(space: CivicSpace): number {
  switch (space) {
    case 'OPEN':
      return 0;
    case 'NARROWED':
      return 1;
    case 'OBSTRUCTED':
      return 2;
    case 'REPRESSED':
      return 3;
    case 'CLOSED':
      return 4;
  }
}

function civicSpaceFromIndex(index: number): CivicSpace {
  const clamped = clamp(index, { min: 0, max: 4 });
  return ['OPEN', 'NARROWED', 'OBSTRUCTED', 'REPRESSED', 'CLOSED'][clamped] as CivicSpace;
}

export function getTemperatureBand(temperature: number) {
  if (temperature <= 2) {
    return { band: 0, crisisCount: 1, couplingMultiplier: 1 };
  }

  if (temperature <= 4) {
    return { band: 1, crisisCount: 1, couplingMultiplier: 1 };
  }

  if (temperature <= 6) {
    return { band: 2, crisisCount: 2, couplingMultiplier: 2 };
  }

  if (temperature <= 8) {
    return { band: 3, crisisCount: 2, couplingMultiplier: 2 };
  }

  return { band: 4, crisisCount: 3, couplingMultiplier: 2 };
}

function nextEventSeq(state: EngineState): number {
  return state.eventLog.length + 1;
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
  const deltas = trace.flatMap((entry) => entry.deltas);

  state.eventLog.push({
    seq: nextEventSeq(state),
    round: state.round,
    phase: state.phase,
    sourceType,
    sourceId,
    emoji,
    message,
    causedBy,
    deltas,
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

function resolveDynamicKey(key: string, context: EffectContext): string {
  if (key.includes('target_region')) {
    return key.replaceAll('target_region', context.target?.regionId ?? 'UNKNOWN_REGION');
  }

  return key;
}

function getFlagContainer(state: EngineState, scope: FlagScope): Record<string, FlagValue> {
  return scope === 'round' ? state.roundFlags : state.scenarioFlags;
}

function resolvePlayer(state: EngineState, selector: PlayerSelector, context: EffectContext): PlayerState | null {
  if (selector === 'acting_player' && context.actingSeat !== undefined) {
    return state.players[context.actingSeat] ?? null;
  }

  if (selector === 'target_player' && context.target?.kind === 'NONE' && context.actingSeat !== undefined) {
    return state.players[context.actingSeat] ?? null;
  }

  if (typeof selector === 'number') {
    return state.players[selector] ?? null;
  }

  return null;
}

function resolveRegions(selector: RegionSelector, context: EffectContext): RegionId[] {
  if (selector === 'ANY') {
    return REGION_IDS;
  }

  if (selector === 'target_region') {
    return context.target?.regionId ? [context.target.regionId] : [];
  }

  return [selector];
}

function resolveFront(selector: FrontSelector, context: EffectContext): FrontId | null {
  if (selector === 'target_front') {
    return context.target?.frontId ?? null;
  }

  return selector;
}

function updatePlayerBurnoutState(player: PlayerState): void {
  const strainedThreshold = Math.ceil(player.maxBurnout * 0.7);

  if (player.burnout >= player.maxBurnout) {
    player.burnoutState = 'burnt';
    return;
  }

  if (player.burnout >= strainedThreshold) {
    player.burnoutState = 'strained';
    return;
  }

  player.burnoutState = 'steady';
}

function markInstitutionReset(region: { institutions: InstitutionInstance[] }): void {
  for (const institution of region.institutions) {
    institution.preventedThisRound = false;
    institution.threatenedThisRound = false;
  }
}

function getFirstViableInstitution(region: { institutions: InstitutionInstance[] }): InstitutionInstance | undefined {
  return region.institutions.find((institution) => institution.status !== 'destroyed');
}

function hasActiveInstitution(region: { institutions: InstitutionInstance[] }, type: InstitutionType): InstitutionInstance | undefined {
  return region.institutions.find((institution) => institution.type === type && institution.status === 'active');
}

function createDelta(
  kind: StateDelta['kind'],
  label: string,
  before: StateDelta['before'],
  after: StateDelta['after'],
): StateDelta {
  return { kind, label, before, after };
}

function resolveValueRef(state: EngineState, reference: ValueRef, context: EffectContext): number | string | boolean {
  switch (reference.type) {
    case 'temperature':
      return state.temperature;
    case 'civic_space_index':
      return civicSpaceIndex(state.civicSpace);
    case 'resource':
      return state.resources[reference.resource];
    case 'front_stat':
      return state.fronts[reference.front][reference.stat];
    case 'player_burnout':
      return resolvePlayer(state, reference.player, context)?.burnout ?? 0;
    case 'player_actions_remaining':
      return resolvePlayer(state, reference.player, context)?.actionsRemaining ?? 0;
    case 'flag': {
      const key = resolveDynamicKey(reference.key, context);
      return getFlagContainer(state, reference.scope)[key] ?? 0;
    }
  }
}

function compareValues(
  left: number | string | boolean,
  right: number | string | boolean,
  op: '>' | '>=' | '<' | '<=' | '==' | '!=',
): boolean {
  switch (op) {
    case '>':
      return Number(left) > Number(right);
    case '>=':
      return Number(left) >= Number(right);
    case '<':
      return Number(left) < Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '==':
      return left === right;
    case '!=':
      return left !== right;
  }
}

function evaluateCondition(state: EngineState, condition: Condition, context: EffectContext): boolean {
  switch (condition.kind) {
    case 'compare': {
      const left = resolveValueRef(state, condition.left, context);
      const right = typeof condition.right === 'object' && condition.right !== null && 'type' in condition.right
        ? resolveValueRef(state, condition.right, context)
        : condition.right;
      return compareValues(left, right, condition.op);
    }
    case 'all':
      return condition.conditions.every((entry) => evaluateCondition(state, entry, context));
    case 'any':
      return condition.conditions.some((entry) => evaluateCondition(state, entry, context));
    case 'not':
      return !evaluateCondition(state, condition.condition, context);
    case 'tokenCount': {
      const total = resolveRegions(condition.region, context).reduce((sum, regionId) => {
        return sum + (state.regions[regionId]?.tokens[condition.token] ?? 0);
      }, 0);
      return compareValues(total, condition.count, condition.op);
    }
    case 'hasLock':
      return resolveRegions(condition.region, context).some((regionId) => state.regions[regionId]?.locks.includes(condition.lock));
    case 'phaseIs':
      return state.phase === condition.phase;
    case 'modeIs':
      return state.mode === condition.mode;
    case 'flagIs': {
      const key = resolveDynamicKey(condition.key, context);
      return (getFlagContainer(state, condition.scope)[key] ?? false) === condition.value;
    }
    case 'frontCollapsed':
      return state.fronts[condition.front].collapsed;
  }
}

function getDefaultTargetForAction(action: ActionDefinition): ActionTarget {
  switch (action.targetKind) {
    case 'REGION':
      return { kind: 'REGION', regionId: 'MENA' };
    case 'FRONT':
      return { kind: 'FRONT', frontId: 'WAR' };
    case 'NONE':
      return { kind: 'NONE' };
  }
}

function getLegalTargets(action: ActionDefinition): ActionTarget[] {
  switch (action.targetKind) {
    case 'NONE':
      return [{ kind: 'NONE' }];
    case 'FRONT':
      return FRONT_IDS.map((frontId) => ({ kind: 'FRONT', frontId }));
    case 'REGION':
      return REGION_IDS.map((regionId) => ({ kind: 'REGION', regionId }));
  }
}

function findDisinfoPenaltyResource(action: ActionDefinition): ResourceType {
  if (action.resourceCosts?.evidence !== undefined || action.journalismAction) {
    return 'evidence';
  }

  if (action.resourceCosts?.capacity !== undefined) {
    return 'capacity';
  }

  return 'solidarity';
}

function getActionCosts(state: EngineState, player: PlayerState, action: ActionDefinition, target: ActionTarget): Partial<Record<ResourceType, number>> {
  const costs = { ...(action.resourceCosts ?? {}) };

  if (player.burnoutState === 'strained' && (action.publicAction || action.burnoutCost !== undefined)) {
    const resource = findDisinfoPenaltyResource(action);
    costs[resource] = (costs[resource] ?? 0) + 1;
  }

  if (action.id === 'truth_window' && civicSpaceIndex(state.civicSpace) >= civicSpaceIndex('OBSTRUCTED')) {
    costs.evidence = (costs.evidence ?? 0) + 1;
  }

  if (
    target.kind === 'REGION' &&
    (state.regions[target.regionId!].tokens.disinfo ?? 0) > 0 &&
    !action.antiDisinfoAction
  ) {
    const resource = findDisinfoPenaltyResource(action);
    costs[resource] = (costs[resource] ?? 0) + 1;
  }

  return costs;
}

function getDisabledReasonForTarget(
  state: EngineState,
  player: PlayerState,
  action: ActionDefinition,
  target: ActionTarget,
): string | undefined {
  if (state.phase !== 'COALITION') {
    return 'Phase locked';
  }

  if (player.ready) {
    return 'Seat already ready';
  }

  if (player.actionsRemaining <= 0) {
    return 'No actions remaining';
  }

  if (action.mode === 'FULL' && state.mode !== 'FULL') {
    return 'Full mode only';
  }

  if (action.mode === 'CORE' && state.mode !== 'CORE') {
    return 'Core mode only';
  }

  if (player.burnoutState === 'burnt' && action.burnoutCost !== undefined) {
    return 'Burnt out';
  }

  if (action.id === 'community_mobilization' && civicSpaceIndex(state.civicSpace) >= civicSpaceIndex('REPRESSED')) {
    return 'Civic space closed to public mobilization';
  }

  if (target.kind === 'REGION') {
    const region = state.regions[target.regionId!];
    const hasTruthWindow = Boolean(state.roundFlags[`truth_window:${target.regionId}`]);
    const isCensored = region.locks.includes('Censorship');

    if (isCensored && (action.journalismAction || action.cultureAction) && !action.bypassesCensorship && !hasTruthWindow) {
      return 'Censorship active';
    }
  }

  for (const condition of action.disabledWhen ?? []) {
    if (evaluateCondition(state, condition, { actingSeat: player.seat, target, causedBy: [action.id] })) {
      return 'Action gated by scenario rules';
    }
  }

  const costs = getActionCosts(state, player, action, target);
  for (const [resource, amount] of Object.entries(costs) as Array<[ResourceType, number]>) {
    if (state.resources[resource] < amount) {
      return `Not enough ${resource}`;
    }
  }

  return undefined;
}

export function getDisabledActionReason(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: string,
  target?: ActionTarget,
): DisabledActionReason {
  const player = assertExists(state.players[seat], `Unknown player seat ${seat}.`);
  const action = assertExists(content.actions[actionId], `Unknown action ${actionId}.`);
  const legalTargets = getLegalTargets(action);
  const resolvedTarget = target ?? getDefaultTargetForAction(action);
  const reason = getDisabledReasonForTarget(state, player, action, resolvedTarget);

  return {
    actionId,
    disabled: Boolean(reason),
    reason,
    legalTargets,
    finalCosts: getActionCosts(state, player, action, resolvedTarget),
  };
}

function createInitialPlayers(command: Extract<EngineCommand, { type: 'StartGame' }>, content: CompiledContent): PlayerState[] {
  return command.roleIds.slice(0, command.playerCount).map((roleId, seat) => {
    const role = assertExists(content.roles[roleId], `Unknown role ${roleId}.`);
    const player: PlayerState = {
      seat,
      roleId,
      burnout: 0,
      burnoutState: 'steady',
      maxBurnout: role.burnoutMax,
      actionsRemaining: role.actionsPerTurn[command.mode],
      ready: false,
      queuedIntents: [],
      privateHints: [],
    };
    return player;
  });
}

function createInitialState(command: Extract<EngineCommand, { type: 'StartGame' }>, content: CompiledContent): EngineState {
  let rng = createRng(command.seed);
  const players = createInitialPlayers(command, content);
  const scenario = content.scenario;

  const fronts = Object.fromEntries(
    FRONT_IDS.map((frontId) => {
      const definition = content.fronts[frontId];
      const overrides = scenario.setup.frontOverrides[frontId] ?? {};
      return [
        frontId,
        {
          id: frontId,
          pressure: overrides.pressure ?? definition.initial.pressure,
          protection: overrides.protection ?? definition.initial.protection,
          impact: overrides.impact ?? definition.initial.impact,
          collapsed: false,
        },
      ];
    }),
  ) as EngineState['fronts'];

  const regions = Object.fromEntries(
    REGION_IDS.map((regionId) => {
      const definition = content.regions[regionId];
      const override = scenario.setup.regionOverrides[regionId] ?? {};
      const tokens = {
        displacement: 0,
        disinfo: 0,
        compromise_debt: 0,
        ...(override.tokens ?? {}),
      };
      return [
        regionId,
        {
          id: regionId,
          vulnerability: { ...definition.vulnerability, ...(override.vulnerability ?? {}) },
          tokens,
          locks: [...(override.locks ?? [])],
          institutions: (override.institutions ?? []).map((institution) => ({
            type: institution.institution,
            status: institution.status ?? 'active',
            preventedThisRound: false,
            threatenedThisRound: false,
          })),
        },
      ];
    }),
  ) as EngineState['regions'];

  const decks = {
    capture: { drawPile: [] as string[], discardPile: [] as string[] },
    crisis: { drawPile: [] as string[], discardPile: [] as string[] },
    culture: { drawPile: [] as string[], discardPile: [] as string[] },
  };

  for (const deck of ['capture', 'crisis', 'culture'] as DeckId[]) {
    const cardIds = content.decks[deck].filter((cardId) => {
      const card = content.cards[cardId];
      return card.mode === 'BOTH' || card.mode === command.mode;
    });
    const [nextRng, shuffled] = shuffle(rng, cardIds);
    rng = nextRng;
    decks[deck].drawPile = shuffled;
  }

  const charter = Object.fromEntries(
    Object.keys(content.charter).map((clauseId) => [
      clauseId,
      {
        id: clauseId,
        status: 'locked',
        progress: 0,
      },
    ]),
  ) as EngineState['charter'];

  const state: EngineState = {
    seed: command.seed,
    rng,
    mode: command.mode,
    scenarioId: command.scenarioId,
    round: 1,
    roundLimit: scenario.roundLimit[command.mode],
    phase: 'WORLD',
    civicSpace: scenario.setup.civicSpace,
    temperature: scenario.setup.temperature,
    resources: {
      solidarity: scenario.setup.resources.solidarity,
      evidence: scenario.setup.resources.evidence,
      capacity: scenario.setup.resources.capacity,
      relief: scenario.setup.resources.relief,
    },
    globalTokens: { compromise_debt: 0 },
    fronts,
    regions,
    players,
    decks,
    stagedWorldPhase: createEmptyStagedWorldPhase(),
    charter,
    charterProgress: 0,
    scenarioFlags: {
      charter_progress_total: 0,
    },
    roundFlags: {},
    delayedEffects: [],
    activeCompromise: null,
    commandLog: [cloneState(command)],
    eventLog: [],
    endingTier: null,
    lossReason: null,
    debug: {
      climateRoll: null,
      lastCaptureCards: [],
      lastCrisisCards: [],
      lastCrisisCount: 0,
      firedRuleIds: [],
    },
  };

  if (command.playerCount === 2) {
    state.resources.solidarity += 2;
    state.resources.evidence += 1;
    state.resources.capacity += 1;
  } else if (command.playerCount === 3) {
    state.resources.solidarity += 1;
    state.resources.capacity += 1;
  }

  updateCharterUnlocks(state, content);
  addSimpleEvent(state, 'system', 'game_start', '🌍', `Dignity Rising begins: ${scenario.name}`, ['StartGame']);
  return state;
}

function recordPlayerCosts(state: EngineState, player: PlayerState, costs: Partial<Record<ResourceType, number>>, traces: EffectTrace[]): void {
  for (const [resource, amount] of Object.entries(costs) as Array<[ResourceType, number]>) {
    const before = state.resources[resource];
    state.resources[resource] = clamp(state.resources[resource] - amount, { min: 0 });
    traces.push({
      effectType: 'spend_resource',
      status: 'executed',
      message: `Spent ${amount} ${resource}.`,
      causedBy: [`seat:${player.seat}`],
      deltas: [createDelta('resource', resource, before, state.resources[resource])],
    });
  }
}

function applyPreventiveLock(region: EngineState['regions'][RegionId], lock: LockType): boolean {
  const clinic = hasActiveInstitution(region, 'LegalClinic');

  if (!clinic) {
    return false;
  }

  if ((lock === 'AidAccess' || lock === 'Surveillance') && !clinic.preventedThisRound) {
    clinic.preventedThisRound = true;
    return true;
  }

  return false;
}

function applyPreventiveDisplacement(region: EngineState['regions'][RegionId], context: EffectContext): boolean {
  const microgrid = hasActiveInstitution(region, 'CommunityMicrogrid');

  if (!microgrid || microgrid.preventedThisRound) {
    return false;
  }

  if (context.sourceTags?.some((tag) => tag === 'CLIMATE' || tag === 'ENERGY')) {
    microgrid.preventedThisRound = true;
    return true;
  }

  return false;
}

function damageInstitutionInstance(instance: InstitutionInstance): InstitutionStatus {
  if (instance.status === 'active') {
    instance.status = 'damaged';
  } else if (instance.status === 'damaged') {
    instance.status = 'destroyed';
  }

  return instance.status;
}

function ratifyClause(state: EngineState, content: CompiledContent, clauseId: string, causedBy: string[]): void {
  const clause = state.charter[clauseId];
  const definition = content.charter[clauseId];
  if (!clause || !definition || clause.status === 'ratified') {
    return;
  }

  clause.status = 'ratified';
  addSimpleEvent(state, 'system', clauseId, '✅', `Charter ratified: ${definition.title}.`, causedBy);
  applyEffects(
    state,
    content,
    definition.ratifyEffects,
    {
      sourceType: 'system',
      sourceId: clauseId,
      emoji: '⚖️',
      message: definition.title,
      causedBy,
      context: { causedBy },
    },
  );
}

function ratifyFirstAvailableClause(state: EngineState, content: CompiledContent, causedBy: string[]): boolean {
  updateCharterUnlocks(state, content);

  const clause = Object.values(state.charter).find((entry) => entry.status === 'unlocked');
  if (!clause) {
    return false;
  }

  ratifyClause(state, content, clause.id, causedBy);
  return true;
}

function resolveCardDraw(state: EngineState, deck: DeckId): string | null {
  if (state.decks[deck].drawPile.length === 0 && state.decks[deck].discardPile.length > 0) {
    const [nextRng, reshuffled] = shuffle(state.rng, state.decks[deck].discardPile);
    state.rng = nextRng;
    state.decks[deck].drawPile = reshuffled;
    state.decks[deck].discardPile = [];
  }

  return state.decks[deck].drawPile.shift() ?? null;
}

function resolveCard(state: EngineState, content: CompiledContent, cardId: string, causedBy: string[], context: EffectContext): void {
  const card = content.cards[cardId];
  if (!card) {
    return;
  }

  applyEffects(
    state,
    content,
    card.effects,
    {
      sourceType: 'card',
      sourceId: card.id,
      emoji: card.emoji,
      message: card.name,
      causedBy: [...causedBy, card.id],
      context: { ...context, causedBy: [...causedBy, card.id], sourceTags: card.tags },
    },
  );
  state.decks[card.deck].discardPile.push(card.id);
}

function stageWorldPhase(state: EngineState, content: CompiledContent, sourceId: 'DrawWorldCards' | 'ResolveWorldPhase'): void {
  nextWorldPhaseSetup(state, content, sourceId);

  const captureCardId = resolveCardDraw(state, 'capture');
  const band = getTemperatureBand(state.temperature);
  const crisisCardIds: string[] = [];

  if (captureCardId) {
    state.debug.lastCaptureCards = [captureCardId];
  }
  state.debug.lastCrisisCount = band.crisisCount;

  for (let drawIndex = 0; drawIndex < band.crisisCount; drawIndex += 1) {
    const crisisCardId = resolveCardDraw(state, 'crisis');
    if (crisisCardId) {
      crisisCardIds.push(crisisCardId);
    }
  }

  state.debug.lastCrisisCards = crisisCardIds;
  state.stagedWorldPhase = {
    captureCardId,
    crisisCardIds,
    activeCrisisId: crisisCardIds[0] ?? null,
    band: band.band,
    status: 'drawn',
  };

  addSimpleEvent(
    state,
    'command',
    sourceId,
    '🃏',
    crisisCardIds.length > 0 ? 'World cards drawn and set on the table.' : 'World cards drawn. No crisis cards remained in the deck.',
    [sourceId],
  );
}

function nextWorldPhaseSetup(state: EngineState, content: CompiledContent, sourceId: 'DrawWorldCards' | 'ResolveWorldPhase'): void {
  state.roundFlags = {};
  state.debug = {
    climateRoll: null,
    lastCaptureCards: [],
    lastCrisisCards: [],
    lastCrisisCount: 0,
    firedRuleIds: [],
  };
  state.stagedWorldPhase = createEmptyStagedWorldPhase();
  for (const region of Object.values(state.regions)) {
    markInstitutionReset(region);
  }

  resolveHook(state, content, 'on_round_start', { causedBy: [sourceId] });
  applyClimateUpdate(state, content);
}

function adoptWorldPhase(state: EngineState, content: CompiledContent, sourceId: 'AdoptResolution' | 'ResolveWorldPhase'): void {
  const staged = cloneState(state.stagedWorldPhase);
  const baseCausedBy = [sourceId];

  if (staged.captureCardId) {
    resolveCard(state, content, staged.captureCardId, baseCausedBy, { causedBy: baseCausedBy });
    resolveHook(state, content, 'on_capture_card_resolve', { causedBy: [...baseCausedBy, staged.captureCardId] });
  }

  for (const crisisCardId of staged.crisisCardIds) {
    state.stagedWorldPhase.activeCrisisId = crisisCardId;
    resolveCard(state, content, crisisCardId, baseCausedBy, { causedBy: baseCausedBy });
    resolveHook(state, content, 'on_crisis_resolve', { causedBy: [...baseCausedBy, crisisCardId] });
  }

  resolveHook(state, content, 'on_world_phase_pre', { causedBy: baseCausedBy });
  applyDelayedEffects(state, content);
  state.stagedWorldPhase = createEmptyStagedWorldPhase();
}

function resolveHook(state: EngineState, content: CompiledContent, hookName: keyof CompiledContent['hooks'], context: EffectContext): void {
  for (const hook of content.hooks[hookName]) {
    if (hook.when && !evaluateCondition(state, hook.when, context)) {
      continue;
    }

    state.debug.firedRuleIds.push(hook.id);
    applyEffects(
      state,
      content,
      hook.effects,
      {
        sourceType: 'hook',
        sourceId: hook.id,
        emoji: hook.emoji,
        message: hook.message,
        causedBy: [...context.causedBy, hook.id],
        context: { ...context, causedBy: [...context.causedBy, hook.id] },
      },
    );
  }
}

interface ApplyEffectSource {
  sourceType: DomainEvent['sourceType'];
  sourceId: string;
  emoji: string;
  message: string;
  causedBy: string[];
  context: EffectContext;
}

function applyEffects(state: EngineState, content: CompiledContent, effects: Effect[], source: ApplyEffectSource): void {
  const traces: EffectTrace[] = [];

  for (const effect of effects) {
    const trace: EffectTrace = {
      effectType: effect.type,
      status: 'executed',
      message: source.message,
      causedBy: source.causedBy,
      deltas: [],
    };

    try {
      switch (effect.type) {
        case 'modify_track': {
          if (effect.target.type === 'temperature') {
            const before = state.temperature;
            state.temperature = clamp(state.temperature + effect.delta, effect.clamp ?? { min: 0, max: 10 });
            trace.message = `Temperature ${before} -> ${state.temperature}.`;
            trace.deltas.push(createDelta('track', 'temperature', before, state.temperature));
          } else if (effect.target.type === 'civic_space_index') {
            const before = state.civicSpace;
            const afterIndex = clamp(civicSpaceIndex(state.civicSpace) + effect.delta, effect.clamp ?? { min: 0, max: 4 });
            state.civicSpace = civicSpaceFromIndex(afterIndex);
            trace.message = `Civic space ${before} -> ${state.civicSpace}.`;
            trace.deltas.push(createDelta('track', 'civicSpace', before, state.civicSpace));
          } else if (effect.target.type === 'player_burnout') {
            const player = resolvePlayer(state, effect.target.player, source.context);
            if (!player) {
              trace.status = 'skipped';
              trace.message = 'No player available for burnout adjustment.';
              break;
            }
            const before = player.burnout;
            player.burnout = clamp(player.burnout + effect.delta, { min: 0, max: player.maxBurnout });
            updatePlayerBurnoutState(player);
            trace.message = `Seat ${player.seat} burnout ${before} -> ${player.burnout}.`;
            trace.deltas.push(createDelta('player', `seat:${player.seat}:burnout`, before, player.burnout));
          } else if (effect.target.type === 'player_actions_remaining') {
            const player = resolvePlayer(state, effect.target.player, source.context);
            if (!player) {
              trace.status = 'skipped';
              trace.message = 'No player available for action change.';
              break;
            }
            const before = player.actionsRemaining;
            player.actionsRemaining = clamp(player.actionsRemaining + effect.delta, effect.clamp ?? { min: 0 });
            trace.message = `Seat ${player.seat} actions ${before} -> ${player.actionsRemaining}.`;
            trace.deltas.push(createDelta('player', `seat:${player.seat}:actions`, before, player.actionsRemaining));
          } else if (effect.target.type === 'resource') {
            const before = state.resources[effect.target.resource];
            state.resources[effect.target.resource] = clamp(
              state.resources[effect.target.resource] + effect.delta,
              effect.clamp ?? { min: 0, max: 99 },
            );
            trace.message = `${effect.target.resource} ${before} -> ${state.resources[effect.target.resource]}.`;
            trace.deltas.push(
              createDelta('resource', effect.target.resource, before, state.resources[effect.target.resource]),
            );
          } else if (effect.target.type === 'flag') {
            const key = resolveDynamicKey(effect.target.key, source.context);
            const flags = getFlagContainer(state, effect.target.scope);
            const before = Number(flags[key] ?? 0);
            const after = clamp(before + effect.delta, effect.clamp ?? { min: 0 });
            flags[key] = after;
            trace.message = `Flag ${key} ${before} -> ${after}.`;
            trace.deltas.push(createDelta('flag', key, before, after));
          }
          break;
        }
        case 'modify_front_stat': {
          const frontId = resolveFront(effect.front, source.context);
          if (!frontId) {
            trace.status = 'skipped';
            trace.message = 'No front selected.';
            break;
          }
          const front = state.fronts[frontId];
          const before = front[effect.stat];
          front[effect.stat] = clamp(front[effect.stat] + effect.delta, effect.clamp ?? { min: 0, max: 10 });
          trace.message = `${frontId}.${effect.stat} ${before} -> ${front[effect.stat]}.`;
          trace.deltas.push(createDelta('front', `${frontId}.${effect.stat}`, before, front[effect.stat]));
          break;
        }
        case 'add_token': {
          const regions = resolveRegions(effect.region, source.context);
          if (effect.token === 'compromise_debt' && effect.region === 'ANY') {
            const before = state.globalTokens.compromise_debt ?? 0;
            state.globalTokens.compromise_debt = before + effect.count;
            trace.message = `Compromise debt ${before} -> ${state.globalTokens.compromise_debt}.`;
            trace.deltas.push(createDelta('token', 'global.compromise_debt', before, state.globalTokens.compromise_debt));
            break;
          }

          for (const regionId of regions) {
            if (effect.token === 'disinfo' && state.roundFlags.witness_window_available) {
              const beforeFlag = state.roundFlags.witness_window_available;
              state.roundFlags.witness_window_available = false;
              trace.message = 'Witness Window cancels disinfo placement.';
              trace.deltas.push(createDelta('flag', 'witness_window_available', beforeFlag, false));
              break;
            }

            const region = state.regions[regionId];
            if (effect.token === 'displacement' && (state.roundFlags[`prevent_displacement:${regionId}`] ?? false)) {
              const beforeFlag = state.roundFlags[`prevent_displacement:${regionId}`];
              state.roundFlags[`prevent_displacement:${regionId}`] = false;
              trace.message = `Preparedness cancels displacement in ${regionId}.`;
              trace.deltas.push(createDelta('flag', `prevent_displacement:${regionId}`, beforeFlag, false));
              continue;
            }

            if (effect.token === 'displacement' && applyPreventiveDisplacement(region, source.context)) {
              trace.message = `Community Microgrid absorbs displacement in ${regionId}.`;
              continue;
            }

            const before = region.tokens[effect.token];
            region.tokens[effect.token] += effect.count;
            trace.deltas.push(createDelta('token', `${regionId}.${effect.token}`, before, region.tokens[effect.token]));
            trace.message = `Added ${effect.count} ${effect.token} in ${regionId}.`;
          }
          break;
        }
        case 'remove_token': {
          const regions = resolveRegions(effect.region, source.context);
          if (effect.token === 'compromise_debt' && effect.region === 'ANY') {
            const before = state.globalTokens.compromise_debt ?? 0;
            state.globalTokens.compromise_debt = Math.max(0, before - effect.count);
            trace.message = `Compromise debt ${before} -> ${state.globalTokens.compromise_debt}.`;
            trace.deltas.push(createDelta('token', 'global.compromise_debt', before, state.globalTokens.compromise_debt));
            break;
          }

          for (const regionId of regions) {
            const region = state.regions[regionId];
            const before = region.tokens[effect.token];
            region.tokens[effect.token] = Math.max(0, region.tokens[effect.token] - effect.count);
            trace.deltas.push(createDelta('token', `${regionId}.${effect.token}`, before, region.tokens[effect.token]));
            trace.message = `Removed ${effect.count} ${effect.token} from ${regionId}.`;
          }
          break;
        }
        case 'add_lock': {
          for (const regionId of resolveRegions(effect.region, source.context)) {
            const region = state.regions[regionId];
            if (applyPreventiveLock(region, effect.lock)) {
              trace.message = `Legal Clinic prevents ${effect.lock} in ${regionId}.`;
              continue;
            }
            if (!region.locks.includes(effect.lock)) {
              region.locks.push(effect.lock);
              trace.deltas.push(createDelta('lock', `${regionId}.${effect.lock}`, false, true));
              trace.message = `Added ${effect.lock} in ${regionId}.`;
            }
          }
          break;
        }
        case 'remove_lock': {
          for (const regionId of resolveRegions(effect.region, source.context)) {
            const region = state.regions[regionId];
            if (region.locks.includes(effect.lock)) {
              region.locks = region.locks.filter((lock) => lock !== effect.lock);
              trace.deltas.push(createDelta('lock', `${regionId}.${effect.lock}`, true, false));
              trace.message = `Removed ${effect.lock} from ${regionId}.`;
            }
          }
          break;
        }
        case 'spend_resource': {
          const before = state.resources[effect.resource];
          state.resources[effect.resource] = Math.max(0, before - effect.amount);
          trace.message = `Spent ${effect.amount} ${effect.resource}.`;
          trace.deltas.push(createDelta('resource', effect.resource, before, state.resources[effect.resource]));
          break;
        }
        case 'gain_resource': {
          const before = state.resources[effect.resource];
          state.resources[effect.resource] = before + effect.amount;
          trace.message = `Gained ${effect.amount} ${effect.resource}.`;
          trace.deltas.push(createDelta('resource', effect.resource, before, state.resources[effect.resource]));
          break;
        }
        case 'conditional': {
          const branch = evaluateCondition(state, effect.if, source.context) ? effect.then : effect.else ?? [];
          trace.message = branch === effect.then ? 'Conditional branch succeeded.' : 'Conditional branch fell through.';
          applyEffects(state, content, branch, source);
          break;
        }
        case 'choice': {
          if (effect.choiceType === 'compromise' && state.mode === 'FULL') {
            const compromise: ActiveCompromise = {
              id: `${source.sourceId}:compromise`,
              prompt: effect.prompt,
              sourceId: source.sourceId,
              options: effect.options,
              votes: {},
            };
            state.activeCompromise = compromise;
            trace.message = 'Compromise offer prepared.';
            resolveHook(state, content, 'on_compromise_offer', source.context);
          } else {
            trace.status = 'skipped';
            trace.message = 'Compromise module inactive in Core mode.';
          }
          break;
        }
        case 'delayed_effect': {
          const delayed: DelayedEffectState = {
            id: `${source.sourceId}:delayed:${state.delayedEffects.length + 1}`,
            afterRounds: effect.afterRounds,
            description: effect.description,
            effects: effect.effects,
            causedBy: source.causedBy,
          };
          state.delayedEffects.push(delayed);
          trace.message = `Scheduled delayed effect in ${effect.afterRounds} rounds.`;
          break;
        }
        case 'log':
          trace.message = effect.message;
          break;
        case 'set_flag': {
          const flags = getFlagContainer(state, effect.scope);
          const key = resolveDynamicKey(effect.key, source.context);
          const before = flags[key] ?? false;
          flags[key] = effect.value;
          trace.message = `Flag ${key} set.`;
          trace.deltas.push(createDelta('flag', key, before, effect.value));
          break;
        }
        case 'draw_from_deck': {
          for (let drawIndex = 0; drawIndex < effect.count; drawIndex += 1) {
            const cardId = resolveCardDraw(state, effect.deck);
            if (!cardId) {
              trace.status = 'skipped';
              trace.message = `Deck ${effect.deck} is empty.`;
              break;
            }
            resolveCard(state, content, cardId, source.causedBy, source.context);
          }
          break;
        }
        case 'ensure_institution': {
          for (const regionId of resolveRegions(effect.region, source.context)) {
            const region = state.regions[regionId];
            const existing = region.institutions.find((institution) => institution.type === effect.institution);
            if (existing) {
              const before = existing.status;
              existing.status = effect.status ?? 'active';
              trace.deltas.push(createDelta('institution', `${regionId}.${effect.institution}`, before, existing.status));
              trace.message = `${effect.institution} restored in ${regionId}.`;
            } else {
              region.institutions.push({
                type: effect.institution,
                status: effect.status ?? 'active',
                preventedThisRound: false,
                threatenedThisRound: false,
              });
              trace.deltas.push(createDelta('institution', `${regionId}.${effect.institution}`, null, effect.status ?? 'active'));
              trace.message = `${effect.institution} established in ${regionId}.`;
            }
          }
          break;
        }
        case 'damage_institution': {
          for (const regionId of resolveRegions(effect.region, source.context)) {
            const region = state.regions[regionId];
            const institution =
              effect.institution !== undefined
                ? region.institutions.find((entry) => entry.type === effect.institution && entry.status !== 'destroyed')
                : getFirstViableInstitution(region);
            if (!institution) {
              trace.status = 'skipped';
              trace.message = `No institution to damage in ${regionId}.`;
              continue;
            }
            const before = institution.status;
            const after = damageInstitutionInstance(institution);
            trace.deltas.push(createDelta('institution', `${regionId}.${institution.type}`, before, after));
            trace.message = `${institution.type} in ${regionId} is now ${after}.`;
          }
          break;
        }
        case 'repair_institution': {
          for (const regionId of resolveRegions(effect.region, source.context)) {
            const region = state.regions[regionId];
            const institution = region.institutions.find((entry) => entry.type === effect.institution);
            if (!institution) {
              trace.status = 'skipped';
              trace.message = `No ${effect.institution} in ${regionId}.`;
              continue;
            }
            const before = institution.status;
            institution.status = 'active';
            trace.deltas.push(createDelta('institution', `${regionId}.${effect.institution}`, before, institution.status));
            trace.message = `${effect.institution} repaired in ${regionId}.`;
          }
          break;
        }
        case 'add_charter_progress': {
          const before = state.charterProgress;
          state.charterProgress += effect.amount;
          state.scenarioFlags.charter_progress_total = Number(state.scenarioFlags.charter_progress_total ?? 0) + effect.amount;
          trace.message = `Charter progress ${before} -> ${state.charterProgress}.`;
          trace.deltas.push(createDelta('charter', 'charterProgress', before, state.charterProgress));
          break;
        }
        case 'ratify_first_available_charter': {
          const ratified = ratifyFirstAvailableClause(state, content, source.causedBy);
          if (!ratified) {
            const before = state.charterProgress;
            state.charterProgress += effect.fallbackProgress;
            state.scenarioFlags.charter_progress_total = Number(state.scenarioFlags.charter_progress_total ?? 0) + effect.fallbackProgress;
            trace.message = `No clause ready; charter progress ${before} -> ${state.charterProgress}.`;
            trace.deltas.push(createDelta('charter', 'charterProgress', before, state.charterProgress));
          } else {
            trace.message = 'Ratified the first available charter clause.';
          }
          break;
        }
      }
    } catch (error) {
      trace.status = 'failed';
      trace.message = error instanceof Error ? error.message : String(error);
    }

    traces.push(trace);
  }

  addEvent(state, source.sourceType, source.sourceId, source.emoji, source.message, source.causedBy, traces);
}

function applyClimateUpdate(state: EngineState, content: CompiledContent): void {
  const band = getTemperatureBand(state.temperature);
  const [nextRng, roll] = nextRandom(state.rng);
  state.rng = nextRng;
  state.debug.climateRoll = roll;

  let threshold = 1;
  if (band.band <= 1) {
    threshold = 0.45;
  } else if (band.band <= 3) {
    threshold = 0.25;
  } else {
    threshold = 0;
  }

  if (band.band === 4 || roll >= threshold) {
    applyEffects(
      state,
      content,
      [{ type: 'modify_track', target: { type: 'temperature' }, delta: 1, clamp: { min: 0, max: 10 } }],
      {
        sourceType: 'system',
        sourceId: 'climate_update',
        emoji: '🔥',
        message: 'Climate clock advances.',
        causedBy: ['climate_update'],
        context: { causedBy: ['climate_update'] },
      },
    );
  } else {
    addSimpleEvent(state, 'system', 'climate_update', '🌡️', 'Temperature holds this round.', ['climate_update']);
  }
}

function applyDelayedEffects(state: EngineState, content: CompiledContent): void {
  const remaining: DelayedEffectState[] = [];

  for (const delayed of state.delayedEffects) {
    const nextDelay = delayed.afterRounds - 1;
    if (nextDelay <= 0) {
      applyEffects(
        state,
        content,
        delayed.effects,
        {
          sourceType: 'system',
          sourceId: delayed.id,
          emoji: '⏳',
          message: delayed.description,
          causedBy: delayed.causedBy,
          context: { causedBy: delayed.causedBy },
        },
      );
    } else {
      remaining.push({ ...delayed, afterRounds: nextDelay });
    }
  }

  state.delayedEffects = remaining;
}

function updateCollapseState(state: EngineState, content: CompiledContent): string | null {
  for (const frontId of FRONT_IDS) {
    const definition = content.fronts[frontId];
    const collapsed = definition.collapseConditions.some((condition) =>
      evaluateCondition(state, condition, { causedBy: [`collapse:${frontId}`] }),
    );
    state.fronts[frontId].collapsed = collapsed;

    if (collapsed) {
      state.phase = 'LOSS';
      state.lossReason = `${definition.name} collapsed`;
      addSimpleEvent(state, 'system', `collapse:${frontId}`, '❌', `${definition.name} collapsed.`, [`collapse:${frontId}`]);
      return state.lossReason;
    }
  }

  return null;
}

function updateCharterUnlocks(state: EngineState, content: CompiledContent): void {
  for (const clauseId of Object.keys(content.charter)) {
    const clause = state.charter[clauseId];
    const definition = content.charter[clauseId];
    if (clause.status === 'ratified') {
      continue;
    }
    const unlocked = definition.prerequisites.every((condition) =>
      evaluateCondition(state, condition, { causedBy: [`charter:${clauseId}`] }),
    );
    clause.status = unlocked ? 'unlocked' : 'locked';
  }
}

function applyInstitutionPassives(state: EngineState): void {
  for (const region of Object.values(state.regions)) {
    for (const institution of region.institutions) {
      if (institution.status !== 'active') {
        continue;
      }

      switch (institution.type) {
        case 'MutualAidHub':
          if (region.tokens.displacement > 0) {
            state.resources.solidarity += 1;
            addSimpleEvent(state, 'system', `${region.id}.MutualAidHub`, '🤝', `${region.id} Mutual Aid Hub generates solidarity.`, [`institution:${region.id}:MutualAidHub`]);
          }
          break;
        case 'IndependentMediaNetwork':
          if (region.tokens.disinfo > 0) {
            region.tokens.disinfo -= 1;
            addSimpleEvent(state, 'system', `${region.id}.IndependentMediaNetwork`, '🛰️', `${region.id} Independent Media Network strips out disinfo.`, [`institution:${region.id}:IndependentMediaNetwork`]);
          } else {
            state.roundFlags[`truth_window:${region.id}`] = true;
            addSimpleEvent(state, 'system', `${region.id}.IndependentMediaNetwork`, '📣', `${region.id} Independent Media Network opens a truth window.`, [`institution:${region.id}:IndependentMediaNetwork`]);
          }
          break;
        case 'LegalClinic':
          break;
        case 'CommunityMicrogrid':
          state.resources.capacity += 1;
          addSimpleEvent(state, 'system', `${region.id}.CommunityMicrogrid`, '⚡', `${region.id} Community Microgrid strengthens local capacity.`, [`institution:${region.id}:CommunityMicrogrid`]);
          break;
      }
    }
  }
}

function calculateEndingSummary(state: EngineState): EndingSummary {
  const ratifiedClauses = Object.values(state.charter).filter((clause) => clause.status === 'ratified').length;
  const activeInstitutions = Object.values(state.regions).reduce((sum, region) => {
    return sum + region.institutions.filter((institution) => institution.status === 'active').length;
  }, 0);

  if (ratifiedClauses >= 6 && activeInstitutions >= 3) {
    return { tier: 'Rising', ratifiedClauses, activeInstitutions };
  }

  if (ratifiedClauses >= 4) {
    return { tier: 'Dignified Resistance', ratifiedClauses, activeInstitutions };
  }

  if (ratifiedClauses >= 2) {
    return { tier: 'Endurance', ratifiedClauses, activeInstitutions };
  }

  return { tier: 'Survival', ratifiedClauses, activeInstitutions };
}

function sortCoalitionIntents(intents: Array<{ seat: number; intent: QueuedIntent }>, content: CompiledContent) {
  return intents.slice().sort((left, right) => {
    const leftAction = content.actions[left.intent.actionId];
    const rightAction = content.actions[right.intent.actionId];

    if (leftAction.resolvePriority !== rightAction.resolvePriority) {
      return leftAction.resolvePriority - rightAction.resolvePriority;
    }

    if (left.seat !== right.seat) {
      return left.seat - right.seat;
    }

    if (left.intent.slot !== right.intent.slot) {
      return left.intent.slot - right.intent.slot;
    }

    return left.intent.actionId.localeCompare(right.intent.actionId);
  });
}

export function initializeGame(command: Extract<EngineCommand, { type: 'StartGame' }>): EngineState {
  const content = compileContent(command.scenarioId, command.expansionIds ?? []);
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

  const next = normalizeEngineState(state);
  next.commandLog.push(cloneState(command));

  switch (command.type) {
    case 'StartGame':
      return initializeGame(command);
    case 'QueueIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Cannot queue actions outside Coalition.');
        return next;
      }

      const player = next.players[command.seat];
      const action = content.actions[command.actionId];
      if (!player || !action) {
        addRejectedCommandEvent(next, command, 'Unknown player or action.');
        return next;
      }

      const disabled = getDisabledActionReason(next, content, command.seat, command.actionId, command.target);
      if (disabled.disabled) {
        addRejectedCommandEvent(next, command, disabled.reason ?? 'Action is disabled.');
        return next;
      }

      const slot = player.queuedIntents.length;
      player.queuedIntents.push({ slot, actionId: command.actionId, target: command.target });
      player.actionsRemaining -= 1;
      addSimpleEvent(next, 'command', 'QueueIntent', '🤝', `${action.name} queued for seat ${command.seat + 1}.`, [
        'QueueIntent',
        action.id,
      ]);
      return next;
    }
    case 'RemoveQueuedIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Cannot remove intents outside Coalition.');
        return next;
      }

      const player = next.players[command.seat];
      if (!player) {
        addRejectedCommandEvent(next, command, 'Unknown player.');
        return next;
      }

      const removed = player.queuedIntents.find((intent) => intent.slot === command.slot);
      if (!removed) {
        addRejectedCommandEvent(next, command, 'Queued intent not found.');
        return next;
      }

      player.queuedIntents = player.queuedIntents.filter((intent) => intent.slot !== command.slot);
      player.queuedIntents.forEach((intent, slot) => {
        intent.slot = slot;
      });
      player.actionsRemaining += 1;
      player.ready = false;
      addSimpleEvent(next, 'command', 'RemoveQueuedIntent', '↩️', `Removed queued action for seat ${command.seat + 1}.`, [
        'RemoveQueuedIntent',
      ]);
      return next;
    }
    case 'ReorderQueuedIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Cannot reorder planned moves outside Coalition.');
        return next;
      }

      const player = next.players[command.seat];
      if (!player) {
        addRejectedCommandEvent(next, command, 'Unknown player.');
        return next;
      }

      const queue = player.queuedIntents.slice();
      if (
        command.fromSlot < 0
        || command.fromSlot >= queue.length
        || command.toSlot < 0
        || command.toSlot >= queue.length
      ) {
        addRejectedCommandEvent(next, command, 'Planned move not found.');
        return next;
      }

      const [moved] = queue.splice(command.fromSlot, 1);
      queue.splice(command.toSlot, 0, moved);
      player.queuedIntents = queue.map((intent, slot) => ({ ...intent, slot }));
      player.ready = false;
      addSimpleEvent(
        next,
        'command',
        'ReorderQueuedIntent',
        '🪵',
        `Planned moves reordered for seat ${command.seat + 1}.`,
        ['ReorderQueuedIntent'],
      );
      return next;
    }
    case 'SetReady': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Ready state only matters in Coalition.');
        return next;
      }

      const player = next.players[command.seat];
      if (!player) {
        addRejectedCommandEvent(next, command, 'Unknown player.');
        return next;
      }

      if (command.ready && player.actionsRemaining > 0) {
        addRejectedCommandEvent(next, command, 'All actions must be queued before readying.');
        return next;
      }

      player.ready = command.ready;
      addSimpleEvent(next, 'command', 'SetReady', command.ready ? '✅' : '⚪', `Seat ${command.seat + 1} is ${command.ready ? 'ready' : 'not ready'}.`, ['SetReady']);
      return next;
    }
    case 'DrawWorldCards': {
      if (next.phase !== 'WORLD') {
        addRejectedCommandEvent(next, command, 'World phase is not active.');
        return next;
      }

      if (next.stagedWorldPhase.status === 'drawn') {
        addRejectedCommandEvent(next, command, 'World cards are already drawn.');
        return next;
      }

      stageWorldPhase(next, content, 'DrawWorldCards');
      return next;
    }
    case 'AdoptResolution': {
      if (next.phase !== 'WORLD') {
        addRejectedCommandEvent(next, command, 'World phase is not active.');
        return next;
      }

      if (next.stagedWorldPhase.status !== 'drawn') {
        addRejectedCommandEvent(next, command, 'Draw the world cards before adopting the resolution.');
        return next;
      }

      adoptWorldPhase(next, content, 'AdoptResolution');

      if (updateCollapseState(next, content)) {
        return next;
      }

      next.phase = 'COALITION';
      addSimpleEvent(next, 'command', 'AdoptResolution', '🧭', 'Resolution adopted. Coalition planning opens.', [
        'AdoptResolution',
      ]);
      return next;
    }
    case 'ResolveWorldPhase': {
      if (next.phase !== 'WORLD') {
        addRejectedCommandEvent(next, command, 'World phase is not active.');
        return next;
      }

      if (next.stagedWorldPhase.status !== 'drawn') {
        stageWorldPhase(next, content, 'ResolveWorldPhase');
      }

      adoptWorldPhase(next, content, 'ResolveWorldPhase');

      if (updateCollapseState(next, content)) {
        return next;
      }

      next.phase = 'COALITION';
      addSimpleEvent(next, 'command', 'ResolveWorldPhase', '🌍', 'World phase resolved. Coalition planning opens.', [
        'ResolveWorldPhase',
      ]);
      return next;
    }
    case 'CommitCoalitionIntent': {
      if (next.phase !== 'COALITION') {
        addRejectedCommandEvent(next, command, 'Coalition commit is only valid in Coalition.');
        return next;
      }

      if (!next.players.every((player) => player.ready)) {
        addRejectedCommandEvent(next, command, 'All seats must be ready before committing.');
        return next;
      }

      const queued = next.players.flatMap((player) => player.queuedIntents.map((intent) => ({ seat: player.seat, intent })));
      const ordered = sortCoalitionIntents(queued, content);

      for (const { seat, intent } of ordered) {
        const player = next.players[seat];
        const action = content.actions[intent.actionId];
        const disabled = getDisabledActionReason(next, content, seat, intent.actionId, intent.target);
        if (disabled.disabled) {
          addSimpleEvent(next, 'action', intent.actionId, '❌', `${action.name} failed: ${disabled.reason}.`, [
            'CommitCoalitionIntent',
            action.id,
          ]);
          continue;
        }

        const traces: EffectTrace[] = [];
        const costs = getActionCosts(next, player, action, intent.target);
        recordPlayerCosts(next, player, costs, traces);

        if (action.burnoutCost !== undefined) {
          const before = player.burnout;
          player.burnout = clamp(player.burnout + action.burnoutCost, { min: 0, max: player.maxBurnout });
          updatePlayerBurnoutState(player);
          traces.push({
            effectType: 'modify_track',
            status: 'executed',
            message: `${action.name} increases burnout.`,
            causedBy: ['CommitCoalitionIntent', action.id],
            deltas: [createDelta('player', `seat:${seat}:burnout`, before, player.burnout)],
          });
        }

        addEvent(next, 'action', action.id, '🤝', `${content.roles[player.roleId].name} resolves ${action.name}.`, ['CommitCoalitionIntent', action.id], traces);
        applyEffects(
          next,
          content,
          action.effects,
          {
            sourceType: 'action',
            sourceId: action.id,
            emoji: action.burnoutCost !== undefined ? '🧠' : '🛡️',
            message: action.name,
            causedBy: ['CommitCoalitionIntent', action.id],
            context: { actingSeat: seat, target: intent.target, causedBy: ['CommitCoalitionIntent', action.id] },
          },
        );
        resolveHook(next, content, 'on_player_action', {
          actingSeat: seat,
          target: intent.target,
          causedBy: ['CommitCoalitionIntent', action.id],
        });
      }

      for (const player of next.players) {
        player.ready = false;
        player.queuedIntents = [];
      }

      if (updateCollapseState(next, content)) {
        return next;
      }

      next.phase = next.activeCompromise ? 'COMPROMISE' : 'END';
      addSimpleEvent(next, 'command', 'CommitCoalitionIntent', '⚖️', 'Coalition intents resolved.', ['CommitCoalitionIntent']);
      return next;
    }
    case 'VoteCompromise': {
      if (next.phase !== 'COMPROMISE' || !next.activeCompromise) {
        addRejectedCommandEvent(next, command, 'No active compromise to vote on.');
        return next;
      }

      next.activeCompromise.votes[command.seat] = command.accept;
      addSimpleEvent(next, 'compromise', next.activeCompromise.id, '🤝', `Seat ${command.seat + 1} voted ${command.accept ? 'YES' : 'NO'}.`, [
        'VoteCompromise',
        next.activeCompromise.id,
      ]);

      if (Object.keys(next.activeCompromise.votes).length < next.players.length) {
        return next;
      }

      const yesVotes = Object.values(next.activeCompromise.votes).filter(Boolean).length;
      const accepted = yesVotes > next.players.length / 2;
      const option = accepted ? next.activeCompromise.options[0] : next.activeCompromise.options[1];
      applyEffects(
        next,
        content,
        option.effects,
        {
          sourceType: 'compromise',
          sourceId: next.activeCompromise.id,
          emoji: accepted ? '🤝' : '❌',
          message: `${next.activeCompromise.prompt} (${option.label})`,
          causedBy: ['VoteCompromise', next.activeCompromise.id],
          context: { causedBy: ['VoteCompromise', next.activeCompromise.id] },
        },
      );
      next.activeCompromise = null;
      next.phase = 'END';
      return next;
    }
    case 'ResolveEndPhase': {
      if (next.phase !== 'END') {
        addRejectedCommandEvent(next, command, 'End phase is not active.');
        return next;
      }

      const band = getTemperatureBand(next.temperature);
      for (let pass = 0; pass < band.couplingMultiplier; pass += 1) {
        resolveHook(next, content, 'on_end_phase', { causedBy: ['ResolveEndPhase'] });
      }

      if (band.band === 4) {
        resolveHook(next, content, 'on_end_phase', { causedBy: ['ResolveEndPhase', 'band4'] });
      }

      applyInstitutionPassives(next);
      updateCharterUnlocks(next, content);
      resolveHook(next, content, 'on_check_win_loss', { causedBy: ['ResolveEndPhase'] });

      if (updateCollapseState(next, content)) {
        return next;
      }

      if (next.round >= next.roundLimit) {
        const ending = calculateEndingSummary(next);
        next.endingTier = ending.tier;
        next.phase = 'WIN';
        addSimpleEvent(next, 'system', 'ending', '✅', `The coalition survives. Ending tier: ${ending.tier}.`, ['ResolveEndPhase']);
        return next;
      }

      next.round += 1;
      next.phase = 'WORLD';
      next.activeCompromise = null;
      for (const player of next.players) {
        const role = content.roles[player.roleId];
        updatePlayerBurnoutState(player);
        player.actionsRemaining = Math.max(1, role.actionsPerTurn[next.mode] - (player.burnoutState === 'burnt' ? 1 : 0));
        player.ready = false;
        player.queuedIntents = [];
      }
      addSimpleEvent(next, 'command', 'ResolveEndPhase', '🧩', `Round ${next.round} begins.`, ['ResolveEndPhase']);
      return next;
    }
  }
}

export function serializeForReplay(state: EngineState) {
  return {
    scenarioId: state.scenarioId,
    mode: state.mode,
    seed: state.seed,
    commands: state.commandLog,
  };
}

export function replayCommands(commandLog: EngineCommand[]): EngineState {
  const startCommand = commandLog[0];
  if (!startCommand || startCommand.type !== 'StartGame') {
    throw new Error('Replay requires a StartGame command at position 0.');
  }

  let state = initializeGame(startCommand);
  const content = compileContent(startCommand.scenarioId, startCommand.expansionIds ?? []);

  for (const command of commandLog.slice(1)) {
    state = dispatchCommand(state, command, content);
  }

  return state;
}
