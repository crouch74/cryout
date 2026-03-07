import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

const CRISIS_EXTRACTION_REDUCTION = 2;

const baseCrisisCards: CrisisCardDefinition[] = [
  {
    id: 'crisis_military_raid',
    deck: 'crisis',
    name: 'Military Raid',
    text: 'The System moves first and forces a hard turn. Add 1 Extraction Token to the region most vulnerable to War Machine and raise War Machine by 1. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_media_smear',
    deck: 'crisis',
    name: 'Media Smear',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Silenced Truth. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_fuel_convoy',
    deck: 'crisis',
    name: 'Fuel Convoy',
    text: 'The System moves first and forces a hard turn. Raise War Machine by 1 and add 1 Extraction Token to the region most vulnerable to Fossil Grip. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'FossilGrip' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_border_lockdown',
    deck: 'crisis',
    name: 'Border Lockdown',
    text: 'The System moves first and forces a hard turn. Raise War Machine by 1 and add 1 Extraction Token to the region most vulnerable to Gilded Cage. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_hunger_discipline',
    deck: 'crisis',
    name: 'Hunger Discipline',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Empty Stomach. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_climate_shock',
    deck: 'crisis',
    name: 'Climate Shock',
    text: 'The System moves first and forces a hard turn. Add 1 Extraction Token to the region most vulnerable to Dying Planet and add 1 Extraction Token to Sahel. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'add_extraction', region: { byVulnerability: 'DyingPlanet' }, amount: 1 },
      { type: 'add_extraction', region: 'Sahel', amount: 1 },
    ],
  },
  {
    id: 'crisis_memory_purge',
    deck: 'crisis',
    name: 'Memory Purge',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1 and add 1 Extraction Token to the region most vulnerable to Stolen Voice. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'StolenVoice' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_attention_backlash',
    deck: 'crisis',
    name: 'Attention Backlash',
    text: 'The System moves first and forces a hard turn. Raise Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to War Machine, and add 1 Extraction Token to the region most vulnerable to Silenced Truth. The coalition must absorb this pressure and reorganize before the next phase.',
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
    text: 'The System moves first and forces a hard turn. Add 1 Extraction Token to Congo and add 1 Extraction Token to the region most vulnerable to Empty Stomach. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'add_extraction', region: 'Congo', amount: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
  },
  {
    id: 'crisis_platform_blackout',
    deck: 'crisis',
    name: 'Platform Blackout',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to Silenced Truth, and add 1 Extraction Token to Mekong. The coalition must absorb this pressure and reorganize before the next phase.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
      { type: 'add_extraction', region: 'Mekong', amount: 1 },
    ],
  },
];

function applyCrisisExtractionRebalance(card: CrisisCardDefinition): CrisisCardDefinition {
  return {
    ...card,
    // Pressure rebalance rule: every crisis extraction effect is reduced by 1 (floor at 0).
    effects: card.effects.map((effect) => {
      if (effect.type !== 'add_extraction') {
        return effect;
      }
      return {
        ...effect,
        amount: Math.max(0, effect.amount - CRISIS_EXTRACTION_REDUCTION),
      };
    }),
  };
}

export const crisisCards: CrisisCardDefinition[] = baseCrisisCards.map(applyCrisisExtractionRebalance);
