import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_alg_colonial_army_sweep',
    deck: 'system',
    name: 'Colonial Army Sweep',
    text: 'The colonial army tightens military pressure across the most vulnerable front.',
    onReveal: [
      { type: 'add_extraction', region: { byVulnerability: 'WarMachine' }, amount: 1 },
      { type: 'modify_war_machine', delta: 1 },
    ],
    persistentModifiers: {
      campaignTargetDelta: 1,
    },
  },
  {
    id: 'sys_alg_settler_political_veto',
    deck: 'system',
    name: 'Settler Political Veto',
    text: 'Settler pressure hardens the colonial center against compromise.',
    onReveal: [
      { type: 'modify_domain', domain: 'EmptyStomach', delta: 1 },
      { type: 'add_extraction', region: 'FrenchMetropoleInfluence', amount: 1 },
    ],
    persistentModifiers: {
      outreachCostDelta: 1,
    },
  },
  {
    id: 'sys_alg_detention_grid_tightens',
    deck: 'system',
    name: 'Detention Grid Tightens',
    text: 'The detention network widens to disappear militants and witnesses.',
    onReveal: [
      { type: 'modify_domain', domain: 'GildedCage', delta: 1 },
      { type: 'lose_evidence', seat: 0, amount: 1 },
      { type: 'lose_evidence', seat: 1, amount: 1 },
      { type: 'lose_evidence', seat: 2, amount: 1 },
      { type: 'lose_evidence', seat: 3, amount: 1 },
    ],
    persistentModifiers: {
      resistanceDrawDelta: -1,
    },
  },
  {
    id: 'sys_alg_nato_cover',
    deck: 'system',
    name: 'NATO Cover',
    text: 'Geopolitical backing shields colonial violence from immediate consequence.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'modify_gaze', delta: -1 },
    ],
    persistentModifiers: {
      campaignModifierDelta: -1,
    },
  },
  {
    id: 'sys_alg_counter_insurgency_doctrine',
    deck: 'system',
    name: 'Counter-Insurgency Doctrine',
    text: 'Doctrine spreads forced relocation, intelligence fusion, and punitive raids.',
    onReveal: [
      { type: 'add_extraction', region: { byVulnerability: 'GildedCage' }, amount: 1 },
      { type: 'modify_domain', domain: 'UnfinishedJustice', delta: 1 },
    ],
    persistentModifiers: {
      crisisExtractionBonus: 1,
    },
  },
  {
    id: 'sys_alg_administrative_partition',
    deck: 'system',
    name: 'Administrative Partition',
    text: 'Fragmentation is used to isolate fronts and discipline the struggle.',
    onReveal: [
      { type: 'add_extraction', region: 'TunisianBorder', amount: 1 },
      { type: 'modify_domain', domain: 'RevolutionaryWave', delta: -1 },
    ],
    persistentModifiers: {
      campaignTargetDelta: 1,
      crisisDrawDelta: 1,
    },
  },
];
