import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crs_alg_battle_of_algiers',
    deck: 'crisis',
    name: 'Battle of Algiers',
    text: 'The colonial state saturates the capital with raids, checkpoints, and collective punishment.',
    effects: [
      { type: 'add_extraction', region: 'Algiers', amount: 1 },
      { type: 'modify_war_machine', delta: 1 },
    ],
  },
  {
    id: 'crs_alg_oas_terror_attack',
    deck: 'crisis',
    name: 'OAS Terror Attack',
    text: 'Settler terror escalates to fracture civilian life and harden colonial resolve.',
    effects: [
      { type: 'modify_domain', domain: 'EmptyStomach', delta: 1 },
      { type: 'add_extraction', region: 'Oran', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_rural_village_burned',
    deck: 'crisis',
    name: 'Rural Village Burned',
    text: 'Scorched-earth tactics punish the countryside and disrupt organizing.',
    effects: [
      { type: 'remove_bodies', region: 'SaharaSouth', seat: 2, amount: 1 },
      { type: 'add_extraction', region: 'SaharaSouth', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_mass_arrest_sweep',
    deck: 'crisis',
    name: 'Mass Arrest Sweep',
    text: 'Detention and disappearance reach deep into the movement.',
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
    text: 'The metropole debates reform while refusing the structure of colonial rule.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: 'FrenchMetropoleInfluence', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_international_press_leak',
    deck: 'crisis',
    name: 'International Press Leak',
    text: 'Testimony crosses borders and weakens the colonial story.',
    effects: [
      { type: 'modify_gaze', delta: 2 },
      { type: 'gain_evidence', seat: 0, amount: 1 },
    ],
  },
  {
    id: 'crs_alg_evian_talks',
    deck: 'crisis',
    name: 'Evian Talks',
    text: 'Negotiations open without ending coercion on the ground.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'modify_domain', domain: 'UnfinishedJustice', delta: -1 },
    ],
  },
  {
    id: 'crs_alg_border_closure',
    deck: 'crisis',
    name: 'Border Closure',
    text: 'Supply corridors tighten under coordinated surveillance.',
    effects: [
      { type: 'add_extraction', region: 'TunisianBorder', amount: 1 },
      { type: 'modify_domain', domain: 'WarMachine', delta: 1 },
    ],
  },
  {
    id: 'crs_alg_settler_militias_mobilize',
    deck: 'crisis',
    name: 'Settler Militias Mobilize',
    text: 'Pied-noir forces organize to sabotage decolonization and punish civilians.',
    effects: [
      { type: 'modify_domain', domain: 'EmptyStomach', delta: 1 },
      { type: 'add_extraction', region: 'Oran', amount: 1 },
    ],
  },
  {
    id: 'crs_alg_torture_network_exposed',
    deck: 'crisis',
    name: 'Torture Network Exposed',
    text: 'The machinery of torture becomes undeniable abroad.',
    effects: [
      { type: 'modify_gaze', delta: 2 },
      { type: 'set_scenario_flag', flag: 'tortureExposed', value: true },
    ],
  },
  {
    id: 'crs_alg_political_assassination',
    deck: 'crisis',
    name: 'Political Assassination',
    text: 'Elimination of movement leadership strains unity and trust.',
    effects: [
      { type: 'modify_domain', domain: 'RevolutionaryWave', delta: -1 },
      { type: 'remove_bodies', region: 'Algiers', seat: 0, amount: 1 },
    ],
  },
  {
    id: 'crs_alg_referendum_announcement',
    deck: 'crisis',
    name: 'Referendum Announcement',
    text: 'The colonial center offers managed transition under pressure.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'modify_domain', domain: 'UnfinishedJustice', delta: -1 },
    ],
  },
];
