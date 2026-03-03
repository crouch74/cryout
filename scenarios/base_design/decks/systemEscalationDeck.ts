import type { SystemCardDefinition } from '../../../engine/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_emergency_powers',
    deck: 'system',
    name: 'Emergency Powers Enacted',
    text: 'Exception is written into ordinary rule. Campaigns face a higher bar from here forward.',
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
    text: 'Every new crisis becomes another pretext to deepen the carve-up.',
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
    text: 'Roads, ports, and corridors become permanent security architecture.',
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
    text: 'Every campaign now moves through denser fog and better targeting.',
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
    text: 'Appeals to the outside now cost more because every concession is monetized.',
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
    text: 'Evidence circulates more slowly as suppression becomes doctrine.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
    ],
    persistentModifiers: { resistanceDrawDelta: -1 },
  },
];
