import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crs_corr_rafah_gate_choked',
    deck: 'crisis',
    name: 'Rafah Gate Choked Again',
    text: 'Border control and siege discipline close another passage. Gaza tightens and Egypt is pushed back toward containment.',
    effects: [
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'modify_custom_track', trackId: 'egypt_corridor', delta: -1, clamp: { min: 0, max: 6 } },
    ],
  },
  {
    id: 'crs_corr_west_bank_mass_raids',
    deck: 'crisis',
    name: 'West Bank Mass Raids',
    text: 'Raids, checkpoints, and prison sweeps spread the siege architecture beyond Gaza.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
    ],
  },
  {
    id: 'crs_corr_beirut_suburbs_hit',
    deck: 'crisis',
    name: 'Beirut Suburbs Hit',
    text: 'The northern front is forced wider through bombardment and displacement.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'LebanonNorthernFront', amount: 1 },
    ],
  },
  {
    id: 'crs_corr_ansar_allah_shipping_shock',
    deck: 'crisis',
    name: 'Ansar Allah Shipping Shock',
    text: 'Missiles, reroutes, and naval fear scramble the Red Sea script. Shipping slows, attention rises, and the corridor still burns.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: 'RedSeaSuezCorridor', amount: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
    ],
  },
  {
    id: 'crs_corr_suez_queue_stalls',
    deck: 'crisis',
    name: 'Suez Queue Stalls',
    text: 'Containers stack, grain slows, and food discipline sharpens through the canal economy.',
    effects: [
      { type: 'add_extraction', region: 'RedSeaSuezCorridor', amount: 1 },
      { type: 'modify_domain', domain: 'EmptyStomach', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_hormuz_insurance_panic',
    deck: 'crisis',
    name: 'Hormuz Insurance Panic',
    text: 'Underwriters and shippers price the strait as a war zone. Gulf exposure deepens even before the next strike lands.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
  },
  {
    id: 'crs_corr_gulf_base_alarm',
    deck: 'crisis',
    name: 'Gulf Base Alarm',
    text: 'Retaliatory fire and basing panic spread through the host-state lattice.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
  },
  {
    id: 'crs_corr_cuba_banking_freeze',
    deck: 'crisis',
    name: 'Cuba Banking Freeze',
    text: 'Payments, medicine procurement, and shipping guarantees seize up under financial discipline.',
    effects: [
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'GildedCage', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_venezuela_oil_waiver_reversed',
    deck: 'crisis',
    name: 'Venezuela Oil Waiver Reversed',
    text: 'Pressure on Caracas intensifies through energy policy and sanctions messaging.',
    effects: [
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'FossilGrip', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_black_sea_grain_fire',
    deck: 'crisis',
    name: 'Black Sea Grain Fire',
    text: 'Port attacks and grain disruption fold another theatre back into hunger politics.',
    effects: [
      { type: 'modify_gaze', delta: 1 },
      { type: 'add_extraction', region: 'BlackSeaEasternFurnace', amount: 1 },
      { type: 'modify_domain', domain: 'EmptyStomach', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_karoline_leavitt_press_discipline',
    deck: 'crisis',
    name: 'Karoline Leavitt Press Discipline',
    text: 'The briefing room narrows what counts as legitimate witness. Narrative management squeezes Gaza again.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'modify_domain', domain: 'SilencedTruth', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_monroe_message_to_caracas',
    deck: 'crisis',
    name: 'Monroe Message to Caracas and Havana',
    text: 'Overextension abroad still leaves room for pressure in the western hemisphere. The blockade line hardens through threat and message discipline.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'StolenVoice', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
];

export default crisisCards;
