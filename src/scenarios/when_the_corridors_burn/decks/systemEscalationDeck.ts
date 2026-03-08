import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_corr_trump_operation_epic_fury',
    deck: 'system',
    name: 'Trump Orders Operation Epic Fury',
    text: 'Raise War Machine by 1, add 1 Extraction to Gaza-West Bank and Gulf-Hormuz, and increase future campaign targets by 1. Direct U.S. strikes widen the war and tighten both fronts.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
    ],
    persistentModifiers: { campaignTargetDelta: 1 },
  },
  {
    id: 'sys_corr_hegseth_forward_posture',
    deck: 'system',
    name: 'Pete Hegseth Announces Forward Posture',
    text: 'Raise War Machine by 1, add 1 Extraction to Gulf-Hormuz, and raise Gulf War Exposure by 1. Forward-posture rhetoric normalizes more basing and more carriers.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_ratcliffe_threat_brief',
    deck: 'system',
    name: 'Ratcliffe Threat Brief',
    text: 'Lower Global Gaze by 1. Threat inflation turns intelligence into escalation cover and makes de-escalation politically harder to defend.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_centcom_basing_web',
    deck: 'system',
    name: 'U.S. Central Command Basing Web',
    text: 'Raise War Machine by 1, add 1 Extraction to Gulf-Hormuz, and raise Gulf War Exposure by 1. The Gulf basing lattice keeps sorties, refueling, and coercive logistics moving.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_ofac_secondary_squeeze',
    deck: 'system',
    name: 'OFAC Secondary Squeeze',
    text: 'Lower Global Gaze by 1, add 1 Extraction to Caribbean Siege, and increase future outreach costs by 1. Secondary sanctions spread fear through banks and insurers.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'CaribbeanSiege', amount: 1 },
    ],
    persistentModifiers: { outreachCostDelta: 1 },
  },
  {
    id: 'sys_corr_doj_extraterritorial_casework',
    deck: 'system',
    name: 'DOJ Extraterritorial Casework',
    text: 'Lower Global Gaze by 1 and lower Sanctions Breach by 1. Casework and sealed dockets turn sanctions into daily legal siege for Cuba- and Venezuela-linked networks.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'modify_domain', domain: 'GildedCage', delta: -1, clamp: { min: 0, max: 12 } },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_netanyahu_widens_front',
    deck: 'system',
    name: 'Netanyahu Widens the Front',
    text: 'Raise War Machine by 1, add 1 Extraction to Gaza-West Bank and Lebanon-Northern Front, and give future campaigns -1 total modifier. The war-state expands bombardment and displacement rather than let the fronts separate.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'add_extraction', region: 'LebanonNorthernFront', amount: 1 },
    ],
    persistentModifiers: { campaignModifierDelta: -1 },
  },
  {
    id: 'sys_corr_israel_katz_corridor_threats',
    deck: 'system',
    name: 'Israel Katz Corridor Threats',
    text: 'Lower Global Gaze by 1, reduce Rafah Corridor Opening by 1, and increase future outreach costs by 1. Expulsion threats and corridor-control language punish any opening at Rafah.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'modify_custom_track', trackId: 'egypt_corridor', delta: -1, clamp: { min: 0, max: 6 } },
    ],
    persistentModifiers: { outreachCostDelta: 1 },
  },
  {
    id: 'sys_corr_uk_atlantic_alignment',
    deck: 'system',
    name: 'UK Atlantic Alignment',
    text: 'Raise War Machine by 1, add 1 Extraction to Black Sea-Eastern Furnace, and harden UK alignment. London\'s alignment lends diplomatic cover to escalation.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'BlackSeaEasternFurnace', amount: 1 },
      { type: 'set_scenario_flag', flag: 'ukAlignmentHardened', value: true },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_palantir_target_stack',
    deck: 'system',
    name: 'Palantir Target Stack',
    text: 'Raise War Machine by 1, add 1 Extraction to Gaza-West Bank, lower Witness Networks by 1, and give future campaigns -1 total modifier. Data fusion compresses the path from surveillance to strike.',
    onReveal: [
      { type: 'modify_war_machine', delta: 1 },
      { type: 'add_extraction', region: 'GazaWestBank', amount: 1 },
      { type: 'modify_domain', domain: 'SilencedTruth', delta: -1, clamp: { min: 0, max: 12 } },
    ],
    persistentModifiers: { campaignModifierDelta: -1 },
  },
  {
    id: 'sys_corr_murdoch_bollore_war_line',
    deck: 'system',
    name: 'Murdoch and Bollore Set the War Line',
    text: 'Lower Global Gaze by 1. Broadcast empires narrow public language, delegitimize anti-war speech, and lower the cost of further escalation.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_meta_visibility_drop',
    deck: 'system',
    name: 'Meta Visibility Drop',
    text: 'Lower Global Gaze by 1, lower Witness Networks by 1, and reduce future resistance draws by 1. Platform throttling buries testimony and slows organizing.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'modify_domain', domain: 'SilencedTruth', delta: -1, clamp: { min: 0, max: 12 } },
    ],
    persistentModifiers: { resistanceDrawDelta: -1 },
  },
  {
    id: 'sys_corr_blackrock_risk_pricing',
    deck: 'system',
    name: 'BlackRock Risk Pricing',
    text: 'Lower Global Gaze by 1 and add 1 Extraction to Gulf-Hormuz. Finance treats war as volatility to price rather than ruin to stop.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_trafigura_glencore_insurance_surge',
    deck: 'system',
    name: 'Trafigura / Glencore Insurance Surge',
    text: 'Add 1 Extraction to Red Sea-Suez and Gulf-Hormuz, then raise Gulf War Exposure by 1. Commodity traders pass maritime panic straight into fuel and food costs.',
    onReveal: [
      { type: 'add_extraction', region: 'RedSeaSuezCorridor', amount: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
    persistentModifiers: {},
  },
];

export default systemCards;
