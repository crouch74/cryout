// ============================================================
// Game Constants — "Where the Stones Cry Out"
// ============================================================

import type { FactionData, FactionId, RegionName, DomainName, Region } from './types';

// ============================================================
// Color Palette
// ============================================================
export const COLORS = {
    earthRed: '#8B3A3A',
    ochre: '#CC9C6B',
    forestGreen: '#2C5F2D',
    riverBlue: '#2A7F6E',
    concreteGray: '#6A706E',
    black: '#1E1E1E',
    white: '#F4F4F4',
    silver: '#9BA7B0',
} as const;

// ============================================================
// Domain Colors & Data
// ============================================================
export const DOMAINS: Record<DomainName, { color: string; icon: string; description: string }> = {
    'War Machine': { color: COLORS.black, icon: '⚔️', description: 'Resistance to militarism, foreign bases, arms trade' },
    'Dying Planet': { color: '#5C4033', icon: '🌍', description: 'Ecological defense, reforestation, pollution resistance' },
    'Gilded Cage': { color: COLORS.white, icon: '🕊️', description: 'Human rights, prisoner freedom, anti-discrimination' },
    'Silenced Truth': { color: COLORS.concreteGray, icon: '📢', description: 'Free press, information access, anti-censorship' },
    'Empty Stomach': { color: COLORS.earthRed, icon: '🌾', description: 'Food sovereignty, land reform, debt cancellation' },
    'Fossil Grip': { color: COLORS.silver, icon: '⛽', description: 'Energy justice, renewable transition, pipeline resistance' },
    'Stolen Voice': { color: COLORS.ochre, icon: '🎭', description: 'Cultural preservation, artistic freedom, language survival' },
};

export const DOMAIN_NAMES: DomainName[] = [
    'War Machine', 'Dying Planet', 'Gilded Cage', 'Silenced Truth',
    'Empty Stomach', 'Fossil Grip', 'Stolen Voice',
];

// ============================================================
// Region Data
// ============================================================
export const REGION_NAMES: RegionName[] = [
    'Congo Basin', 'The Levant', 'The Amazon', 'The Sahel', 'The Mekong', 'The Andes',
];

export const REGION_DATA: Record<RegionName, Omit<Region, 'extractionTokens' | 'bodiesPresent' | 'defenseRating'>> = {
    'Congo Basin': {
        name: 'Congo Basin',
        maxTokens: 6,
        icons: ['⛏️', '🔪', '🐘'],
        description: 'Coltan, cobalt, conflict minerals, Chinese mines, Rwandan proxy militias',
    },
    'The Levant': {
        name: 'The Levant',
        maxTokens: 6,
        icons: ['🫒', '🔑', '🌵'],
        description: 'Illegal settlements, military bases, water aquifers under occupation',
    },
    'The Amazon': {
        name: 'The Amazon',
        maxTokens: 6,
        icons: ['🦥', '⛏️', '🐬'],
        description: 'Illegal logging, cattle ranches, gold mining, oil drilling',
    },
    'The Sahel': {
        name: 'The Sahel',
        maxTokens: 6,
        icons: ['🌳', '☢️', '🐪'],
        description: 'Uranium mines (Niger), French military bases, resource grabs',
    },
    'The Mekong': {
        name: 'The Mekong',
        maxTokens: 6,
        icons: ['🐟', '🏗️', '🌾'],
        description: 'Chinese-built dams, debt traps, plantation agriculture',
    },
    'The Andes': {
        name: 'The Andes',
        maxTokens: 6,
        icons: ['🦙', '🔋', '🏔️'],
        description: 'Lithium mines, water privatization, silver mining',
    },
};

// ============================================================
// Scenario 1: "2024—The Current Moment"
// ============================================================
export const SCENARIO_1 = {
    name: '2024—The Current Moment',
    extractionTokens: {
        'Congo Basin': 5,
        'The Levant': 5,
        'The Amazon': 4,
        'The Sahel': 3,
        'The Mekong': 4,
        'The Andes': 3,
    } as Record<RegionName, number>,
    globalGaze: 5,
    northernWarMachine: 7,
};

// ============================================================
// Faction Data
// ============================================================
export const FACTIONS: Record<FactionId, FactionData> = {
    forest_defenders: {
        id: 'forest_defenders',
        name: 'Forest Defenders',
        displayName: 'Forest Defenders',
        homeRegion: 'Congo Basin',
        color: '#2C5F2D',
        themeColor: '#2C5F2D',
        startingBodies: 8,
        startingEvidence: 4,
        ability: 'Move between regions without spending Bodies',
        abilityName: 'Forest Knowledge',
        weakness: 'Evidence -1 on Global Gaze unless paired with another player',
        weaknessName: 'Global Obscurity',
        mandate: 'Ensure that at game\'s end, no more than two Extraction Tokens remain in the Congo Basin.',
        patternStyle: 'kuba',
    },
    the_sumud: {
        id: 'the_sumud',
        name: 'The Sumud',
        displayName: 'The Sumud',
        homeRegion: 'The Levant',
        color: '#6B8E23',
        themeColor: '#6B8E23',
        startingBodies: 12,
        startingEvidence: 2,
        ability: 'When losing Bodies in home region, keep half (round up)',
        abilityName: 'Sumud',
        weakness: 'Cannot receive Bodies from others except during Global Gaze events',
        weaknessName: 'The Siege',
        mandate: 'Be the player who successfully defends against three "Land Confiscation" or "Demolition" crises.',
        patternStyle: 'tatreez',
    },
    riverkeepers: {
        id: 'riverkeepers',
        name: 'Riverkeepers',
        displayName: 'Riverkeepers',
        homeRegion: 'The Mekong',
        color: '#2A7F6E',
        themeColor: '#2A7F6E',
        startingBodies: 6,
        startingEvidence: 6,
        ability: 'Replay any Evidence card once per game',
        abilityName: 'Water Memory',
        weakness: 'Start with 1 extra permanent Extraction Token (dam)',
        weaknessName: 'Debt Bondage',
        mandate: 'Successfully expose two "Debt Trap" crises before the game ends.',
        patternStyle: 'hmong',
    },
    the_guardians: {
        id: 'the_guardians',
        name: 'The Guardians',
        displayName: 'The Guardians',
        homeRegion: 'The Amazon',
        color: '#8B4513',
        themeColor: '#8B4513',
        startingBodies: 10,
        startingEvidence: 3,
        ability: 'Dying Planet actions cost 1 less Body',
        abilityName: 'Earth Allies',
        weakness: 'Can only send Bodies to other regions if home region controlled',
        weaknessName: 'Distant Front',
        mandate: 'Ensure The Dying Planet track ends higher than The War Machine track in your home region.',
        patternStyle: 'kayapo',
    },
};

export const FACTION_IDS: FactionId[] = ['forest_defenders', 'the_sumud', 'riverkeepers', 'the_guardians'];

// ============================================================
// Game Rules Constants
// ============================================================
export const RULES = {
    maxExtractionTokens: 6,
    maxGlobalGaze: 20,
    maxWarMachine: 12,
    maxDomainTrack: 10,
    maxEvidenceHandSize: 5,
    actionsPerTurn: 2,
    campaignTargetNumber: 8,
    buildSolidarityCost: 3,
    internationalOutreachCost: 2, // evidence cards
    smuggleEvidenceCostRatio: 2,  // 1 body per 2 cards

    // Campaign modifiers
    bodiesPerBonus: 2,
    gazeBonus: { low: 10, mid: 15, high: 20 },
    gazeBonusValues: { low: 1, mid: 2, high: 3 },
    warMachinePenalty: { low: 8, mid: 10, high: 12 },
    warMachinePenaltyValues: { low: 1, mid: 2, high: 3 },

    // Phase 1 triggers
    warMachineInterventionThreshold: 6,
    solidarityGazeThreshold: 15,
    escalationWarMachineThreshold: 10,

    // Victory conditions (Mode A)
    victoryRegionsNeeded: 4,
    victoryMaxTokensPerRegion: 2,
    victoryMaxWarMachine: 4,
    victoryMinGaze: 12,
} as const;

// ============================================================
// Extraction Roll Table
// ============================================================
export function getExtractionResult(roll: number): number {
    if (roll <= 3) return 0;
    if (roll <= 5) return 1;
    return 2; // roll === 6
}
