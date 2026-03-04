import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crs_alg_battle_of_algiers',
    deck: 'crisis',
    name: 'Battle of Algiers',
    text: 'Add 1 Extraction Token to Algiers and raise War Machine by 1.',
    effects: [
      { type: 'add_extraction', region: 'Algiers', amount: 1 },
      { type: 'modify_war_machine', delta: 1 },
    ],
  },
  {
    id: 'crs_alg_oas_terror_attack',
    deck: 'crisis',
    name: 'OAS Terror Attack',
    text: 'Advance Empty Stomach by 1 and add 1 Extraction Token to Oran.',
    effects: [
      { type: 'modify_domain', domain: 'EmptyStomach', delta: 1 },
      { type: 'add_extraction', region: 'Oran', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_rural_village_burned',
    deck: 'crisis',
    name: 'Rural Village Burned',
    text: 'Remove 1 Comrade from Sahara South for seat 3 and add 1 Extraction Token to Sahara South.',
    effects: [
      { type: 'remove_bodies', region: 'SaharaSouth', seat: 2, amount: 1 },
      { type: 'add_extraction', region: 'SaharaSouth', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_mass_arrest_sweep',
    deck: 'crisis',
    name: 'Mass Arrest Sweep',
    text: 'Advance Gilded Cage by 1 and make every faction lose 1 Evidence.',
    effects: [
      { type: 'modify_domain', domain: 'GildedCage', delta: 1 },
      { type: 'lose_evidence', seat: 0, amount: 1 },
      { type: 'lose_evidence', seat: 1, amount: 1 },
      { type: 'lose_evidence', seat: 2, amount: 1 },
      { type: 'lose_evidence', seat: 3, amount: 1 },
    ],
  },
  {
    id: 'crs_alg_french_national_assembly_debate',
    deck: 'crisis',
    name: 'French National Assembly Debate',
    text: 'Raise Global Gaze by 1 and add 1 Extraction Token to French Metropole Influence.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: 'FrenchMetropoleInfluence', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_international_press_leak',
    deck: 'crisis',
    name: 'International Press Leak',
    text: 'Raise Global Gaze by 2 and give seat 1 one Evidence.',
    effects: [
      { type: 'modify_gaze', delta: 2 },
      { type: 'gain_evidence', seat: 0, amount: 1 },
    ],
  },
  {
    id: 'crs_alg_evian_talks',
    deck: 'crisis',
    name: 'Evian Talks',
    text: 'Raise Global Gaze by 1 and reduce Unfinished Justice by 1.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'modify_domain', domain: 'UnfinishedJustice', delta: -1 },
    ],
  },
  {
    id: 'crs_alg_border_closure',
    deck: 'crisis',
    name: 'Border Closure',
    text: 'Add 1 Extraction Token to Tunisian Border and advance War Machine by 1.',
    effects: [
      { type: 'add_extraction', region: 'TunisianBorder', amount: 1 },
      { type: 'modify_domain', domain: 'WarMachine', delta: 1 },
    ],
  },
  {
    id: 'crs_alg_settler_militias_mobilize',
    deck: 'crisis',
    name: 'Settler Militias Mobilize',
    text: 'Advance Empty Stomach by 1 and add 1 Extraction Token to Oran.',
    effects: [
      { type: 'modify_domain', domain: 'EmptyStomach', delta: 1 },
      { type: 'add_extraction', region: 'Oran', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_torture_network_exposed',
    deck: 'crisis',
    name: 'Torture Network Exposed',
    text: 'Raise Global Gaze by 2 and mark Torture Exposed for the scenario.',
    effects: [
      { type: 'modify_gaze', delta: 2 },
      { type: 'set_scenario_flag', flag: 'tortureExposed', value: true },
    ],
  },
  {
    id: 'crs_alg_political_assassination',
    deck: 'crisis',
    name: 'Political Assassination',
    text: 'Reduce Revolutionary Wave by 1 and remove 1 Comrade from Algiers for seat 1.',
    effects: [
      { type: 'modify_domain', domain: 'RevolutionaryWave', delta: -1 },
      { type: 'remove_bodies', region: 'Algiers', seat: 0, amount: 1 },
    ],
  },
  {
    id: 'crs_alg_referendum_announcement',
    deck: 'crisis',
    name: 'Referendum Announcement',
    text: 'Raise Global Gaze by 1 and reduce Unfinished Justice by 1.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'modify_domain', domain: 'UnfinishedJustice', delta: -1 },
    ],
  },
];
