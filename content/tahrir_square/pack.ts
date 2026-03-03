import type {
    ActionDefinition,
    BeaconDefinition,
    DomainDefinition,
    FactionDefinition,
    RegionDefinition,
    RulesetDefinition,
} from '../../engine/types.ts';
import { crisisCards } from './decks/crisisDeck.ts';
import { resistanceCards } from './decks/resistanceDeck.ts';
import { systemCards } from './decks/systemEscalationDeck.ts';

const domains: DomainDefinition[] = [
    {
        id: 'WarMachine',
        name: 'State Security',
        description: 'Ministry of Interior, CSF, and the military apparatus.',
        initialProgress: 2, // Starts at 8 pressure (12-10) meaning 8
    },
    {
        id: 'DyingPlanet',
        name: 'Dying Planet',
        description: 'Ecological defense against flood, fire, extraction, and collapse.',
        initialProgress: 1,
    },
    {
        id: 'GildedCage',
        name: 'Gilded Cage',
        description: 'Freedom from carceral control, dispossession, and managed rights.',
        initialProgress: 0,
    },
    {
        id: 'SilencedTruth',
        name: 'Digital Front',
        description: 'Social media, satellite TV, and citizen journalism.',
        initialProgress: 1,
    },
    {
        id: 'EmptyStomach',
        name: 'Bread & Dignity',
        description: 'Labor strikes, bread riots, and economic justice.',
        initialProgress: 0,
    },
    {
        id: 'FossilGrip',
        name: 'Fossil Grip',
        description: 'Energy justice against pipeline rule, sacrifice zones, and fuel empires.',
        initialProgress: 0,
    },
    {
        id: 'StolenVoice',
        name: 'Stolen Voice',
        description: 'Cultural survival, language, art, and memory against erasure.',
        initialProgress: 0,
    },
    {
        id: 'RevolutionaryWave',
        name: 'Revolutionary Wave',
        description: 'Momentum of the uprising.',
        initialProgress: 0,
    },
    {
        id: 'PatriarchalGrip',
        name: 'Patriarchal Grip',
        description: 'Regime control over bodies and lives.',
        initialProgress: 0,
    },
    {
        id: 'UnfinishedJustice',
        name: 'Unfinished Justice',
        description: 'Holdovers from the old regime and military trials.',
        initialProgress: 0,
    }
];

const regions: RegionDefinition[] = [
    {
        id: 'Cairo',
        name: 'Cairo',
        description: 'Capital, Tahrir Square, heavy security.',
        strapline: 'The center of gravity.',
        vulnerability: { WarMachine: 3, SilencedTruth: 2, RevolutionaryWave: 3 },
    },
    {
        id: 'Alexandria',
        name: 'Alexandria',
        description: 'Second city, labor movement.',
        strapline: 'The Mediterranean front.',
        vulnerability: { EmptyStomach: 3, GildedCage: 2, RevolutionaryWave: 2 },
    },
    {
        id: 'NileDelta',
        name: 'Nile Delta',
        description: 'Dense population, rural organizers.',
        strapline: 'The agricultural heart.',
        vulnerability: { EmptyStomach: 3, StolenVoice: 2, RevolutionaryWave: 1 },
    },
    {
        id: 'UpperEgypt',
        name: 'Upper Egypt',
        description: 'Neglected, conservative, repressed.',
        strapline: 'The forgotten south.',
        vulnerability: { GildedCage: 3, WarMachine: 2, UnfinishedJustice: 2 },
    },
    {
        id: 'Suez',
        name: 'Suez',
        description: 'Military zone, resistance history.',
        strapline: 'The canal cities bleed first.',
        vulnerability: { WarMachine: 3, EmptyStomach: 2, RevolutionaryWave: 3 },
    },
    {
        id: 'Sinai',
        name: 'Sinai',
        description: 'Militarized, peripheral.',
        strapline: 'A zone of exclusion.',
        vulnerability: { WarMachine: 3, GildedCage: 3, DyingPlanet: 1 },
    },
];

const factions: FactionDefinition[] = [
    {
        id: 'april_6_youth',
        name: 'April 6 Youth Movement',
        shortName: 'April 6',
        homeRegion: 'Cairo',
        passive: 'Organize gains +1 Body in Cairo.',
        weakness: 'Defend actions in Upper Egypt cost +1 Body.',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 0,
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_april_6_youth',
            title: 'Hold The Square',
            description: 'End with Cairo at 1 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'region_extraction', region: 'Cairo' }, op: '<=', right: 1 },
                ],
            },
        },
    },
    {
        id: 'labor_movement',
        name: 'Labor Movement',
        shortName: 'Labor',
        homeRegion: 'Alexandria',
        passive: 'Labor actions gain +2 on success.',
        weakness: 'Global Appeal costs +1 Evidence.',
        organizeBonus: 0,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignDomainBonus: 'EmptyStomach',
        campaignBonus: 1,
        outreachPenalty: 1,
        mandate: {
            id: 'mandate_labor_movement',
            title: 'Bread and Freedom',
            description: 'End with Alexandria at 1 or fewer Extraction Tokens and Empty Stomach at 5 or more.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'region_extraction', region: 'Alexandria' }, op: '<=', right: 1 },
                    { kind: 'compare', left: { type: 'domain_progress', domain: 'EmptyStomach' }, op: '>=', right: 5 },
                ],
            },
        },
    },
    {
        id: 'independent_journalists',
        name: 'Independent Journalists',
        shortName: 'Journalists',
        homeRegion: 'Cairo',
        passive: 'Investigate gains +1 Evidence.',
        weakness: 'Defend outside Cairo sets 1 less Defense.',
        organizeBonus: 0,
        investigateBonus: 1,
        defenseBonus: 0,
        campaignDomainBonus: 'SilencedTruth',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_independent_journalists',
            title: 'We Are All Khaled Said',
            description: 'End with Silenced Truth at 6 or more.',
            condition: {
                kind: 'compare', left: { type: 'domain_progress', domain: 'SilencedTruth' }, op: '>=', right: 6
            },
        },
    },
    {
        id: 'rights_defenders',
        name: 'Rights Defenders',
        shortName: 'Defenders',
        homeRegion: 'Cairo',
        passive: 'Campaigns against Gilded Cage gain +1.',
        weakness: 'Smuggle Evidence moves 1 less.',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 0,
        campaignDomainBonus: 'GildedCage',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_rights_defenders',
            title: 'End State Security',
            description: 'End with War Machine at 4 or less.',
            condition: {
                kind: 'compare', left: { type: 'northern_war_machine' }, op: '<=', right: 4
            },
        },
    }
];

const beacons: BeaconDefinition[] = [
    {
        id: 'beacon_tahrir_18_days',
        title: 'The 18 Days',
        description: 'Survive the uprising with Tahrir never empty.',
        condition: {
            kind: 'compare', left: { type: 'region_extraction', region: 'Cairo' }, op: '<=', right: 2
        },
    },
    {
        id: 'beacon_tahrir_labor_student',
        title: 'Labor-Student Alliance',
        description: 'Successfully call 3 Labor Strikes (Represented by high Empty Stomach domain).',
        condition: {
            kind: 'compare', left: { type: 'domain_progress', domain: 'EmptyStomach' }, op: '>=', right: 8
        },
    },
    {
        id: 'beacon_tahrir_no_military_trials',
        title: 'No to Military Trials',
        description: 'Unfinished Justice must remain 0.',
        condition: {
            kind: 'compare', left: { type: 'domain_progress', domain: 'UnfinishedJustice' }, op: '==', right: 0
        },
    }
];

const actions: ActionDefinition[] = [
    {
        id: 'organize',
        name: 'Organize',
        description: 'Roll 1d6 Bodies into a region, plus pressure bonuses where extraction is already entrenched.',
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
        description: 'Commit Bodies and Evidence to a 2d6 campaign against a Domain in a region.',
        resolvePriority: 500,
        needsRegion: true,
        needsDomain: true,
        needsBodies: true,
        needsEvidence: true,
        needsCard: true,
        cardType: 'support',
    },
    {
        id: 'build_solidarity',
        name: 'Build Solidarity',
        description: 'Spend 3 Bodies in-region to advance a Domain without a roll.',
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
        id: 'defend',
        name: 'Defend',
        description: 'Convert Bodies into a one-round Defense Rating against the next intervention.',
        resolvePriority: 260,
        needsRegion: true,
        needsBodies: true,
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
    {
        id: 'go_viral',
        name: 'Go Viral',
        description: 'Spend 1 Evidence, raise Global Gaze by 1.',
        resolvePriority: 200,
        needsEvidence: true,
    },
    {
        id: 'expose_regime_lies',
        name: 'Expose Regime Lies',
        description: 'Spend 2 Evidence, reduce War Machine by 1.',
        resolvePriority: 200,
        needsEvidence: true,
    },
    {
        id: 'call_labor_strike',
        name: 'Call Labor Strike',
        description: 'Spend 2 Evidence, roll 1d6. 4+ = gain 2 Bodies.',
        resolvePriority: 200,
        needsEvidence: true,
        needsRegion: true,
    },
    {
        id: 'coordinate_digital',
        name: 'Digital Coordination',
        description: 'Spend 1 Evidence, open a table-wide re-plan window.',
        resolvePriority: 10,
        needsEvidence: true,
    }
];

const pack: RulesetDefinition = {
    id: 'tahrir_square',
    name: '2011 — TAHRIR SQUARE',
    description: '"They said we were young, disorganized, naive. They were right. They were also wrong."',
    introduction: 'Players lead the January 25 Revolution — a sprawling, leaderless, digitally-organized uprising that toppled a 30-year dictatorship in 18 days. But the game does not end with Mubarak\'s fall. The System is Mubarak\'s security state, then SCAF, then the Muslim Brotherhood government, then General Sisi.',
    regions,
    domains,
    factions,
    beacons,
    actions,
    resistanceCards,
    crisisCards,
    systemCards,
    liberationThreshold: 1,
    suddenDeathRound: 12, // (FULL — through coup)
};

export default pack;
