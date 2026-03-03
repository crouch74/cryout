import type {
    ActionDefinition,
    BeaconDefinition,
    DomainDefinition,
    FactionDefinition,
    RegionDefinition,
    RulesetDefinition,
} from '../../engine/adapters/compat/types.ts';
import { womanLifeFreedomBoard } from './boards/womanLifeFreedomBoard.ts';
import { crisisCards } from './decks/crisisDeck.ts';
import { resistanceCards } from './decks/resistanceDeck.ts';
import { systemCards } from './decks/systemEscalationDeck.ts';

const domains: DomainDefinition[] = [
    {
        id: 'WarMachine',
        name: 'State Security',
        description: 'IRGC, Basij, and the riot police.',
        initialProgress: 3, // Starts at 9 pressure
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
        name: 'Digital Intranet',
        description: 'Bypassing the national firewall and getting video out.',
        initialProgress: 1,
    },
    {
        id: 'EmptyStomach',
        name: 'Empty Stomach',
        description: 'Economic justice and bazaar strikes.',
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
        id: 'PatriarchalGrip',
        name: 'Patriarchal Grip',
        description: 'Regime control over bodies, hair, and public life.',
        initialProgress: 0,
    }
];

const regions: RegionDefinition[] = [
    {
        id: 'Tehran',
        name: 'Tehran',
        description: 'The capital, universities, Evin prison.',
        strapline: 'The heart of power.',
        vulnerability: { WarMachine: 3, SilencedTruth: 3, PatriarchalGrip: 3 },
    },
    {
        id: 'Kurdistan',
        name: 'Kurdistan',
        description: 'Jina Amini\'s home, fierce resistance, heavy militarization.',
        strapline: 'Jin, Jiyan, Azadi began here.',
        vulnerability: { WarMachine: 3, StolenVoice: 3, PatriarchalGrip: 2 },
    },
    {
        id: 'Isfahan',
        name: 'Isfahan',
        description: 'Historic city, water protests, schoolgirl resistance.',
        strapline: 'The dry river.',
        vulnerability: { PatriarchalGrip: 3, DyingPlanet: 2, EmptyStomach: 1 },
    },
    {
        id: 'Mashhad',
        name: 'Mashhad',
        description: 'Conservative religious center, surprising protests.',
        strapline: 'The shrine city.',
        vulnerability: { PatriarchalGrip: 3, GildedCage: 2, SilencedTruth: 1 },
    },
    {
        id: 'Khuzestan',
        name: 'Khuzestan',
        description: 'Oil rich, ethnically marginalized, water crises.',
        strapline: 'The thirsty province.',
        vulnerability: { DyingPlanet: 3, FossilGrip: 3, WarMachine: 2 },
    },
    {
        id: 'Balochistan',
        name: 'Balochistan',
        description: 'Marginalized, Zahedan massacre, Friday protests.',
        strapline: 'Bloody Friday.',
        vulnerability: { WarMachine: 3, StolenVoice: 3, EmptyStomach: 2 },
    },
];

const factions: FactionDefinition[] = [
    {
        id: 'kurdish_women',
        name: 'Kurdish Women',
        shortName: 'Kurds',
        homeRegion: 'Kurdistan',
        passive: 'Actions cost 1 less Body in Kurdistan. Provide heavy combat resistance offset.',
        weakness: 'Targeted heavily by IRGC (War Machine events).',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_kurdish_women',
            title: 'Jin Jiyan Azadi',
            description: 'End with Patriarchal Grip < 5 and Kurdistan at 1 or fewer Extraction Tokens.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'domain_progress', domain: 'PatriarchalGrip' }, op: '<', right: 5 },
                    { kind: 'compare', left: { type: 'region_extraction', region: 'Kurdistan' }, op: '<=', right: 1 },
                ],
            },
        },
    },
    {
        id: 'student_union',
        name: 'University Students',
        shortName: 'Students',
        homeRegion: 'Tehran',
        passive: '+1 to all Digital Front (SilencedTruth) campaigns.',
        weakness: 'Defend actions in Balochistan cost +1 Body.',
        organizeBonus: 0,
        investigateBonus: 1,
        defenseBonus: 0,
        campaignDomainBonus: 'SilencedTruth',
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_student_union',
            title: 'Campus Resistance',
            description: 'Tehran Extraction <= 1 and Silenced Truth >= 6.',
            condition: {
                kind: 'all',
                conditions: [
                    { kind: 'compare', left: { type: 'region_extraction', region: 'Tehran' }, op: '<=', right: 1 },
                    { kind: 'compare', left: { type: 'domain_progress', domain: 'SilencedTruth' }, op: '>=', right: 6 },
                ]
            },
        },
    },
    {
        id: 'bazaar_strikers',
        name: 'Bazaar Strikers',
        shortName: 'Strikers',
        homeRegion: 'Isfahan',
        passive: 'Labor actions gain +2 on success.',
        weakness: 'Global Appeal costs +1 Evidence.',
        organizeBonus: 0,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignDomainBonus: 'EmptyStomach',
        campaignBonus: 1,
        outreachPenalty: 1,
        mandate: {
            id: 'mandate_bazaar_strikers',
            title: 'Economic Halt',
            description: 'Empty Stomach >= 5.',
            condition: {
                kind: 'compare', left: { type: 'domain_progress', domain: 'EmptyStomach' }, op: '>=', right: 5
            },
        },
    },
    {
        id: 'male_allies',
        name: 'Male Allies',
        shortName: 'Allies',
        homeRegion: 'Tehran',
        passive: 'May transfer actions to a female faction without spending Evidence.',
        weakness: 'Cannot resolve Burn Veil action directly.',
        organizeBonus: 1,
        investigateBonus: 0,
        defenseBonus: 1,
        campaignBonus: 1,
        outreachPenalty: 0,
        mandate: {
            id: 'mandate_male_allies',
            title: 'Shield the Vanguard',
            description: 'Patriarchal Grip <= 3.',
            condition: {
                kind: 'compare', left: { type: 'domain_progress', domain: 'PatriarchalGrip' }, op: '<=', right: 3
            },
        },
    }
];

const beacons: BeaconDefinition[] = [
    {
        id: 'beacon_wlf_global_solidarity',
        title: 'Global Solidarity',
        description: 'Ensure Global Gaze >= 12 and Patriarchal Grip <= 4.',
        condition: {
            kind: 'all',
            conditions: [
                { kind: 'compare', left: { type: 'global_gaze' }, op: '>=', right: 12 },
                { kind: 'compare', left: { type: 'domain_progress', domain: 'PatriarchalGrip' }, op: '<=', right: 4 },
            ]
        },
    },
    {
        id: 'beacon_wlf_no_executions',
        title: 'Halt Executions',
        description: 'War Machine drops to 3 or lower.',
        condition: {
            kind: 'compare', left: { type: 'northern_war_machine' }, op: '<=', right: 3
        },
    },
];

const actions: ActionDefinition[] = [
    {
        id: 'organize',
        name: 'Organize',
        description: 'Roll 1d6 Bodies into a region.',
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
        description: 'Commit Bodies and Evidence to a 2d6 campaign against a Domain.',
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
        description: 'Move Evidence to another faction.',
        resolvePriority: 180,
        needsRegion: true,
        needsTargetSeat: true,
    },
    {
        id: 'defend',
        name: 'Defend',
        description: 'Convert Bodies into Defense Rating.',
        resolvePriority: 260,
        needsRegion: true,
        needsBodies: true,
    },
    {
        id: 'play_card',
        name: 'Play Card',
        description: 'Resolve an action card from hand.',
        resolvePriority: 220,
        needsRegion: true,
        needsCard: true,
        cardType: 'action',
    },
    {
        id: 'burn_veil',
        name: 'Burn Veil',
        description: 'Raise Global Gaze by 2, lose 1 Body.',
        resolvePriority: 200,
        needsRegion: true,
    },
    {
        id: 'schoolgirl_network',
        name: 'Schoolgirl Network',
        description: 'Gain 1 Evidence, next action in region costs 1 less.',
        resolvePriority: 150,
        needsRegion: true,
    },
    {
        id: 'compose_chant',
        name: 'Compose Chant',
        description: 'Spend 1 Evidence, create permanent +1 track modifier in region.',
        resolvePriority: 210,
        needsRegion: true,
        needsEvidence: true,
    },
    {
        id: 'go_viral',
        name: 'Go Viral',
        description: 'Spend 1 Evidence, raise Global Gaze by 1.',
        resolvePriority: 200,
        needsEvidence: true,
    }
];

export const compatRuleset: RulesetDefinition = {
    id: 'woman_life_freedom',
    name: '2022 — WOMAN, LIFE, FREEDOM',
    description: '"For Jina. For freedom. For the women who burn their chains."',
    introduction: 'Following the murder of Jina (Mahsa) Amini by the morality police, an intersectional revolutionary movement erupted across Iran. Led by women and schoolgirls, burning headscarves in the street, the movement shook the foundations of the Islamic Republic.',
    board: womanLifeFreedomBoard,
    regions,
    domains,
    factions,
    beacons,
    actions,
    resistanceCards,
    crisisCards,
    systemCards,
    liberationThreshold: 1,
    suddenDeathRound: 12,
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
