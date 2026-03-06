import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_emergency_powers',
    deck: 'system',
    name: 'Emergency Powers Enacted',
    text: 'The System moves first and forces a hard turn. Raise War Machine by 1, add 1 Extraction Token to the region most vulnerable to Gilded Cage, and increase future campaign targets by 1. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
    ],
    persistentModifiers: { campaignTargetDelta: 1 },
  },
  {
    id: 'sys_resource_privatization_wave',
    deck: 'system',
    name: 'Resource Privatization Wave',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to Empty Stomach, and future crisis extraction gains increase by 1. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
    persistentModifiers: { crisisExtractionBonus: 1 },
  },
  {
    id: 'sys_militarized_infrastructure',
    deck: 'system',
    name: 'Militarized Infrastructure',
    text: 'The System moves first and forces a hard turn. Raise War Machine by 1, add 1 Extraction Token to the region most vulnerable to War Machine, and draw 1 extra crisis card during future system pressure. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
    persistentModifiers: { crisisDrawDelta: 1 },
  },
  {
    id: 'sys_surveillance_normalization',
    deck: 'system',
    name: 'Surveillance Normalization',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to Silenced Truth, and give future campaigns -1 total modifier. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'SilencedTruth' }, amount: 1 },
    ],
    persistentModifiers: { campaignModifierDelta: -1 },
  },
  {
    id: 'sys_structural_adjustment_program',
    deck: 'system',
    name: 'Structural Adjustment Program',
    text: 'The System moves first and forces a hard turn. Lower Global Gaze by 1, add 1 Extraction Token to the region most vulnerable to Empty Stomach, and increase Global Appeal cost by 1 Evidence. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: { byVulnerability: 'EmptyStomach' }, amount: 1 },
    ],
    persistentModifiers: { outreachCostDelta: 1 },
  },
  {
    id: 'sys_counterinsurgency_doctrine',
    deck: 'system',
    name: 'Counterinsurgency Doctrine Expansion',
    text: 'The System moves first and forces a hard turn. Raise War Machine by 1, add 1 Extraction Token to the region most vulnerable to War Machine, and reduce future investigate draws by 1. The coalition must absorb this pressure and reorganize before the next phase.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
    persistentModifiers: { resistanceDrawDelta: -1 },
  },
];
