// ============================================================
// Game Type Definitions — "Where the Stones Cry Out"
// ============================================================

/** The six regions of the Global South */
export type RegionName = 'Congo Basin' | 'The Levant' | 'The Amazon' | 'The Sahel' | 'The Mekong' | 'The Andes';

/** The seven resistance domains */
export type DomainName =
  | 'War Machine'
  | 'Dying Planet'
  | 'Gilded Cage'
  | 'Silenced Truth'
  | 'Empty Stomach'
  | 'Fossil Grip'
  | 'Stolen Voice';

/** The four player factions */
export type FactionId = 'forest_defenders' | 'the_sumud' | 'riverkeepers' | 'the_guardians';

/** Card deck types */
export type DeckType = 'resistance' | 'evidence' | 'crisis' | 'beacon';

/** Card subtypes */
export type CardType = 'instant' | 'action' | 'permanent';

/** Game phases */
export type GamePhase = 'setup' | 'system_extracts' | 'resistance_acts' | 'world_watches' | 'game_over';

/** Sub-phases of Phase 1: System Extracts */
export type SystemSubPhase = 'extraction_roll' | 'crisis_card' | 'war_machine_check';

/** Player actions during Phase 2 */
export type ActionType =
  | 'organize'
  | 'investigate'
  | 'launch_campaign'
  | 'build_solidarity'
  | 'smuggle_evidence'
  | 'international_outreach'
  | 'defend'
  | 'play_resistance_card';

/** Victory mode */
export type VictoryMode = 'liberation' | 'symbolic';

/** Game end result */
export type GameResult = 'victory' | 'defeat' | 'in_progress';

/** Defeat reason */
export type DefeatReason =
  | 'region_overwhelmed'    // 6 extraction tokens
  | 'movement_crushed'      // 0 bodies at end of phase 3
  | 'crisis_exhausted';     // Crisis deck empty

// ============================================================
// Card Interfaces
// ============================================================

export interface Card {
  id: string;
  name: string;
  deck: DeckType;
  type: CardType;
  region?: RegionName | 'any';
  effect: string;
  flavorText: string;
  /** For evidence cards: bonus to campaign rolls */
  campaignBonus?: number;
  /** For evidence cards: specific domain bonus */
  domainBonus?: DomainName;
  /** For crisis cards: bodies to remove */
  bodiesLost?: number;
  /** For crisis cards: tokens to add if no bodies */
  tokensAdded?: number;
}

// ============================================================
// Player & Faction
// ============================================================

export interface FactionData {
  id: FactionId;
  name: string;
  displayName: string;
  homeRegion: RegionName;
  color: string;
  themeColor: string;
  startingBodies: number;
  startingEvidence: number;
  ability: string;
  abilityName: string;
  weakness: string;
  weaknessName: string;
  mandate: string;
  patternStyle: string;
}

export interface Player {
  id: number;
  faction: FactionData;
  bodies: number;
  evidenceHand: Card[];
  resistanceHand: Card[];
  permanentCards: Card[];
  actionsRemaining: number;
  defenseRatings: Partial<Record<RegionName, number>>;
  /** Track mandate progress */
  mandateProgress: number;
  /** Regions where this player has a faction token placed this turn */
  tokenPlacement: RegionName | null;
}

// ============================================================
// Region & Board
// ============================================================

export interface Region {
  name: RegionName;
  extractionTokens: number;
  maxTokens: number;
  /** Bodies placed in this region by each player */
  bodiesPresent: Record<number, number>;
  /** Defense ratings active this round */
  defenseRating: number;
  /** Icons representing the region's struggles */
  icons: string[];
  description: string;
}

// ============================================================
// Game State
// ============================================================

export interface GameState {
  // Core state
  round: number;
  phase: GamePhase;
  systemSubPhase?: SystemSubPhase;
  currentPlayerIndex: number;
  turnOrder: number[];
  result: GameResult;
  defeatReason?: DefeatReason;
  victoryMode: VictoryMode;

  // Players
  players: Player[];

  // Board
  regions: Record<RegionName, Region>;

  // Global tracks
  globalGaze: number;
  northernWarMachine: number;
  domainTracks: Record<DomainName, number>;

  // Decks
  resistanceDeck: Card[];
  evidenceDeck: Card[];
  crisisDeck: Card[];
  beaconDeck: Card[];
  discardPiles: Record<DeckType, Card[]>;

  // Event log
  eventLog: GameEvent[];

  // Scenario-specific flags
  gazeReached10: boolean; // Special crisis trigger

  // Extraction roll results for current phase (for UI display)
  currentExtractionResults?: Record<RegionName, number>;
  currentCrisisCard?: Card;
  currentInterventionResult?: InterventionResult;
}

export interface InterventionResult {
  region: RegionName;
  casualties: number;
  defenseReduction: number;
  actualCasualties: number;
}

export interface CampaignResult {
  success: boolean;
  roll: number;
  modifiers: CampaignModifiers;
  totalScore: number;
  target: number;
  bodiesCommitted: number;
  bodiesLost: number;
  domain: DomainName;
  region: RegionName;
  evidencePlayed: Card[];
}

export interface CampaignModifiers {
  bodiesBonus: number;
  evidenceBonus: number;
  gazeBonus: number;
  tokenPenalty: number;
  warMachinePenalty: number;
  total: number;
}

export interface GameEvent {
  id: string;
  round: number;
  phase: GamePhase;
  message: string;
  timestamp: number;
  type: 'info' | 'crisis' | 'success' | 'failure' | 'warning' | 'system';
}

// ============================================================
// Action Parameters
// ============================================================

export interface OrganizeParams {
  region: RegionName;
}

export interface InvestigateParams {
  region: RegionName;
}

export interface LaunchCampaignParams {
  region: RegionName;
  domain: DomainName;
  bodiesCommitted: number;
  evidenceCardIds: string[];
}

export interface BuildSolidarityParams {
  region: RegionName;
  domain: DomainName;
}

export interface SmuggleEvidenceParams {
  targetPlayerId: number;
  cardIds: string[];
}

export interface DefendParams {
  region: RegionName;
  bodiesSpent: number;
}

export interface PlayResistanceCardParams {
  cardId: string;
  targetRegion?: RegionName;
}

export type ActionParams =
  | { type: 'organize'; params: OrganizeParams }
  | { type: 'investigate'; params: InvestigateParams }
  | { type: 'launch_campaign'; params: LaunchCampaignParams }
  | { type: 'build_solidarity'; params: BuildSolidarityParams }
  | { type: 'smuggle_evidence'; params: SmuggleEvidenceParams }
  | { type: 'international_outreach' }
  | { type: 'defend'; params: DefendParams }
  | { type: 'play_resistance_card'; params: PlayResistanceCardParams };
