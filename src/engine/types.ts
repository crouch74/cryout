// src/engine/types.ts

// Global Enums & Constants
export type CivicSpace = "OPEN" | "NARROWED" | "OBSTRUCTED" | "REPRESSED" | "CLOSED";

export const CivicSpace = {
    OPEN: "OPEN" as const,
    NARROWED: "NARROWED" as const,
    OBSTRUCTED: "OBSTRUCTED" as const,
    REPRESSED: "REPRESSED" as const,
    CLOSED: "CLOSED" as const,
};

export type RegionId = "MENA" | "SouthAsia" | "PacificIslands" | "SubSaharanAfrica" | "LatinAmerica" | "Europe" | "NorthAmerica" | "ANY";
export type FrontId = "WAR" | "CLIMATE" | "RIGHTS" | "SPEECH_INFO" | "POVERTY" | "ENERGY" | "CULTURE";
export type TokenType = "disinformation" | "displacement" | "compromise_debt" | "charter_progress";
export type LockType = "censorship" | "aid_access" | "surveillance";

// Effects DSL definition
export interface Effect {
    modify_track?: { target: string; delta: number; clamp?: { min: number; max: number } };
    add_token?: { region?: RegionId; target?: "global"; token_type: TokenType; count: number };
    remove_token?: { region?: RegionId; target?: "global"; token_type: TokenType; count: number };
    add_lock?: { region: RegionId; lock_type: LockType };
    remove_lock?: { region: RegionId; lock_type: LockType };
    draw_card?: { deck: string; count: number };
    choice?: {
        prompt: string;
        options: Array<{ label: string; effects: Effect[] }>;
    };
    log?: { emoji: string; message: string };
    id?: string; // For tracing
    caused_by?: string; // ID of the card/rule that triggered this
}

export interface EffectTrace {
    effect: Effect;
    status: 'executed' | 'failed' | 'skipped';
    reason?: string;
}

// Cards
export interface Card {
    id: string;
    tags?: string[];
    text: string;
    satire_level?: number;
    prerequisites?: Array<{ condition: string }>;
    effects?: Effect[];
    choice_offer?: {
        prompt: string;
        options: Array<{ label: string; effects: Effect[] }>;
    };
}

// Front Definition
export interface Front {
    id: FrontId;
    name: string;
    pressure: number;
    protection: number;
    impact: number;
}

// Institutions
export interface Institution {
    id: string;
    name: string;
    type: 'legal' | 'media' | 'energy' | 'relief' | 'organization';
    bonus_description: string;
    status: 'active' | 'damaged' | 'destroyed';
}

// Region Definition
export interface Region {
    id: RegionId;
    vulnerability: Partial<Record<FrontId, number>>;
    tokens: Partial<Record<TokenType, number>>;
    locks: LockType[];
    institutions: Institution[];
}

// Role Definition
export interface ActionDef {
    id: string;
    name: string;
    description: string;
    burnout_cost?: number;
    resource_costs?: Partial<Record<keyof GameState['resources'], number>>;
    effects: Effect[];
}

export interface PlayerRole {
    id: string;
    name: string;
    base_actions_per_turn: number;
    burnout_max: number;
    burnout_strained_threshold: number;
    passive: string;
    unique_actions: ActionDef[];
    breakthrough_action: ActionDef;
}

// Player State Instance
export interface PlayerState {
    roleId: string;
    burnout: number;
    actionsRemaining: number;
    isReady: boolean;
}

export interface PlayerIntent {
    playerId: number;
    actionId: string;
    targetId?: string; // regionId or frontId
}

export interface CharterClause {
    id: string;
    title: string;
    description: string;
    status: 'locked' | 'unlocked' | 'ratified';
    prerequisites: string[]; // Conditions
}

// Global Game State
export interface GameState {
    temperature: number;
    civic_space: CivicSpace;
    resources: {
        solidarity: number;
        evidence: number;
        capacity: number;
        relief: number;
    };
    globalTokens: Partial<Record<TokenType, number>>;

    fronts: Record<FrontId, Front>;
    regions: Record<string, Region>;

    players: PlayerState[];
    pendingIntents: PlayerIntent[];

    charter: CharterClause[];

    currentRound: number;
    phase: "WORLD" | "COALITION" | "COMPROMISE" | "END";
    scenarioId: string;

    logs: Array<{
        emoji: string;
        message: string;
        timestamp: number;
        traces?: EffectTrace[];
    }>;
}

export interface ScenarioMetadata {
    id: string;
    name: string;
    description: string;
    introduction: string;
    story: string;
    gameplay?: string;
    mechanics?: string;
    vibe_image?: string;
}

export interface Scenario extends ScenarioMetadata {
    initial_state: Partial<GameState>;
}

