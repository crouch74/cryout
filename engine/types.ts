export type GameMode = 'CORE' | 'FULL';
export type Phase = 'WORLD' | 'COALITION' | 'COMPROMISE' | 'END' | 'WIN' | 'LOSS';
export type CivicSpace = 'OPEN' | 'NARROWED' | 'OBSTRUCTED' | 'REPRESSED' | 'CLOSED';
export type BurnoutState = 'steady' | 'strained' | 'burnt';

export type FrontId =
  | 'WAR'
  | 'CLIMATE'
  | 'RIGHTS'
  | 'SPEECH_INFO'
  | 'POVERTY'
  | 'ENERGY'
  | 'CULTURE';

export type RegionId =
  | 'MENA'
  | 'SubSaharanAfrica'
  | 'SouthAsia'
  | 'SoutheastAsia'
  | 'LatinAmerica'
  | 'Europe'
  | 'NorthAmerica'
  | 'PacificIslands';

export type RoleId =
  | 'organizer'
  | 'investigative_journalist'
  | 'human_rights_lawyer'
  | 'climate_energy_planner';

export type ResourceType = 'solidarity' | 'evidence' | 'capacity' | 'relief';
export type TokenType = 'displacement' | 'disinfo' | 'compromise_debt';
export type LockType = 'AidAccess' | 'Censorship' | 'Surveillance';
export type InstitutionType =
  | 'MutualAidHub'
  | 'IndependentMediaNetwork'
  | 'LegalClinic'
  | 'CommunityMicrogrid';
export type InstitutionStatus = 'active' | 'damaged' | 'destroyed';
export type DeckId = 'capture' | 'crisis' | 'culture';
export type CardMode = 'BOTH' | 'CORE' | 'FULL';
export type HookName =
  | 'on_round_start'
  | 'on_world_phase_pre'
  | 'on_capture_card_resolve'
  | 'on_crisis_resolve'
  | 'on_player_action'
  | 'on_compromise_offer'
  | 'on_end_phase'
  | 'on_check_win_loss';
export type TargetKind = 'NONE' | 'REGION' | 'FRONT';
export type FrontStat = 'pressure' | 'protection' | 'impact';

export const CIVIC_SPACE_ORDER: CivicSpace[] = [
  'OPEN',
  'NARROWED',
  'OBSTRUCTED',
  'REPRESSED',
  'CLOSED',
];

export interface Clamp {
  min?: number;
  max?: number;
}

export type PlayerSelector = 'acting_player' | 'target_player' | number;
export type RegionSelector = RegionId | 'target_region' | 'ANY';
export type FrontSelector = FrontId | 'target_front';
export type FlagScope = 'scenario' | 'round';
export type FlagValue = boolean | number | string;

export type ValueRef =
  | { type: 'temperature' }
  | { type: 'civic_space_index' }
  | { type: 'resource'; resource: ResourceType }
  | { type: 'front_stat'; front: FrontId; stat: FrontStat }
  | { type: 'player_burnout'; player: PlayerSelector }
  | { type: 'player_actions_remaining'; player: PlayerSelector }
  | { type: 'flag'; scope: FlagScope; key: string };

export type Condition =
  | {
      kind: 'compare';
      left: ValueRef;
      op: '>' | '>=' | '<' | '<=' | '==' | '!=';
      right: number | string | boolean | ValueRef;
    }
  | { kind: 'all'; conditions: Condition[] }
  | { kind: 'any'; conditions: Condition[] }
  | { kind: 'not'; condition: Condition }
  | {
      kind: 'tokenCount';
      region: RegionSelector;
      token: TokenType;
      op: '>' | '>=' | '<' | '<=' | '==' | '!=';
      count: number;
    }
  | { kind: 'hasLock'; region: RegionSelector; lock: LockType }
  | { kind: 'phaseIs'; phase: Phase }
  | { kind: 'modeIs'; mode: GameMode }
  | { kind: 'flagIs'; scope: FlagScope; key: string; value: FlagValue }
  | { kind: 'frontCollapsed'; front: FrontId };

export type Effect =
  | { type: 'modify_track'; target: ValueRef; delta: number; clamp?: Clamp }
  | { type: 'modify_front_stat'; front: FrontSelector; stat: FrontStat; delta: number; clamp?: Clamp }
  | { type: 'add_token'; region: RegionSelector; token: TokenType; count: number }
  | { type: 'remove_token'; region: RegionSelector; token: TokenType; count: number }
  | { type: 'add_lock'; region: RegionSelector; lock: LockType }
  | { type: 'remove_lock'; region: RegionSelector; lock: LockType }
  | { type: 'spend_resource'; resource: ResourceType; amount: number }
  | { type: 'gain_resource'; resource: ResourceType; amount: number }
  | { type: 'conditional'; if: Condition; then: Effect[]; else?: Effect[] }
  | { type: 'choice'; prompt: string; choiceType?: 'compromise'; options: ChoiceOptionDefinition[] }
  | { type: 'delayed_effect'; afterRounds: number; effects: Effect[]; description: string }
  | { type: 'log'; emoji: string; message: string }
  | { type: 'set_flag'; scope: FlagScope; key: string; value: FlagValue }
  | { type: 'draw_from_deck'; deck: DeckId; count: number }
  | { type: 'ensure_institution'; region: RegionSelector; institution: InstitutionType; status?: InstitutionStatus }
  | { type: 'damage_institution'; region: RegionSelector; institution?: InstitutionType }
  | { type: 'repair_institution'; region: RegionSelector; institution: InstitutionType }
  | { type: 'add_charter_progress'; amount: number }
  | { type: 'ratify_first_available_charter'; fallbackProgress: number };

export interface ChoiceOptionDefinition {
  id: string;
  label: string;
  description: string;
  effects: Effect[];
}

export interface ActionDefinition {
  id: string;
  roleId: RoleId | 'shared';
  name: string;
  description: string;
  targetKind: TargetKind;
  targetLabel?: string;
  resolvePriority: number;
  publicAction?: boolean;
  cultureAction?: boolean;
  journalismAction?: boolean;
  antiDisinfoAction?: boolean;
  bypassesCensorship?: boolean;
  mode?: CardMode;
  burnoutCost?: number;
  resourceCosts?: Partial<Record<ResourceType, number>>;
  disabledWhen?: Condition[];
  effects: Effect[];
}

export interface RoleDefinition {
  id: RoleId;
  name: string;
  shortName: string;
  passive: string;
  burnoutMax: number;
  actionsPerTurn: Record<GameMode, number>;
  actionIds: string[];
  breakthroughActionIds: string[];
}

export interface FrontDefinition {
  id: FrontId;
  name: string;
  initial: {
    pressure: number;
    protection: number;
    impact: number;
  };
  collapseConditions: Condition[];
  couplingRuleIds: string[];
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  vulnerability: Partial<Record<FrontId, number>>;
}

export interface InstitutionDefinition {
  id: InstitutionType;
  name: string;
  description: string;
  roleId: RoleId;
}

export interface CharterClauseDefinition {
  id: string;
  title: string;
  description: string;
  prerequisites: Condition[];
  ratifyEffects: Effect[];
}

export interface CardDefinition {
  id: string;
  deck: DeckId;
  name: string;
  text: string;
  mode: CardMode;
  tags: string[];
  emoji: string;
  pillar?: 'EXTRACTION' | 'MILITARIZATION' | 'CONTROL' | 'MANUFACTURED_CONSENT';
  effects: Effect[];
}

export interface RuleDefinition {
  id: string;
  hook: HookName;
  when?: Condition;
  emoji: string;
  message: string;
  effects: Effect[];
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  introduction: string;
  story: string;
  dramatization: string;
  gameplay: string;
  mechanics: string;
  moralCenter: string;
  setup: {
    civicSpace: CivicSpace;
    temperature: number;
    resources: Record<ResourceType, number>;
    frontOverrides: Partial<Record<FrontId, Partial<Record<FrontStat, number>>>>;
    regionOverrides: Partial<
      Record<
        RegionId,
        {
          tokens?: Partial<Record<TokenType, number>>;
          locks?: LockType[];
          institutions?: Array<{ institution: InstitutionType; status?: InstitutionStatus }>;
          vulnerability?: Partial<Record<FrontId, number>>;
        }
      >
    >;
  };
  specialRuleChips: Array<{
    id: string;
    label: string;
    description: string;
    flagKey?: string;
  }>;
  roundLimit: Record<GameMode, number>;
  hooks: RuleDefinition[];
}

export interface ExpansionDefinition {
  id: string;
  name: string;
  enabledByDefault: boolean;
  actions?: ActionDefinition[];
  cards?: CardDefinition[];
  hooks?: RuleDefinition[];
}

export interface PackDefinition {
  id: string;
  type: 'base' | 'scenario' | 'expansion';
  version: string;
  dependsOn?: string[];
  fronts?: FrontDefinition[];
  regions?: RegionDefinition[];
  institutions?: InstitutionDefinition[];
  charter?: CharterClauseDefinition[];
  roles?: RoleDefinition[];
  actions?: ActionDefinition[];
  cards?: CardDefinition[];
  hooks?: RuleDefinition[];
  scenario?: ScenarioDefinition;
  expansion?: ExpansionDefinition;
}

export interface CompiledContent {
  version: string;
  fronts: Record<FrontId, FrontDefinition>;
  regions: Record<RegionId, RegionDefinition>;
  institutions: Record<InstitutionType, InstitutionDefinition>;
  charter: Record<string, CharterClauseDefinition>;
  roles: Record<RoleId, RoleDefinition>;
  actions: Record<string, ActionDefinition>;
  cards: Record<string, CardDefinition>;
  decks: Record<DeckId, string[]>;
  hooks: Record<HookName, RuleDefinition[]>;
  scenario: ScenarioDefinition;
  expansions: ExpansionDefinition[];
}

export interface FrontState {
  id: FrontId;
  pressure: number;
  protection: number;
  impact: number;
  collapsed: boolean;
}

export interface InstitutionInstance {
  type: InstitutionType;
  status: InstitutionStatus;
  preventedThisRound: boolean;
  threatenedThisRound: boolean;
}

export interface RegionState {
  id: RegionId;
  vulnerability: Partial<Record<FrontId, number>>;
  tokens: Record<TokenType, number>;
  locks: LockType[];
  institutions: InstitutionInstance[];
}

export interface ActionTarget {
  kind: TargetKind;
  regionId?: RegionId;
  frontId?: FrontId;
}

export interface QueuedIntent {
  slot: number;
  actionId: string;
  target: ActionTarget;
}

export interface PlayerState {
  seat: number;
  roleId: RoleId;
  burnout: number;
  burnoutState: BurnoutState;
  maxBurnout: number;
  actionsRemaining: number;
  ready: boolean;
  queuedIntents: QueuedIntent[];
  privateHints: string[];
}

export interface DeckState {
  drawPile: string[];
  discardPile: string[];
}

export interface StagedWorldPhase {
  captureCardId: string | null;
  crisisCardIds: string[];
  activeCrisisId: string | null;
  band: number;
  status: 'idle' | 'drawn';
}

export interface CharterClauseState {
  id: string;
  status: 'locked' | 'unlocked' | 'ratified';
  progress: number;
}

export interface ActiveCompromise {
  id: string;
  prompt: string;
  sourceId: string;
  options: ChoiceOptionDefinition[];
  votes: Record<number, boolean>;
}

export interface DelayedEffectState {
  id: string;
  afterRounds: number;
  description: string;
  effects: Effect[];
  causedBy: string[];
}

export interface StateDelta {
  kind:
    | 'track'
    | 'front'
    | 'resource'
    | 'token'
    | 'lock'
    | 'institution'
    | 'flag'
    | 'charter'
    | 'player';
  label: string;
  before: number | string | boolean | null;
  after: number | string | boolean | null;
}

export interface EffectTrace {
  effectType: Effect['type'];
  status: 'executed' | 'skipped' | 'failed';
  message: string;
  causedBy: string[];
  deltas: StateDelta[];
}

export interface DomainEvent {
  seq: number;
  round: number;
  phase: Phase;
  sourceType: 'system' | 'command' | 'card' | 'action' | 'rule' | 'compromise' | 'hook';
  sourceId: string;
  emoji: string;
  message: string;
  causedBy: string[];
  deltas: StateDelta[];
  trace: EffectTrace[];
}

export interface RngState {
  seed: number;
  state: number;
  calls: number;
}

export interface DebugState {
  climateRoll: number | null;
  lastCaptureCards: string[];
  lastCrisisCards: string[];
  lastCrisisCount: number;
  firedRuleIds: string[];
}

export interface EngineState {
  seed: number;
  rng: RngState;
  mode: GameMode;
  scenarioId: string;
  round: number;
  roundLimit: number;
  phase: Phase;
  civicSpace: CivicSpace;
  temperature: number;
  resources: Record<ResourceType, number>;
  globalTokens: Record<string, number>;
  fronts: Record<FrontId, FrontState>;
  regions: Record<RegionId, RegionState>;
  players: PlayerState[];
  decks: Record<DeckId, DeckState>;
  stagedWorldPhase: StagedWorldPhase;
  charter: Record<string, CharterClauseState>;
  charterProgress: number;
  scenarioFlags: Record<string, FlagValue>;
  roundFlags: Record<string, FlagValue>;
  delayedEffects: DelayedEffectState[];
  activeCompromise: ActiveCompromise | null;
  commandLog: EngineCommand[];
  eventLog: DomainEvent[];
  endingTier: string | null;
  lossReason: string | null;
  debug: DebugState;
}

export type EngineCommand =
  | {
      type: 'StartGame';
      scenarioId: string;
      mode: GameMode;
      playerCount: 2 | 3 | 4;
      roleIds: RoleId[];
      seed: number;
      expansionIds?: string[];
    }
  | {
      type: 'QueueIntent';
      seat: number;
      actionId: string;
      target: ActionTarget;
    }
  | { type: 'RemoveQueuedIntent'; seat: number; slot: number }
  | { type: 'ReorderQueuedIntent'; seat: number; fromSlot: number; toSlot: number }
  | { type: 'SetReady'; seat: number; ready: boolean }
  | { type: 'DrawWorldCards' }
  | { type: 'AdoptResolution' }
  | { type: 'ResolveWorldPhase' }
  | { type: 'CommitCoalitionIntent' }
  | { type: 'VoteCompromise'; seat: number; accept: boolean }
  | { type: 'ResolveEndPhase' }
  | { type: 'SaveSnapshot' }
  | { type: 'LoadSnapshot'; payload: SerializedGame };

export interface SerializedGame {
  contentVersion: string;
  scenarioId: string;
  mode: GameMode;
  seed: number;
  rngState: RngState;
  snapshot: EngineState;
  commandLog: EngineCommand[];
}

export interface EffectContext {
  actingSeat?: number;
  target?: ActionTarget;
  causedBy: string[];
  sourceTags?: string[];
}

export interface DisabledActionReason {
  actionId: string;
  disabled: boolean;
  reason?: string;
  legalTargets: ActionTarget[];
  finalCosts: Partial<Record<ResourceType, number>>;
}

export interface EndingSummary {
  tier: string;
  ratifiedClauses: number;
  activeInstitutions: number;
}
