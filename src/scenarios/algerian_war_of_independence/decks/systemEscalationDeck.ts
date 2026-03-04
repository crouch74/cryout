import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_alg_colonial_army_sweep',
    deck: 'system',
    name: 'Colonial Army Sweep',
    text: 'Add 1 Extraction Token to the region most vulnerable to War Machine, raise War Machine by 1, and increase future campaign targets by 1.',
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
    text: 'Advance Empty Stomach by 1, add 1 Extraction Token to French Metropole Influence, and increase Global Appeal cost by 1 Evidence.',
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
    text: 'Advance Gilded Cage by 1, make every faction lose 1 Evidence, and reduce future investigate draws by 1.',
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
    text: 'Raise War Machine by 1, lower Global Gaze by 1, and give future campaigns -1 total modifier.',
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
    text: 'Add 1 Extraction Token to the region most vulnerable to Gilded Cage, advance Unfinished Justice by 1, and increase future crisis extraction by 1.',
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
    text: 'Add 1 Extraction Token to Tunisian Border, reduce Revolutionary Wave by 1, increase future campaign targets by 1, and draw 1 extra crisis card during future system pressure.',
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
