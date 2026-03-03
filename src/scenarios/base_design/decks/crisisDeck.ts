import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crisis_military_raid',
    deck: 'crisis',
    name: 'Military Raid',
    text: 'A logistics corridor is secured through direct force.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_media_smear',
    deck: 'crisis',
    name: 'Media Smear',
    text: 'The movement is reframed as disorder to cool public attention.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_fuel_convoy',
    deck: 'crisis',
    name: 'Fuel Convoy',
    text: 'The corridor reopens under armed protection.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'FossilGrip' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_border_lockdown',
    deck: 'crisis',
    name: 'Border Lockdown',
    text: 'Containment expands under the language of security.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_hunger_discipline',
    deck: 'crisis',
    name: 'Hunger Discipline',
    text: 'Debt, rationing, and coercion force communities back into dependence.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_climate_shock',
    deck: 'crisis',
    name: 'Climate Shock',
    text: 'Disaster is turned into a fast lane for seizure.',
    effects: [
      { type: 'add_extraction', region: { byVulnerability: 'DyingPlanet' }, amount: 1 },
      { type: 'add_extraction', region: 'Sahel', amount: 1 },
    ],
  },
  {
    id: 'crisis_memory_purge',
    deck: 'crisis',
    name: 'Memory Purge',
    text: 'Archives, schools, and ceremonies are treated as hostile terrain.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'StolenVoice' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_attention_backlash',
    deck: 'crisis',
    name: 'Attention Backlash',
    text: 'Visibility triggers a sharper retaliatory strike.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_port_seizure',
    deck: 'crisis',
    name: 'Port Seizure',
    text: 'Trade chokepoints are tightened to discipline the region.',
    effects: [
      { type: 'add_extraction', region: 'Congo', amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_platform_blackout',
    deck: 'crisis',
    name: 'Platform Blackout',
    text: 'The channel collapses under coordinated censorship.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
      { type: 'add_extraction', region: 'Mekong', amount: 1 },
    ],
  },
];
