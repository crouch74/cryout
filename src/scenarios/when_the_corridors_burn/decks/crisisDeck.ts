import type { CrisisCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const crisisCards: CrisisCardDefinition[] = [
  {
    id: 'crs_corr_rafah_gate_choked',
    deck: 'crisis',
    name: 'Rafah Gate Choked Again',
    text: 'Add 1 Extraction to Gaza-West Bank and lower Egypt Corridor by 1. Crossing restrictions and inspection delays trap the wounded, squeeze medicine, and close another exit from Gaza.',
    effects: [
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'modify_custom_track', trackId: 'egypt_corridor', delta: -1, clamp: { min: 0, max: 6 } },
    ],
  },
  {
    id: 'crs_corr_west_bank_mass_raids',
    deck: 'crisis',
    name: 'West Bank Mass Raids',
    text: 'Lower Global Gaze by 1 and add 1 Extraction to Gaza-West Bank. Night raids, checkpoints, and prison sweeps widen the siege and push testimony back under armed control.',
    effects: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
    ],
  },
  {
    id: 'crs_corr_beirut_suburbs_hit',
    deck: 'crisis',
    name: 'Beirut Suburbs Hit',
    text: 'Raise War Machine by 1 and add 1 Extraction to Lebanon-Northern Front. Bombardment drives displacement through Beirut\'s southern suburbs and widens the northern front.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'LebanonNorthernFront', amount: 1 },
    ],
  },
  {
    id: 'crs_corr_ansar_allah_shipping_shock',
    deck: 'crisis',
    name: 'Ansar Allah Shipping Shock',
    text: 'Raise Global Gaze by 1 and add 1 Extraction to both Red Sea-Suez and Gulf-Hormuz. Missile risk and naval retaliation scramble shipping schedules, reroute cargo, and raise attention to the corridor war.',
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
    text: 'Add 1 Extraction to Red Sea-Suez and lower Bread Under Siege by 1. Canal delays stack containers, slow grain, and sharpen food pressure far beyond the canal itself.',
    effects: [
      { type: 'add_extraction', region: 'RedSeaSuezCorridor', amount: 1 },
      { type: 'modify_domain', domain: 'EmptyStomach', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_hormuz_insurance_panic',
    deck: 'crisis',
    name: 'Hormuz Insurance Panic',
    text: 'Lower Global Gaze by 1, add 1 Extraction to Gulf-Hormuz, and raise Gulf Blowback by 1. Insurers reprice passage, tankers hesitate, and Gulf households are dragged deeper into war exposure.',
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
    text: 'Raise War Machine by 1, add 1 Extraction to Gulf-Hormuz, and raise Gulf Blowback by 1. Retaliatory fire puts host-state bases on alert and spreads fear through workers, ports, and civilian infrastructure.',
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
    text: 'Add 1 Extraction to Caribbean Siege and lower Sanctions Breach by 1. Banking restrictions freeze payments for medicine, shipping, and basic imports.',
    effects: [
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'GildedCage', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_venezuela_oil_waiver_reversed',
    deck: 'crisis',
    name: 'Venezuela Oil Waiver Reversed',
    text: 'Add 1 Extraction to Caribbean Siege and lower Chokepoint Breakage by 1. Waiver reversal tightens fuel pressure, foreign-exchange pressure, and sanctions discipline on daily life.',
    effects: [
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'FossilGrip', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
  {
    id: 'crs_corr_black_sea_grain_fire',
    deck: 'crisis',
    name: 'Black Sea Grain Fire',
    text: 'Raise Global Gaze by 1, add 1 Extraction to Black Sea-Eastern Furnace, and lower Bread Under Siege by 1. Port strikes burn grain capacity and fold another front into hunger politics.',
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
    text: 'Lower Global Gaze by 1, add 1 Extraction to Gaza-West Bank, and lower Witness Corridors by 1. Official talking points narrow what counts as credible witness and push Gaza testimony off the agenda.',
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
    text: 'Raise War Machine by 1, add 1 Extraction to Caribbean Siege, and lower Stolen Voice by 1. Threats to Caracas and Havana harden the blockade line and warn the hemisphere that disobedient sovereignty will be punished.',
    effects: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
      { type: 'modify_domain', domain: 'StolenVoice', delta: -1, clamp: { min: 0, max: 12 } },
    ],
  },
];

export default crisisCards;
