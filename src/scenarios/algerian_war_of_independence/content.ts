import type {
    ActionDefinition,
    BeaconDefinition,
    DomainDefinition,
    FactionDefinition,
    RegionDefinition,
    RulesetDefinition,
} from '../../engine/adapters/compat/types.ts';
import { algeriaBoard } from './boards/algeriaBoard.ts';
import { crisisCards } from './decks/crisisDeck.ts';
import { resistanceCards } from './decks/resistanceDeck.ts';
import { systemCards } from './decks/systemEscalationDeck.ts';

const domains: DomainDefinition[] = [
    {
        id: 'WarMachine',
        name: 'French Colonial Army',
        description: 'The colonial army, counter-insurgency doctrine, and force projection.',
        initialProgress: 3,
    },
    {
        id: 'GildedCage',
        name: 'Torture & Detention Network',
        description: 'Interrogation centers, detention grids, and disappearance.',
        initialProgress: 2,
    },
    {
        id: 'SilencedTruth',
        name: 'International Witness',
        description: 'Documentation, testimony, and transnational witness.',
        initialProgress: 1,
    },
    {
        id: 'UnfinishedJustice',
        name: 'Colonial Impunity',
        description: 'Institutions that shield colonial crimes from consequence.',
        initialProgress: 2,
    },
    {
        id: 'RevolutionaryWave',
        name: 'Liberation Cohesion',
        description: 'The movement’s capacity to stay collectively aligned under pressure.',
        initialProgress: 1,
    },
    {
        id: 'EmptyStomach',
        name: 'Settler Bloc',
        description: 'Settler political pressure, economic veto, and reactionary mobilization.',
        initialProgress: 2,
    }
];

const regions: RegionDefinition[] = [
    {
        id: 'Algiers',
        name: 'Algiers',
        description: 'The capital corridor from Alger through Blida and Tipaza, where urban insurgency meets colonial administration.',
        strapline: 'The colonial capital convulses.',
        vulnerability: { WarMachine: 3, GildedCage: 3, SilencedTruth: 2 },
    },
    {
        id: 'KabylieMountains',
        name: 'Kabylie Mountains',
        description: 'Kabylia and its mountain approaches, a guerrilla stronghold for endurance, shelter, and political cohesion.',
        strapline: 'The maquis holds the heights.',
        vulnerability: { WarMachine: 2, RevolutionaryWave: 3, UnfinishedJustice: 2 },
    },
    {
        id: 'Oran',
        name: 'Oran',
        description: 'The western settler coast around Oran, where colonial power hardens into reaction and veto.',
        strapline: 'The settler coast refuses to yield.',
        vulnerability: { EmptyStomach: 3, WarMachine: 2, GildedCage: 2 },
    },
    {
        id: 'SaharaSouth',
        name: 'Sahara South',
        description: 'The Saharan south, where long distances, desert routes, and reprisal test rural organizing.',
        strapline: 'Organizing survives across great distance.',
        vulnerability: { RevolutionaryWave: 2, WarMachine: 2, EmptyStomach: 1 },
    },
    {
        id: 'TunisianBorder',
        name: 'Tunisian Border',
        description: 'The eastern frontier toward Tunisia, a corridor for supplies, testimony, and strategic passage.',
        strapline: 'The corridor that keeps the struggle breathing.',
        vulnerability: { SilencedTruth: 2, WarMachine: 3, UnfinishedJustice: 1 },
    },
    {
        id: 'FrenchMetropoleInfluence',
        name: 'French Metropole Influence',
        description: 'Political and media struggle inside France over legitimacy, repression, and the terms of colonial exit.',
        strapline: 'The colonial center is part of the battlefield.',
        vulnerability: { EmptyStomach: 2, SilencedTruth: 2, UnfinishedJustice: 3 },
    },
];

const factions: FactionDefinition[] = [
    {
        id: 'fln_urban_cells',
        name: 'FLN Urban Cells',
        shortName: 'Urban Cells',
        homeRegion: 'Algiers',
        passive: 'Investigate gains +1 Evidence in Algiers and Urban Cell Network strengthens launch points.',
        weakness: 'Failed campaigns in Algiers immediately add 1 Extraction there.',
        organizeBonus: 1,
        investigateBonus: 1,
        defenseBonus: 0,
        campaignDomainBonus: 'SilencedTruth',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_alg_fln_urban_cells',
            title: 'Protect International Legitimacy',
            description: 'End with Global Gaze at 12 or more and Algiers at 2 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'global_gaze' }, op: '>=', right: 9 },
                    { kind: 'compare', left: { type: 'region_extraction', region: 'Algiers' }, op: '<=', right: 5 },
                ],
            },
        },
    },
    {
        id: 'kabyle_maquis',
        name: 'Kabyle Maquis',
        shortName: 'Maquis',
        homeRegion: 'KabylieMountains',
        passive: 'Launch Campaign gains +1 in Kabylie Mountains and Mountain Guerrilla Offensive gains an extra +1 there.',
        weakness: 'Global Appeal costs +1 Evidence when War Machine is 8 or higher.',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignDomainBonus: 'WarMachine',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_alg_kabyle_maquis',
            title: 'Accelerate Armed Struggle',
            description: 'End with Liberation Cohesion at 6 or more and Kabylie Mountains at 1 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'domain_progress', domain: 'RevolutionaryWave' }, op: '>=', right: 3 },
                    { kind: 'compare', left: { type: 'region_extraction', region: 'KabylieMountains' }, op: '<=', right: 4 },
                ],
            },
        },
    },
    {
        id: 'rural_organizing_committees',
        name: 'Rural Organizing Committees',
        shortName: 'Rural Committees',
        homeRegion: 'SaharaSouth',
        passive: 'Organize gains +1 Comrade in Sahara South and Build Solidarity costs 1 fewer Comrade there.',
        weakness: 'Military intervention in Sahara South removes 1 extra Comrade.',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignDomainBonus: 'RevolutionaryWave',
        campaignBonus: 1,
        outreachPenalty: 1,
        mandate: {
            id: 'mandate_alg_rural_organizers',
            title: 'Minimize Civilian Casualties',
            description: 'End with Repression Cycle at 6 or less and Sahara South at 2 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'custom_track', track: 'repression_cycle' }, op: '<=', right: 9 },
                    { kind: 'compare', left: { type: 'region_extraction', region: 'SaharaSouth' }, op: '<=', right: 5 },
                ],
            },
        },
    },
    {
        id: 'border_solidarity_networks',
        name: 'Border Solidarity Networks',
        shortName: 'Border Networks',
        homeRegion: 'TunisianBorder',
        passive: 'Smuggle Evidence can move up to 2 Evidence and Cross-Border Supply gains +1 Comrade.',
        weakness: 'Border Closure effects hit this seat first when multiple seats are valid.',
        organizeBonus: 0,
        investigateBonus: 1,
        defenseBonus: 0,
        campaignDomainBonus: 'GildedCage',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_alg_border_networks',
            title: 'Prevent Internal Purge',
            description: 'End with Torture & Detention Network at 4 or less and French Metropole Influence at 2 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'domain_progress', domain: 'GildedCage' }, op: '<=', right: 7 },
                    { kind: 'compare', left: { type: 'region_extraction', region: 'FrenchMetropoleInfluence' }, op: '<=', right: 5 },
                ],
            },
        },
    }
];

const beacons: BeaconDefinition[] = [
    {
        id: 'beacon_alg_global_gaze_breakthrough',
        title: 'Break the Colonial Narrative',
        description: 'Global Gaze reaches 15 or more.',
        condition: {
            kind: 'compare',
            left: { type: 'global_gaze' },
            op: '>=',
            right: 12,
        },
    },
    {
        id: 'beacon_alg_torture_exposed',
        title: 'Expose the Torture Network',
        description: 'The torture system is forced into the open.',
        condition: {
            kind: 'compare',
            left: { type: 'scenario_flag', flag: 'tortureExposed' },
            op: '==',
            right: 1,
        },
    },
    {
        id: 'beacon_alg_tribunal_acknowledgement',
        title: 'Force International Reckoning',
        description: 'An international tribunal acknowledges colonial abuses.',
        condition: {
            kind: 'compare',
            left: { type: 'scenario_flag', flag: 'tribunalAcknowledged' },
            op: '==',
            right: 1,
        },
    },
];

const actions: ActionDefinition[] = [
    {
        id: 'organize',
        name: 'Organize',
        description: 'Roll 1d6 Comrades into a region, with movement bonuses at home.',
        resolvePriority: 100,
        needsRegion: true,
    },
    {
        id: 'investigate',
        name: 'Investigate',
        description: 'Generate Evidence and draw resistance cards.',
        resolvePriority: 120,
        needsRegion: true,
    },
    {
        id: 'launch_campaign',
        name: 'Launch Campaign',
        description: 'Commit Comrades and Evidence to a 2d6 campaign against a Domain in a region.',
        resolvePriority: 500,
        needsRegion: true,
        needsDomain: true,
        needsComrades: true,
        needsEvidence: true,
        needsCard: true,
        cardType: 'support',
    },
    {
        id: 'build_solidarity',
        name: 'Build Solidarity',
        description: 'Spend 3 Comrades in-region to advance a Domain without a roll.',
        resolvePriority: 300,
        needsRegion: true,
        needsDomain: true,
    },
    {
        id: 'smuggle_evidence',
        name: 'Smuggle Evidence',
        description: 'Move Evidence to another faction through a risky corridor.',
        resolvePriority: 180,
        needsRegion: true,
        needsTargetSeat: true,
    },
    {
        id: 'international_outreach',
        name: 'Global Appeal',
        description: 'Spend Evidence to raise Global Gaze.',
        resolvePriority: 200,
    },
    {
        id: 'defend',
        name: 'Defend',
        description: 'Convert Comrades into a one-round Defense Rating against the next intervention.',
        resolvePriority: 260,
        needsRegion: true,
        needsComrades: true,
    },
    {
        id: 'play_card',
        name: 'Play Card',
        description: 'Resolve an action card from hand for direct tactical impact.',
        resolvePriority: 220,
        needsRegion: true,
        needsCard: true,
        cardType: 'action',
    },
];

export const compatRuleset: RulesetDefinition = {
    id: 'algerian_war_of_independence',
    name: '1954 — ALGERIAN WAR OF INDEPENDENCE',
    description: '"The Cost of Liberation."',
    introduction: 'Algerian movements confront a colonial order built from military occupation, settler power, torture, and geopolitical cover. The struggle stretches from the Algiers corridor to Kabylia, the Saharan south, the Tunisian frontier, and the metropole itself.',
    board: algeriaBoard,
    regions,
    domains,
    factions,
    beacons,
    actions,
    resistanceCards,
    crisisCards,
    systemCards,
    liberationThreshold: 4,
    suddenDeathRound: 12,
    victoryGate: {
        minRoundBeforeVictory: 3,
    },
    victoryScoring: {
        mode: 'score',
        threshold: 72,
        survivalScorePerRound: 0.8,
        components: [
            {
                id: 'publicVictory',
                label: 'Public Victory',
                weight: 30,
                type: 'binaryCondition',
                source: {
                    type: 'publicVictory',
                },
            },
        ],
        mandatesAsScore: {
            enabled: true,
            weight: 70,
            mandateProgressMode: 'binary',
        },
        outcomeBands: [
            { id: 'defeat', min: 0, max: 39.999999 },
            { id: 'continuation', min: 40, max: 59.999999 },
            { id: 'win_with_consequence', min: 60, max: 84.999999 },
            { id: 'breakthrough', min: 85, max: 100 },
        ],
    },
    setup: {
        globalGaze: 3,
        northernWarMachine: 7,
        extractionPool: 72,
        extractionSeeds: {
            Oran: 2,
            Algiers: 4,
            KabylieMountains: 2,
            SaharaSouth: 1,
            TunisianBorder: 1,
            FrenchMetropoleInfluence: 1,
        },
    },
    customTracks: [
        {
            id: 'repression_cycle',
            name: 'Repression Cycle',
            description: 'How far colonial repression has escalated against the movement.',
            initialValue: 3,
            min: 0,
            max: 10,
            thresholds: [5, 7, 9],
        },
    ],
    specialRules: [
        {
            id: 'repression_feedback',
            label: 'Repression Feedback',
            description: 'When Evidence increases, Repression Cycle rises.',
        },
        {
            id: 'urban_operations',
            label: 'Urban Operations',
            description: 'Successful campaigns in Algiers or Oran escalate the War Machine.',
        },
        {
            id: 'referendum_pressure',
            label: 'Force Immediate Referendum',
            description: 'Symbolic victory requires international acknowledgement of colonial abuses.',
        },
    ],
    scenarioFlags: ['tortureExposed', 'tribunalAcknowledged', 'stateOfEmergencyNationwide'],
    scenarioHooks: {
        evidenceGainRaisesRepression: true,
        evidenceGainRepressionDelta: 1,
        urbanCampaignRegions: ['Algiers', 'Oran'],
        successfulUrbanCampaignWarMachineDelta: 1,
        thresholdRules: [
            {
                trackId: 'repression_cycle',
                threshold: 5,
                once: true,
                effects: [
                    { type: 'lose_evidence', seat: 0, amount: 1 },
                    { type: 'lose_evidence', seat: 1, amount: 1 },
                    { type: 'lose_evidence', seat: 2, amount: 1 },
                    { type: 'lose_evidence', seat: 3, amount: 1 },
                ],
            },
            {
                trackId: 'repression_cycle',
                threshold: 7,
                once: true,
                effects: [
                    { type: 'modify_gaze', delta: 2 },
                    { type: 'set_scenario_flag', flag: 'tortureExposed', value: true },
                ],
            },
            {
                trackId: 'repression_cycle',
                threshold: 9,
                once: true,
                effects: [
                    { type: 'set_scenario_flag', flag: 'stateOfEmergencyNationwide', value: true },
                ],
            },
        ],
        maxTrackRoundPenalty: {
            trackId: 'repression_cycle',
            effects: [
                { type: 'remove_comrades', region: 'target_region', seat: 'acting_player', amount: 1 },
            ],
        },
    },
    victoryConditions: {
        liberation: {
            kind: 'all',
            conditions: [
                { kind: 'compare', left: { type: 'custom_track', track: 'repression_cycle' }, op: '<=', right: 9 },
                { kind: 'every_region_extraction_at_most', count: 8 },
            ],
        },
    },
};

export {
    actions,
    beacons,
    crisisCards,
    domains,
    factions,
    regions,
    resistanceCards,
    systemCards,
};

export default compatRuleset;
