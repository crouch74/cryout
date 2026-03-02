import type { SystemCardDefinition } from '../../../engine/types.ts';

// Legacy survival-loop threat cards retained for reference during the dual-threat rebuild.
export const legacySystemSurvivalDeck: SystemCardDefinition[] = [
  {
    id: 'sys_arms_corridor',
    deck: 'system',
    name: 'Arms Corridor Expansion',
    text: 'The war economy entrenches itself where militarism already dominates.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
  },
  {
    id: 'sys_extractivist_finance',
    deck: 'system',
    name: 'Extractivist Finance Package',
    text: 'Debt is sold as modernization.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'sys_climate_shockfront',
    deck: 'system',
    name: 'Climate Shockfront',
    text: 'Disaster is used to speed the carve-up.',
    onReveal: [
      { type: 'add_extraction', region: { byVulnerability: 'DyingPlanet' }, amount: 1 },
      { type: 'add_extraction', region: 'Sahel', amount: 1 },
    ],
  },
  {
    id: 'sys_data_blackout',
    deck: 'system',
    name: 'Data Blackout',
    text: 'The platform fog thickens.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'sys_pipeline_ultimatum',
    deck: 'system',
    name: 'Pipeline Ultimatum',
    text: 'The fossil state redraws the route in the language of energy security.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'FossilGrip' }, amount: 1 },
    ],
  },
  {
    id: 'sys_cultural_raid',
    deck: 'system',
    name: 'Cultural Raid',
    text: 'Archives, schools, and memory are treated as hostile terrain.',
    onReveal: [{ type: 'add_extraction', region: { byVulnerability: 'StolenVoice' }, amount: 1 }],
  },
  {
    id: 'sys_carceral_decree',
    deck: 'system',
    name: 'Carceral Decree',
    text: 'Exception becomes doctrine.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
  },
  {
    id: 'sys_attention_backlash',
    deck: 'system',
    name: 'Attention Backlash',
    text: 'The spotlight invites a sharper strike.',
    onReveal: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
];
