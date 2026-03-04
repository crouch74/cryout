import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crisis_military_raid',
    deck: 'crisis',
    name: 'Military Raid',
    text: 'Add 1 Extraction Token to the region most vulnerable to War Machine and raise War Machine by 1.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_media_smear',
    deck: 'crisis',
    name: 'Media Smear',
    text: 'Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Silenced Truth.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_fuel_convoy',
    deck: 'crisis',
    name: 'Fuel Convoy',
    text: 'Raise War Machine by 1 and add 1 Extraction Token to the region most vulnerable to Fossil Grip.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'FossilGrip' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_border_lockdown',
    deck: 'crisis',
    name: 'Border Lockdown',
    text: 'Raise War Machine by 1 and add 1 Extraction Token to the region most vulnerable to Gilded Cage.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_hunger_discipline',
    deck: 'crisis',
    name: 'Hunger Discipline',
    text: 'Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Empty Stomach.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_climate_shock',
    deck: 'crisis',
    name: 'Climate Shock',
    text: 'Add 1 Extraction Token to the region most vulnerable to Dying Planet and add 1 Extraction Token to Sahel.',
    effects: [
      { type: 'add_extraction', region: { byVulnerability: 'DyingPlanet' }, amount: 1 },
      { type: 'add_extraction', region: 'Sahel', amount: 1 },
    ],
  },
  {
    id: 'crisis_memory_purge',
    deck: 'crisis',
    name: 'Memory Purge',
    text: 'Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Stolen Voice.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'StolenVoice' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_attention_backlash',
    deck: 'crisis',
    name: 'Attention Backlash',
    text: 'Raise Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to War Machine, and add 1 Extraction Token to the region most vulnerable to Silenced Truth.',
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
    text: 'Add 1 Extraction Token to Congo and add 1 Extraction Token to the region most vulnerable to Empty Stomach.',
    effects: [
      { type: 'add_extraction', region: 'Congo', amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_platform_blackout',
    deck: 'crisis',
    name: 'Platform Blackout',
    text: 'Lower Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to Silenced Truth, and add 1 Extraction Token to Mekong.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
      { type: 'add_extraction', region: 'Mekong', amount: 1 },
    ],
  },
];
