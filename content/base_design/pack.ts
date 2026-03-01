import type {
  ActionDefinition,
  BeaconDefinition,
  DomainDefinition,
  FactionDefinition,
  RegionDefinition,
  ResistanceCardDefinition,
  RulesetDefinition,
  SystemCardDefinition,
} from '../../engine/types.ts';

const domains: DomainDefinition[] = [
  {
    id: 'WarMachine',
    name: 'War Machine',
    description: 'Militarism, bases, and logistics of permanent intervention.',
    initialProgress: 1,
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
    name: 'Silenced Truth',
    description: 'Witness, press freedom, and the ability to circulate testimony.',
    initialProgress: 1,
  },
  {
    id: 'EmptyStomach',
    name: 'Empty Stomach',
    description: 'Food sovereignty, debt resistance, and survival beyond austerity.',
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
];

const regions: RegionDefinition[] = [
  {
    id: 'Congo',
    name: 'Congo Basin',
    description: 'Mining corridors, rainforest sovereignty, and cobalt imperialism.',
    strapline: 'Extraction is sold as inevitability.',
    vulnerability: { FossilGrip: 3, DyingPlanet: 3, EmptyStomach: 2, WarMachine: 1 },
  },
  {
    id: 'Levant',
    name: 'The Levant',
    description: 'Occupation, siege, surveillance, and the politics of imposed scarcity.',
    strapline: 'Witness survives under bombardment.',
    vulnerability: { WarMachine: 3, GildedCage: 3, SilencedTruth: 2, EmptyStomach: 1 },
  },
  {
    id: 'Amazon',
    name: 'The Amazon',
    description: 'Forest defense against land theft, agribusiness, and settler violence.',
    strapline: 'The forest is treated as inventory.',
    vulnerability: { DyingPlanet: 3, FossilGrip: 2, StolenVoice: 2, WarMachine: 1 },
  },
  {
    id: 'Sahel',
    name: 'The Sahel',
    description: 'Climate breakdown, hunger, border regimes, and securitized aid.',
    strapline: 'Security doctrine feeds the famine line.',
    vulnerability: { EmptyStomach: 3, DyingPlanet: 2, WarMachine: 2, GildedCage: 1 },
  },
  {
    id: 'Mekong',
    name: 'The Mekong',
    description: 'Water memory against dams, agribusiness, and fossil corridors.',
    strapline: 'The river is partitioned for profit.',
    vulnerability: { FossilGrip: 3, DyingPlanet: 2, SilencedTruth: 2, EmptyStomach: 1 },
  },
  {
    id: 'Andes',
    name: 'The Andes',
    description: 'Highland resistance to debt, lithium extraction, and privatized life.',
    strapline: 'The mountain is priced before it is heard.',
    vulnerability: { EmptyStomach: 2, GildedCage: 2, FossilGrip: 2, StolenVoice: 2 },
  },
];

const factions: FactionDefinition[] = [
  {
    id: 'congo_basin_collective',
    name: 'Congo Basin Collective',
    shortName: 'Congo Collective',
    homeRegion: 'Congo',
    passive: 'Organize gains +1 Comrade in Congo and Launch Campaign gains +1 there.',
    weakness: 'Global Appeal costs +1 Witness.',
    organizeBonus: 1,
    investigateBonus: 0,
    defenseBonus: 0,
    campaignBonus: 1,
    outreachPenalty: 1,
    mandate: {
      id: 'mandate_congo_basin_collective',
      title: 'Keep The Forest Unpriced',
      description: 'End with Congo at 2 or fewer Extraction Tokens and Dying Planet ahead of War Machine.',
      condition: {
        kind: 'all',
        conditions: [
          { kind: 'compare', left: { type: 'region_extraction', region: 'Congo' }, op: '<=', right: 2 },
          { kind: 'compare', left: { type: 'domain_progress', domain: 'DyingPlanet' }, op: '>', right: 1 },
          { kind: 'compare', left: { type: 'domain_progress', domain: 'WarMachine' }, op: '<=', right: 5 },
        ],
      },
    },
  },
  {
    id: 'levant_sumud',
    name: 'Levant Sumud Front',
    shortName: 'Sumud Front',
    homeRegion: 'Levant',
    passive: 'Defend gains +1 Defense in the Levant and campaigns against War Machine gain +1 there.',
    weakness: 'Organize outside the Levant gains -1 Comrade.',
    organizeBonus: 0,
    investigateBonus: 0,
    defenseBonus: 1,
    campaignDomainBonus: 'WarMachine',
    campaignBonus: 1,
    outreachPenalty: 0,
    mandate: {
      id: 'mandate_levant_sumud',
      title: 'Refuse Managed Siege',
      description: 'End with the Levant at 1 or fewer Extraction Tokens and Northern War Machine at 6 or less.',
      condition: {
        kind: 'all',
        conditions: [
          { kind: 'compare', left: { type: 'region_extraction', region: 'Levant' }, op: '<=', right: 1 },
          { kind: 'compare', left: { type: 'northern_war_machine' }, op: '<=', right: 6 },
        ],
      },
    },
  },
  {
    id: 'mekong_echo_network',
    name: 'Mekong Echo Network',
    shortName: 'Echo Network',
    homeRegion: 'Mekong',
    passive: 'Investigate gains +1 Witness in the Mekong and support cards gain +1 on Silenced Truth campaigns.',
    weakness: 'Defend outside the Mekong sets 1 less Defense.',
    organizeBonus: 0,
    investigateBonus: 1,
    defenseBonus: 0,
    campaignDomainBonus: 'SilencedTruth',
    campaignBonus: 1,
    outreachPenalty: 0,
    mandate: {
      id: 'mandate_mekong_echo_network',
      title: 'Keep The River Speaking',
      description: 'End with the Mekong at 1 or fewer Extraction Tokens and Silenced Truth at 5 or more.',
      condition: {
        kind: 'all',
        conditions: [
          { kind: 'compare', left: { type: 'region_extraction', region: 'Mekong' }, op: '<=', right: 1 },
          { kind: 'compare', left: { type: 'domain_progress', domain: 'SilencedTruth' }, op: '>=', right: 5 },
        ],
      },
    },
  },
  {
    id: 'amazon_guardians',
    name: 'Amazon Guardians',
    shortName: 'Guardians',
    homeRegion: 'Amazon',
    passive: 'Campaigns in the Amazon or Dying Planet gain +1 and Organize gains +1 Comrade in the Amazon.',
    weakness: 'Smuggle Witness can move only 1 Witness at a time.',
    organizeBonus: 1,
    investigateBonus: 0,
    defenseBonus: 0,
    campaignDomainBonus: 'DyingPlanet',
    campaignBonus: 1,
    outreachPenalty: 0,
    mandate: {
      id: 'mandate_amazon_guardians',
      title: 'No Green Sacrifice Zone',
      description: 'End with the Amazon at 1 or fewer Extraction Tokens and Fossil Grip at 5 or more progress.',
      condition: {
        kind: 'all',
        conditions: [
          { kind: 'compare', left: { type: 'region_extraction', region: 'Amazon' }, op: '<=', right: 1 },
          { kind: 'compare', left: { type: 'domain_progress', domain: 'FossilGrip' }, op: '>=', right: 5 },
        ],
      },
    },
  },
];

const beacons: BeaconDefinition[] = [
  {
    id: 'beacon_levant_corridor',
    title: 'Corridor Of Return',
    description: 'Levant at 1 or fewer Extraction Tokens and Global Gaze at 10 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Levant' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'global_gaze' }, op: '>=', right: 10 },
      ],
    },
  },
  {
    id: 'beacon_mekong_testimony',
    title: 'River Testimony',
    description: 'Mekong at 1 or fewer Extraction Tokens and Silenced Truth at 5 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Mekong' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'domain_progress', domain: 'SilencedTruth' }, op: '>=', right: 5 },
      ],
    },
  },
  {
    id: 'beacon_amazon_sovereignty',
    title: 'Forest Sovereignty',
    description: 'Amazon at 1 or fewer Extraction Tokens and Dying Planet at 6 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Amazon' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'domain_progress', domain: 'DyingPlanet' }, op: '>=', right: 6 },
      ],
    },
  },
  {
    id: 'beacon_congo_commons',
    title: 'Copper Commons',
    description: 'Congo at 1 or fewer Extraction Tokens and Fossil Grip at 5 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Congo' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'domain_progress', domain: 'FossilGrip' }, op: '>=', right: 5 },
      ],
    },
  },
  {
    id: 'beacon_sahel_bread_pact',
    title: 'Bread Pact',
    description: 'Sahel at 1 or fewer Extraction Tokens and Empty Stomach at 5 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Sahel' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'domain_progress', domain: 'EmptyStomach' }, op: '>=', right: 5 },
      ],
    },
  },
  {
    id: 'beacon_andes_charter',
    title: 'Mountain Charter',
    description: 'Andes at 1 or fewer Extraction Tokens and Gilded Cage at 5 or more.',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'compare', left: { type: 'region_extraction', region: 'Andes' }, op: '<=', right: 1 },
        { kind: 'compare', left: { type: 'domain_progress', domain: 'GildedCage' }, op: '>=', right: 5 },
      ],
    },
  },
];

const actions: ActionDefinition[] = [
  {
    id: 'organize',
    name: 'Organize',
    description: 'Roll 1d6 Comrades into a region, plus pressure bonuses where extraction is already entrenched.',
    resolvePriority: 100,
    needsRegion: true,
  },
  {
    id: 'investigate',
    name: 'Investigate',
    description: 'Generate Witness and draw resistance cards.',
    resolvePriority: 120,
    needsRegion: true,
  },
  {
    id: 'launch_campaign',
    name: 'Launch Campaign',
    description: 'Commit Comrades and Witness to a 2d6 campaign against a domain in a region.',
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
    description: 'Spend 3 Comrades in-region to advance a domain without a roll.',
    resolvePriority: 300,
    needsRegion: true,
    needsDomain: true,
  },
  {
    id: 'smuggle_evidence',
    name: 'Smuggle Witness',
    description: 'Move Witness to another faction through a risky corridor.',
    resolvePriority: 180,
    needsRegion: true,
    needsTargetSeat: true,
  },
  {
    id: 'international_outreach',
    name: 'Global Appeal',
    description: 'Spend Witness to raise Global Gaze.',
    resolvePriority: 200,
  },
  {
    id: 'defend',
    name: 'Defend',
    description: 'Convert Comrades into a one-round Defense Rating against the next intervention.',
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
];

const resistanceCards: ResistanceCardDefinition[] = [
  {
    id: 'res_archive_leak',
    deck: 'resistance',
    type: 'action',
    name: 'Archive Leak',
    text: 'Raise Global Gaze by 1 and gain 1 Witness.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'gain_evidence', seat: 'acting_player', amount: 1 },
    ],
  },
  {
    id: 'res_mutual_aid_convoy',
    deck: 'resistance',
    type: 'action',
    name: 'Mutual Aid Convoy',
    text: 'Remove 1 Extraction Token from the target region.',
    effects: [{ type: 'remove_extraction', region: 'target_region', amount: 1 }],
  },
  {
    id: 'res_radio_uprising',
    deck: 'resistance',
    type: 'action',
    name: 'Radio Uprising',
    text: 'Advance Silenced Truth by 1 and add 1 Comrade to the target region.',
    effects: [
      { type: 'modify_domain', domain: 'SilencedTruth', delta: 1 },
      { type: 'add_bodies', region: 'target_region', seat: 'acting_player', amount: 1 },
    ],
  },
  {
    id: 'res_strike_fund',
    deck: 'resistance',
    type: 'action',
    name: 'Strike Fund',
    text: 'Add 3 Comrades to the target region.',
    effects: [{ type: 'add_bodies', region: 'target_region', seat: 'acting_player', amount: 3 }],
  },
  {
    id: 'res_lawyers_brief',
    deck: 'resistance',
    type: 'action',
    name: 'Lawyers Brief',
    text: 'Advance Gilded Cage by 1 and reduce Northern War Machine by 1.',
    effects: [
      { type: 'modify_domain', domain: 'GildedCage', delta: 1 },
      { type: 'modify_war_machine', delta: -1 },
    ],
  },
  {
    id: 'sup_arms_manifest',
    deck: 'resistance',
    type: 'support',
    name: 'Arms Shipment Manifest',
    text: '+2 on a War Machine campaign.',
    campaignBonus: 2,
    domainBonus: 'WarMachine',
  },
  {
    id: 'sup_watershed_maps',
    deck: 'resistance',
    type: 'support',
    name: 'Watershed Maps',
    text: '+2 on a Dying Planet campaign.',
    campaignBonus: 2,
    domainBonus: 'DyingPlanet',
  },
  {
    id: 'sup_prison_letters',
    deck: 'resistance',
    type: 'support',
    name: 'Prison Letters',
    text: '+2 on a Gilded Cage campaign.',
    campaignBonus: 2,
    domainBonus: 'GildedCage',
  },
  {
    id: 'sup_press_cables',
    deck: 'resistance',
    type: 'support',
    name: 'Press Cables',
    text: '+2 on a Silenced Truth campaign.',
    campaignBonus: 2,
    domainBonus: 'SilencedTruth',
  },
  {
    id: 'sup_debt_ledger',
    deck: 'resistance',
    type: 'support',
    name: 'Debt Ledger',
    text: '+2 on an Empty Stomach campaign.',
    campaignBonus: 2,
    domainBonus: 'EmptyStomach',
  },
  {
    id: 'sup_pipeline_routes',
    deck: 'resistance',
    type: 'support',
    name: 'Pipeline Routes',
    text: '+2 on a Fossil Grip campaign.',
    campaignBonus: 2,
    domainBonus: 'FossilGrip',
  },
  {
    id: 'sup_songbook',
    deck: 'resistance',
    type: 'support',
    name: 'Songbook',
    text: '+2 on a Stolen Voice campaign.',
    campaignBonus: 2,
    domainBonus: 'StolenVoice',
  },
];

const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_arms_corridor',
    deck: 'system',
    name: 'Arms Corridor Expansion',
    text: 'The war economy entrenches itself where militarism already dominates.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
  },
  {
    id: 'sys_extractivist_finance',
    deck: 'system',
    name: 'Extractivist Finance Package',
    text: 'Debt is sold as modernization.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'sys_climate_shockfront',
    deck: 'system',
    name: 'Climate Shockfront',
    text: 'Disaster is used to speed the carve-up.',
    effects: [
      { type: 'add_extraction', region: { byVulnerability: 'DyingPlanet' }, amount: 1 },
      { type: 'add_extraction', region: 'Sahel', amount: 1 },
    ],
  },
  {
    id: 'sys_data_blackout',
    deck: 'system',
    name: 'Data Blackout',
    text: 'The platform fog thickens.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'sys_pipeline_ultimatum',
    deck: 'system',
    name: 'Pipeline Ultimatum',
    text: 'The fossil state redraws the route in the language of energy security.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'FossilGrip' }, amount: 1 },
    ],
  },
  {
    id: 'sys_cultural_raid',
    deck: 'system',
    name: 'Cultural Raid',
    text: 'Archives, schools, and memory are treated as hostile terrain.',
    effects: [{ type: 'add_extraction', region: { byVulnerability: 'StolenVoice' }, amount: 1 }],
  },
  {
    id: 'sys_carceral_decree',
    deck: 'system',
    name: 'Carceral Decree',
    text: 'Exception becomes doctrine.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
  },
  {
    id: 'sys_attention_backlash',
    deck: 'system',
    name: 'Attention Backlash',
    text: 'The spotlight invites a sharper strike.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
];

const pack: RulesetDefinition = {
  id: 'base_design',
  name: 'Where the Stones Cry Out',
  description: 'A six-region cooperative struggle against extraction, war, hunger, and erasure.',
  introduction:
    'The coalition is trying to do more than survive. It must break extraction, move witness across borders, and keep every movement’s private mandate intact long enough to win together.',
  regions,
  domains,
  factions,
  beacons,
  actions,
  resistanceCards,
  systemCards,
  liberationThreshold: 1,
  suddenDeathRound: 12,
};

export default pack;
