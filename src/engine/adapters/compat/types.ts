export type VictoryMode = 'LIBERATION' | 'SYMBOLIC';
export type Phase = 'SYSTEM' | 'COALITION' | 'RESOLUTION' | 'WIN' | 'LOSS';

export type DomainId =
  | 'WarMachine'
  | 'DyingPlanet'
  | 'GildedCage'
  | 'SilencedTruth'
  | 'EmptyStomach'
  | 'FossilGrip'
  | 'StolenVoice'
  | 'RevolutionaryWave'
  | 'PatriarchalGrip'
  | 'UnfinishedJustice';

export type RegionId =
  | 'Congo'
  | 'Levant'
  | 'Amazon'
  | 'Sahel'
  | 'Mekong'
  | 'Andes'
  | 'Cairo'
  | 'Alexandria'
  | 'NileDelta'
  | 'UpperEgypt'
  | 'Suez'
  | 'Sinai'
  | 'Tehran'
  | 'Kurdistan'
  | 'Isfahan'
  | 'Mashhad'
  | 'Khuzestan'
  | 'Balochistan'
  | 'Algiers'
  | 'KabylieMountains'
  | 'Oran'
  | 'SaharaSouth'
  | 'TunisianBorder'
  | 'FrenchMetropoleInfluence';

export type FactionId =
  | 'congo_basin_collective'
  | 'levant_sumud'
  | 'mekong_echo_network'
  | 'amazon_guardians'
  | 'april_6_youth'
  | 'labor_movement'
  | 'independent_journalists'
  | 'rights_defenders'
  | 'kurdish_women'
  | 'student_union'
  | 'diaspora_coalition'
  | 'bazaar_strikers'
  | 'male_allies'
  | 'fln_urban_cells'
  | 'kabyle_maquis'
  | 'rural_organizing_committees'
  | 'border_solidarity_networks';

export type DeckId = 'system' | 'resistance' | 'crisis';
export type RevealDeckId = DeckId | 'beacon';
export type SystemEscalationTriggerId =
  | 'extraction_threshold'
  | 'war_machine_threshold'
  | 'gaze_threshold'
  | 'failed_campaigns'
  | 'symbolic_round_six';
export type ResistanceCardType = 'action' | 'support';
export type ActionId =
  | 'organize'
  | 'investigate'
  | 'launch_campaign'
  | 'build_solidarity'
  | 'smuggle_evidence'
  | 'international_outreach'
  | 'defend'
  | 'play_card'
  | 'go_viral'
  | 'expose_regime_lies'
  | 'call_labor_strike'
  | 'diaspora_fundraise'
  | 'media_blitz'
  | 'sanctions_push'
  | 'burn_veil'
  | 'schoolgirl_network'
  | 'compose_chant'
  | 'coordinate_digital';

export interface Clamp {
  min?: number;
  max?: number;
}

export interface DomainDefinition {
  id: DomainId;
  name: string;
  description: string;
  initialProgress: number;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  description: string;
  strapline: string;
  vulnerability: Partial<Record<DomainId, number>>;
}

export interface ConditionCompareLeft {
  type:
  | 'global_gaze'
  | 'northern_war_machine'
  | 'round'
  | 'domain_progress'
  | 'region_extraction'
  | 'player_evidence'
  | 'player_total_bodies'
  | 'custom_track'
  | 'scenario_flag';
  domain?: DomainId;
  region?: RegionId;
  player?: 'seat_owner' | number;
  track?: string;
  flag?: string;
}

export type Condition =
  | {
    kind: 'compare';
    left: ConditionCompareLeft;
    op: '>' | '>=' | '<' | '<=' | '==' | '!=';
    right: number;
  }
  | {
    kind: 'all';
    conditions: Condition[];
  }
  | {
    kind: 'any';
    conditions: Condition[];
  }
  | {
    kind: 'not';
    condition: Condition;
  }
  | {
    kind: 'every_region_extraction_at_most';
    count: number;
  }
  | {
    kind: 'all_active_beacons_complete';
  };

export interface MandateDefinition {
  id: string;
  title: string;
  description: string;
  condition: Condition;
}

export interface FactionDefinition {
  id: FactionId;
  name: string;
  shortName: string;
  homeRegion: RegionId;
  passive: string;
  weakness: string;
  organizeBonus: number;
  investigateBonus: number;
  defenseBonus: number;
  campaignDomainBonus?: DomainId;
  campaignBonus: number;
  outreachPenalty: number;
  mandate: MandateDefinition;
}

export interface BeaconDefinition {
  id: string;
  title: string;
  description: string;
  condition: Condition;
}

export type SeatSelector = 'acting_player' | number;
export type RegionSelector = RegionId | { byVulnerability: DomainId } | 'target_region';
export type DomainSelector = DomainId | 'target_domain';

export type Effect =
  | { type: 'modify_gaze'; delta: number; clamp?: Clamp }
  | { type: 'modify_war_machine'; delta: number; clamp?: Clamp }
  | { type: 'modify_domain'; domain: DomainSelector; delta: number; clamp?: Clamp }
  | { type: 'modify_custom_track'; trackId: string; delta: number; clamp?: Clamp }
  | { type: 'add_extraction'; region: RegionSelector; amount: number }
  | { type: 'remove_extraction'; region: RegionSelector; amount: number }
  | { type: 'add_bodies'; region: RegionSelector; seat: SeatSelector; amount: number }
  | { type: 'remove_bodies'; region: RegionSelector; seat: SeatSelector; amount: number }
  | { type: 'gain_evidence'; seat: SeatSelector; amount: number }
  | { type: 'lose_evidence'; seat: SeatSelector; amount: number }
  | { type: 'set_defense'; region: RegionSelector; amount: number }
  | { type: 'draw_resistance'; seat: SeatSelector; count: number }
  | { type: 'modify_hijab'; region: RegionSelector; delta: number }
  | { type: 'set_scenario_flag'; flag: string; value: boolean }
  | { type: 'open_replanning' }
  | { type: 'log'; message: string };

export interface ResistanceCardDefinition {
  id: string;
  deck: 'resistance';
  type: ResistanceCardType;
  name: string;
  text: string;
  campaignBonus?: number;
  domainBonus?: DomainId;
  regionBonus?: RegionId | 'ANY';
  effects?: Effect[];
}

export interface CrisisCardDefinition {
  id: string;
  deck: 'crisis';
  name: string;
  text: string;
  effects: Effect[];
}

export interface SystemPersistentModifiers {
  campaignTargetDelta?: number;
  campaignModifierDelta?: number;
  outreachCostDelta?: number;
  resistanceDrawDelta?: number;
  crisisDrawDelta?: number;
  crisisExtractionBonus?: number;
}

export interface SystemCardDefinition {
  id: string;
  deck: 'system';
  name: string;
  text: string;
  onReveal: Effect[];
  persistentModifiers?: SystemPersistentModifiers;
}

export interface ActionDefinition {
  id: ActionId;
  name: string;
  description: string;
  resolvePriority: number;
  needsRegion?: boolean;
  needsDomain?: boolean;
  needsTargetSeat?: boolean;
  needsBodies?: boolean;
  needsEvidence?: boolean;
  needsCard?: boolean;
  cardType?: ResistanceCardType;
}

export interface MapViewport {
  canvasWidth: string;
  canvasHeight: string;
  canvasLeft: string;
  canvasTop: string;
}

export interface BoardRegionMapEntry {
  regionId: RegionId;
  label: string;
  marker: {
    x: string;
    y: string;
  };
  tokenAnchor: {
    x: string;
    y: string;
  };
  anchorBias: {
    x: number;
    y: number;
  };
  clusterRadius: number;
  labelOffsetY: number;
  opticalCenteringByTokenType: Record<'extraction' | 'defense' | 'bodies', { x: number; y: number }>;
  labelOffset: {
    x: string;
    y: string;
  };
  tooltipOffset: {
    x: string;
    y: string;
  };
  territoryTilt: string;
  accent: string;
  searchTerms: string[];
  focusDomains: DomainId[];
  anchorCoverage: string[];
  interactionCoverage: string[];
  svgCoverage: string[];
  note: string;
}

export interface ScenarioBoardDefinition {
  assetPath: string;
  sourceViewBox: string;
  viewport: MapViewport;
  regions: Partial<Record<RegionId, BoardRegionMapEntry>>;
  svgIdConvention?: string;
}

export interface RulesetDefinition {
  id: string;
  name: string;
  description: string;
  introduction: string;
  board: ScenarioBoardDefinition;
  regions: RegionDefinition[];
  domains: DomainDefinition[];
  factions: FactionDefinition[];
  beacons: BeaconDefinition[];
  actions: ActionDefinition[];
  resistanceCards: ResistanceCardDefinition[];
  crisisCards: CrisisCardDefinition[];
  systemCards: SystemCardDefinition[];
  liberationThreshold: number;
  suddenDeathRound: number;
  setup?: {
    globalGaze: number;
    northernWarMachine: number;
    extractionPool?: number;
    extractionSeeds: Partial<Record<RegionId, number>>;
    regionHijabEnforcement?: Partial<Record<RegionId, number>>;
  };
  customTracks?: Array<{
    id: string;
    name: string;
    description: string;
    initialValue: number;
    min: number;
    max: number;
    thresholds: number[];
  }>;
  specialRules?: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  scenarioFlags?: string[];
  scenarioHooks?: {
    evidenceGainRaisesRepression?: boolean;
    evidenceGainRepressionDelta?: number;
    urbanCampaignRegions?: RegionId[];
    successfulUrbanCampaignWarMachineDelta?: number;
    thresholdRules?: Array<{
      trackId: string;
      threshold: number;
      once: boolean;
      effects: Effect[];
    }>;
    maxTrackRoundPenalty?: {
      trackId: string;
      effects: Effect[];
    };
  };
  victoryConditions?: {
    liberation?: Condition;
    symbolic?: Condition;
  };
}

export interface CompiledContent {
  version: string;
  ruleset: RulesetDefinition;
  actions: Record<ActionId, ActionDefinition>;
  domains: Record<DomainId, DomainDefinition>;
  regions: Record<RegionId, RegionDefinition>;
  factions: Record<FactionId, FactionDefinition>;
  beacons: Record<string, BeaconDefinition>;
  cards: Record<string, ResistanceCardDefinition | CrisisCardDefinition | SystemCardDefinition>;
  decks: Record<DeckId, string[]>;
}

export interface DomainState {
  id: DomainId;
  progress: number;
}

export interface RegionState {
  id: RegionId;
  extractionTokens: number;
  vulnerability: Partial<Record<DomainId, number>>;
  defenseRating: number;
  bodiesPresent: Record<number, number>;
  hijabEnforcement: number;
}

export interface QueuedIntent {
  slot: number;
  actionId: ActionId;
  regionId?: RegionId;
  domainId?: DomainId;
  targetSeat?: number;
  bodiesCommitted?: number;
  evidenceCommitted?: number;
  cardId?: string;
}

export interface PlayerState {
  seat: number;
  ownerId: number;
  factionId: FactionId;
  evidence: number;
  actionsRemaining: number;
  ready: boolean;
  queuedIntents: QueuedIntent[];
  resistanceHand: string[];
  mandateId: string;
  mandateRevealed: boolean;
}

export interface DeckState {
  drawPile: string[];
  discardPile: string[];
}

export interface CardRevealEvent {
  deckId: RevealDeckId;
  cardId: string;
  destination: 'discard' | 'hand' | 'active';
  seat?: number;
  public: boolean;
  origin: 'startup_withdrawal' | 'investigate' | 'system_phase' | 'beacon_activation' | 'played_action_card' | 'other';
}

export interface RollResolution {
  actionId: 'launch_campaign';
  seat: number;
  regionId: RegionId;
  domainId: DomainId;
  dice: [number, number];
  modifier: number;
  total: number;
  target: number;
  success: boolean;
  outcomeBand: 'backlash' | 'attention' | 'success' | 'surge';
  extractionRemoved: number;
  domainDelta: number;
  globalGazeDelta: number;
  warMachineDelta: number;
}

export interface CampaignModifierEntry {
  source:
  | 'committed_comrades'
  | 'committed_evidence'
  | 'global_gaze'
  | 'war_machine'
  | 'home_region'
  | 'faction_domain'
  | 'support'
  | 'system_pressure';
  value: number;
}

export interface CampaignResolvedEventPayload {
  eventSeq: number;
  actionId: 'launch_campaign';
  seat: number;
  regionId: RegionId;
  domainId: DomainId;
  diceKind: '2d6';
  dice: [number, number];
  modifier: number;
  modifiers: CampaignModifierEntry[];
  total: number;
  target: number;
  success: boolean;
  outcomeBand: 'backlash' | 'attention' | 'success' | 'surge';
  extractionRemoved: number;
  domainDelta: number;
  globalGazeDelta: number;
  warMachineDelta: number;
  committedBodies?: number;
  committedEvidence?: number;
}

export interface BeaconState {
  id: string;
  active: boolean;
  complete: boolean;
}

export type TerminalOutcomeKind = 'victory' | 'defeat';
export type TerminalOutcomeCause =
  | 'liberation'
  | 'symbolic'
  | 'extraction_breach'
  | 'mandate_failure'
  | 'comrades_exhausted'
  | 'sudden_death';

export interface TerminalOutcomeSummary {
  kind: TerminalOutcomeKind;
  cause: TerminalOutcomeCause;
  title: string;
  summary: string;
  round: number;
  triggeredByEventSeq: number | null;
  breachedRegionId?: RegionId;
  failedMandateSeatIds?: number[];
  failedMandateIds?: string[];
  exhaustedSeat?: number;
}

export interface StateDelta {
  kind: 'track' | 'domain' | 'extraction' | 'bodies' | 'evidence' | 'defense' | 'card' | 'player' | 'hijab';
  label: string;
  before: number | string | boolean | null;
  after: number | string | boolean | null;
}

export interface EffectTrace {
  effectType: Effect['type'] | ActionId | 'system_phase' | 'resolution_phase';
  status: 'executed' | 'skipped' | 'failed';
  message: string;
  causedBy: string[];
  deltas: StateDelta[];
}

export interface DomainEvent {
  seq: number;
  round: number;
  phase: Phase;
  sourceType: 'system' | 'command' | 'action' | 'card' | 'mandate' | 'beacon';
  sourceId: string;
  emoji: string;
  message: string;
  causedBy: string[];
  deltas: StateDelta[];
  trace: EffectTrace[];
  context?: {
    actingSeat?: number;
    targetRegionId?: RegionId;
    targetDomainId?: DomainId;
    sourceDeckId?: RevealDeckId;
    actionId?: ActionId;
    readyState?: boolean;
    committedBodies?: number;
    committedEvidence?: number;
    campaignModifiers?: CampaignModifierEntry[];
    cardReveals?: CardRevealEvent[];
    roll?: RollResolution;
    causedBy?: string[];
  };
}

export interface RngState {
  seed: number;
  state: number;
  calls: number;
}

export interface EngineState {
  version: string;
  seed: number;
  rng: RngState;
  rulesetId: string;
  mode: VictoryMode;
  round: number;
  phase: Phase;
  extractionPool: number;
  globalGaze: number;
  northernWarMachine: number;
  customTracks: Record<string, {
    id: string;
    value: number;
    min: number;
    max: number;
    thresholds: number[];
  }>;
  domains: Record<DomainId, DomainState>;
  regions: Record<RegionId, RegionState>;
  players: PlayerState[];
  decks: Record<DeckId, DeckState>;
  beacons: Record<string, BeaconState>;
  activeBeaconIds: string[];
  activeSystemCardIds: string[];
  usedSystemEscalationTriggers: Record<SystemEscalationTriggerId, boolean>;
  failedCampaigns: number;
  lastSystemCardIds: string[];
  publicAttentionEvents: string[];
  commandLog: EngineCommand[];
  eventLog: DomainEvent[];
  winner: string | null;
  lossReason: string | null;
  terminalOutcome: TerminalOutcomeSummary | null;
  mandatesResolved: boolean;
  tahrirEmptyRounds: number;
  tahrirMartyrCount: number;
  scenarioFlags: Record<string, boolean>;
  triggeredScenarioThresholds: Record<string, boolean>;
}

export interface StartGameCommand {
  type: 'StartGame';
  rulesetId: string;
  mode: VictoryMode;
  humanPlayerCount?: 2 | 3 | 4;
  seatFactionIds?: FactionId[];
  seatOwnerIds?: number[];
  playerCount?: 2 | 3 | 4;
  factionIds?: FactionId[];
  seed: number;
}

export interface QueueIntentCommand {
  type: 'QueueIntent';
  seat: number;
  action: Omit<QueuedIntent, 'slot'>;
}

export interface RemoveQueuedIntentCommand {
  type: 'RemoveQueuedIntent';
  seat: number;
  slot: number;
}

export interface ReorderQueuedIntentCommand {
  type: 'ReorderQueuedIntent';
  seat: number;
  fromSlot: number;
  toSlot: number;
}

export interface SetReadyCommand {
  type: 'SetReady';
  seat: number;
  ready: boolean;
}

export interface ResolveSystemPhaseCommand {
  type: 'ResolveSystemPhase';
}

export interface CommitCoalitionIntentCommand {
  type: 'CommitCoalitionIntent';
}

export interface ResolveResolutionPhaseCommand {
  type: 'ResolveResolutionPhase';
}

export interface SaveSnapshotCommand {
  type: 'SaveSnapshot';
}

export interface LoadSnapshotCommand {
  type: 'LoadSnapshot';
  payload: SerializedGame;
}

export type EngineCommand =
  | StartGameCommand
  | QueueIntentCommand
  | RemoveQueuedIntentCommand
  | ReorderQueuedIntentCommand
  | SetReadyCommand
  | ResolveSystemPhaseCommand
  | CommitCoalitionIntentCommand
  | ResolveResolutionPhaseCommand
  | SaveSnapshotCommand
  | LoadSnapshotCommand;

export interface SerializedGame {
  contentVersion: string;
  rulesetId: string;
  mode: VictoryMode;
  seed: number;
  rngState: RngState;
  snapshot: EngineState;
  commandLog: EngineCommand[];
}

export interface DisabledActionReason {
  actionId: ActionId;
  disabled: boolean;
  reasonCode?:
  | 'unknown_seat'
  | 'phase_locked'
  | 'seat_already_ready'
  | 'no_actions_remaining'
  | 'select_region'
  | 'select_domain'
  | 'select_another_seat'
  | 'need_three_bodies'
  | 'not_enough_evidence'
  | 'no_evidence_to_move'
  | 'need_one_body'
  | 'commit_one_body'
  | 'not_enough_bodies'
  | 'support_card_unavailable'
  | 'action_card_unavailable'
  | 'select_card';
  reasonValues?: Record<string, string | number>;
  reason?: string;
}
