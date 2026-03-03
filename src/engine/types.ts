import type { CoreId } from './ids.ts';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Clamp {
  min?: number;
  max?: number;
}

export interface RngState {
  seed: number;
  state: number;
  calls: number;
}

export interface CoreTrackState {
  id: CoreId;
  value: number;
  min?: number;
  max?: number;
  thresholds: number[];
  metadata: Record<string, JsonValue>;
}

export interface CoreResourceState {
  id: CoreId;
  amount: number;
  metadata: Record<string, JsonValue>;
}

export interface CorePlayerState {
  id: CoreId;
  seat: number;
  ownerId: number | null;
  ready: boolean;
  queuedActions: GameAction[];
  resources: Record<string, number>;
  tags: string[];
  data: Record<string, JsonValue>;
}

export interface CoreZoneState {
  id: CoreId;
  counters: Record<string, number>;
  resources: Record<string, number>;
  entities: string[];
  tags: string[];
  data: Record<string, JsonValue>;
}

export interface CoreEntityState {
  id: CoreId;
  type: string;
  zoneId: CoreId | null;
  ownerId: CoreId | null;
  counters: Record<string, number>;
  tags: string[];
  data: Record<string, JsonValue>;
}

export type ScenarioCardVisibility = 'public' | 'owner' | 'private' | 'hidden';

export interface ScenarioCard {
  id: CoreId;
  nameKey?: string;
  textKey?: string;
  resolverId?: string;
  autoResolve?: boolean;
  data: Record<string, JsonValue>;
}

export interface CoreDeckState {
  id: CoreId;
  cards: Record<string, ScenarioCard>;
  drawPile: string[];
  discardPile: string[];
  active: string[];
  metadata: Record<string, JsonValue>;
}

export interface StructuredEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, JsonValue>;
  tags: string[];
  level: 'debug' | 'info' | 'warning' | 'error';
  messageKey?: string;
}

export interface StructuredLogEntry extends StructuredEvent {
  round: number;
  phaseId: string;
}

export interface GameAction {
  id: string;
  actorId?: CoreId;
  zoneId?: CoreId;
  targetIds?: CoreId[];
  params?: Record<string, JsonValue>;
  costs?: Record<string, number>;
  cardId?: string;
}

export interface CoreCommand {
  type: string;
  action?: GameAction;
  payload?: Record<string, JsonValue>;
  meta?: Record<string, JsonValue>;
}

export interface CreateGamePlayerInput {
  id: string;
  seat: number;
  ownerId?: number | null;
  resources?: Record<string, number>;
  tags?: string[];
  data?: Record<string, JsonValue>;
}

export interface CreateGameOptions {
  scenarioId?: string;
  seed: number;
  mode?: string;
  locale?: string;
  difficulty?: string;
  players?: CreateGamePlayerInput[];
  initialFlags?: Record<string, JsonValue>;
  initialCounters?: Record<string, number>;
  initialScenarioState?: Record<string, JsonValue>;
}

export type GameStatus = 'setup' | 'running' | 'won' | 'lost';

export interface GameResult {
  status: Extract<GameStatus, 'won' | 'lost'>;
  reasonId: string;
  summary: Record<string, JsonValue>;
}

export interface CoreGameState {
  coreVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  rng: RngState;
  round: number;
  turn: number;
  phase: { id: string; index: number };
  status: GameStatus;
  players: Record<string, CorePlayerState>;
  tracks: Record<string, CoreTrackState>;
  resources: Record<string, CoreResourceState>;
  zones: Record<string, CoreZoneState>;
  entities: Record<string, CoreEntityState>;
  decks: Record<string, CoreDeckState>;
  flags: Record<string, JsonValue>;
  counters: Record<string, number>;
  log: StructuredLogEntry[];
  commandLog: CoreCommand[];
  scenarioState: Record<string, JsonValue>;
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ReductionResult {
  state: CoreGameState;
  emittedEvents: StructuredEvent[];
  validationErrors: ValidationError[];
  debugTrace: string[];
}

export type PredicateEvaluator = (
  state: CoreGameState,
  args: Record<string, JsonValue> | undefined,
  scenario: ScenarioModule,
) => boolean;

export type RuleExpression =
  | { kind: 'predicate'; predicateId: string; args?: Record<string, JsonValue> }
  | { kind: 'all'; rules: RuleExpression[] }
  | { kind: 'any'; rules: RuleExpression[] }
  | { kind: 'not'; rule: RuleExpression };

export interface ActionCost {
  resourceId: string;
  amount: number;
  source: string;
}

export interface ActionModifier {
  id: string;
  amount: number;
  source: string;
  scope: 'action_cost' | 'action_roll' | 'track_delta' | 'resource_delta' | 'constraint';
  actionId?: string;
  trackId?: string;
  resourceId?: string;
}

export interface HookContext {
  state: CoreGameState;
  scenario: ScenarioModule;
  command?: CoreCommand;
  action?: GameAction;
  effect?: CoreEffect;
  card?: ScenarioCard;
  result?: GameResult;
  emittedEvents: StructuredEvent[];
  debugTrace: string[];
}

export interface HookResult {
  effects?: CoreEffect[];
  events?: StructuredEvent[];
  debug?: string[];
}

export interface ScenarioLifecycleHooks {
  onScenarioLoad(ctx: HookContext): HookResult | void;
  onGameSetup(ctx: HookContext): HookResult | void;
  onRoundStart(ctx: HookContext): HookResult | void;
  onPhaseStart(phaseId: string, ctx: HookContext): HookResult | void;
  onBeforeAction(action: GameAction, ctx: HookContext): HookResult | void;
  onAfterAction(action: GameAction, ctx: HookContext): HookResult | void;
  onEffectResolve(effect: CoreEffect, ctx: HookContext): HookResult | void;
  onCardDraw(deckId: string, card: ScenarioCard, ctx: HookContext): HookResult | void;
  onCardResolve(card: ScenarioCard, ctx: HookContext): HookResult | void;
  onRoundEnd(ctx: HookContext): HookResult | void;
  onGameEnd(result: GameResult, ctx: HookContext): HookResult | void;
}

export interface ScenarioPhaseDefinition {
  id: string;
  labelKey: string;
  order: number;
}

export type ActionValidator = (
  state: CoreGameState,
  action: GameAction,
  scenario: ScenarioModule,
) => ValidationError | null;

export type ActionCostCalculator = (
  state: CoreGameState,
  action: GameAction,
  scenario: ScenarioModule,
) => ActionCost[];

export type ModifierProvider = (
  state: CoreGameState,
  action: GameAction | undefined,
  scenario: ScenarioModule,
) => ActionModifier[];

export type DifficultyHook = (
  state: CoreGameState,
  scenario: ScenarioModule,
  difficulty: string | undefined,
) => HookResult | void;

export type OutcomeEvaluator = (
  state: CoreGameState,
  scenario: ScenarioModule,
) => GameResult | null;

export interface ScenarioRules {
  phases: ScenarioPhaseDefinition[];
  predicates: Record<string, PredicateEvaluator>;
  winEvaluators: OutcomeEvaluator[];
  loseEvaluators: OutcomeEvaluator[];
  actionValidators: ActionValidator[];
  actionCostCalculators: ActionCostCalculator[];
  modifiers: ModifierProvider[];
  difficultyHooks: DifficultyHook[];
}

export interface ScenarioEffectContext {
  state: CoreGameState;
  scenario: ScenarioModule;
  command?: CoreCommand;
  action?: GameAction;
  effect?: CoreEffect;
  card?: ScenarioCard;
  emittedEvents: StructuredEvent[];
  debugTrace: string[];
}

export type ActionResolver = (
  state: CoreGameState,
  action: GameAction,
  scenario: ScenarioModule,
  ctx: ScenarioEffectContext,
) => CoreEffect[];

export type CardResolver = (
  state: CoreGameState,
  card: ScenarioCard,
  scenario: ScenarioModule,
  ctx: ScenarioEffectContext,
) => CoreEffect[];

export type DeckFactory = (
  state: CoreGameState,
  scenario: ScenarioModule,
) => CoreDeckState;

export type SystemTurnScript = (
  state: CoreGameState,
  scenario: ScenarioModule,
  ctx: ScenarioEffectContext,
) => CoreEffect[];

export type WeightedRandomPolicy = (
  state: CoreGameState,
  scenario: ScenarioModule,
) => Array<{ id: string; weight: number }>;

export type CrisisInjectionRule = (
  state: CoreGameState,
  scenario: ScenarioModule,
) => CoreEffect[];

export interface CommandBridge {
  createInitialState?(scenario: ScenarioModule, options: CreateGameOptions): CoreGameState;
  dispatch?(
    state: CoreGameState,
    command: CoreCommand,
    scenario: ScenarioModule,
  ): ReductionResult;
}

export interface ScenarioBehaviors {
  actionResolvers: Record<string, ActionResolver>;
  cardResolvers: Record<string, CardResolver>;
  deckFactories: Record<string, DeckFactory>;
  systemTurnScript: SystemTurnScript;
  weightedRandomPolicies?: Record<string, WeightedRandomPolicy>;
  crisisInjectionRules?: CrisisInjectionRule[];
  commandBridge?: CommandBridge;
}

export interface ScenarioMetadata {
  id: string;
  name: string;
  version: string;
  supportedLocales: string[];
  summary: string;
  assets: Record<string, string>;
  legacyRulesetId?: string;
}

export interface ScenarioVisibilityPolicy {
  hiddenPlayerDataKeys?: string[];
  hiddenDeckIds?: string[];
  redactState?: (state: CoreGameState, viewerId: number | null) => CoreGameState;
}

export interface ScenarioSetupHelpers {
  createBaseState(partial?: Partial<CoreGameState>): CoreGameState;
  createPlayer(input: CreateGamePlayerInput): CorePlayerState;
  createDeck(deckId: string, cards: ScenarioCard[]): CoreDeckState;
}

export interface ScenarioSetup {
  buildInitialState(options: CreateGameOptions, helpers: ScenarioSetupHelpers): CoreGameState;
  visibility?: ScenarioVisibilityPolicy;
}

export interface ScenarioContent {
  dictionary: Record<string, string>;
  localeNamespaces: Record<string, Record<string, string>>;
  cards: Record<string, ScenarioCard>;
  decks: Record<string, string[]>;
  trackDefinitions: Record<string, Partial<CoreTrackState>>;
  zoneDefinitions: Record<string, Partial<CoreZoneState>>;
  assets: Record<string, string>;
  legacy?: Record<string, JsonValue>;
}

export interface ScenarioUiAdapter {
  getLabel(id: string, fallback?: string): string;
  getTrackOrder?(state: CoreGameState): string[];
  getZoneOrder?(state: CoreGameState): string[];
  getBoardDefinition?(): unknown;
  getIcon?(id: string): string | undefined;
  getColor?(id: string): string | undefined;
  formatEvent?(event: StructuredEvent, state: CoreGameState): string;
  formatResult?(result: GameResult, state: CoreGameState): string;
}

export interface ScenarioObservability {
  formatLogEntry?(entry: StructuredLogEntry, state: CoreGameState): string;
  analytics?(event: StructuredEvent, state: CoreGameState): void;
  inspect?(state: CoreGameState): Record<string, JsonValue>;
}

export type StateMigration = (value: JsonValue) => JsonValue;

export interface ScenarioMigrationRegistry {
  migrateScenarioState: Record<string, StateMigration>;
}

export interface CoreMigrationRegistry {
  migrateCoreState: Record<string, StateMigration>;
}

export interface ScenarioModule {
  metadata: ScenarioMetadata;
  setup: ScenarioSetup;
  content: ScenarioContent;
  rules: ScenarioRules;
  behaviors: ScenarioBehaviors;
  ui: ScenarioUiAdapter;
  observability?: ScenarioObservability;
  migrations: ScenarioMigrationRegistry;
  hooks: ScenarioLifecycleHooks;
}

export interface ScenarioModuleInput {
  metadata: ScenarioMetadata;
  setup: ScenarioSetup;
  content: ScenarioContent;
  rules: Partial<ScenarioRules>;
  behaviors: Partial<ScenarioBehaviors> & Pick<ScenarioBehaviors, 'systemTurnScript'>;
  ui: ScenarioUiAdapter;
  observability?: ScenarioObservability;
  migrations?: Partial<ScenarioMigrationRegistry>;
  hooks?: Partial<ScenarioLifecycleHooks>;
}

export interface SerializedGameEnvelope {
  coreVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  state: CoreGameState;
  commandLog: CoreCommand[];
}

export interface DeserializedGame {
  scenario: ScenarioModule;
  payload: SerializedGameEnvelope;
  state: CoreGameState;
}

export interface ScenarioRegistry {
  get(id: string): ScenarioModule | undefined;
  list(): ScenarioModule[];
}

export type CoreEffect =
  | { type: 'adjustTrack'; trackId: string; delta: number; clamp?: Clamp }
  | { type: 'setTrack'; trackId: string; value: number; clamp?: Clamp }
  | { type: 'adjustPlayerResource'; playerId: string; resourceId: string; delta: number; clamp?: Clamp }
  | { type: 'adjustZoneCounter'; zoneId: string; counterId: string; delta: number; clamp?: Clamp }
  | { type: 'adjustEntityCounter'; entityId: string; counterId: string; delta: number; clamp?: Clamp }
  | { type: 'moveEntity'; entityId: string; zoneId: string | null }
  | { type: 'drawCard'; deckId: string; count?: number; destination?: 'discard' | 'active' | 'player'; playerId?: string }
  | { type: 'discardCard'; deckId: string; cardId: string }
  | { type: 'setFlag'; flagId: string; value: JsonValue }
  | { type: 'setCounter'; counterId: string; value: number }
  | { type: 'adjustCounter'; counterId: string; delta: number; clamp?: Clamp }
  | { type: 'mutateScenarioState'; key: string; value: JsonValue }
  | { type: 'appendLog'; entry: Omit<StructuredLogEntry, 'round' | 'phaseId'> }
  | { type: 'emitEvent'; event: StructuredEvent }
  | { type: 'advancePhase'; phaseId: string; index?: number }
  | { type: 'batch'; effects: CoreEffect[] };
