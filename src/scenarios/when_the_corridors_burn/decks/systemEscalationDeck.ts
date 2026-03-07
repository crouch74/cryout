import type { SystemCardDefinition } from '../../../engine/adapters/compat/types.ts';

export const systemCards: SystemCardDefinition[] = [
  {
    id: 'sys_corr_trump_operation_epic_fury',
    deck: 'system',
    name: 'Trump Orders Operation Epic Fury',
    text: 'Direct U.S. bombardment widens the corridor war. Gaza and Hormuz both tighten while the coalition faces a harder campaign threshold next round.',
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
    text: 'Basing, carriers, and rhetoric move ahead of restraint. Gulf pressure rises and every campaign faces worse modifier conditions.',
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
    text: 'Intelligence inflation widens the escalation envelope. The Black Sea theatre feeds the same war tempo and future campaigns become harder to land cleanly.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_centcom_basing_web',
    deck: 'system',
    name: 'U.S. Central Command Basing Web',
    text: 'Basing architecture across the Gulf reinforces the operational tempo. More crisis pressure is coming through the logistics lattice.',
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
    text: 'Treasury pressure extends sanctions through correspondent banks and insurer fear. Caribbean siege deepens and every new crisis hits harder.',
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
    text: 'Legal coercion and sealed dockets expand the blockade line. Caribbean organizers spend more time surviving than drawing new openings.',
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
    text: 'The Israeli war-state refuses compartmentalization. Gaza and Lebanon burn together, and the coalition’s campaign tempo slows under heavier fire.',
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
    text: 'Expulsion talk and corridor control politics shrink civilian space. Outreach gets more expensive and Gaza tightens again.',
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
    text: 'London moves closer to the escalation bloc. The Black Sea theatre hardens and the next campaigns face a steeper target.',
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
    text: 'Data fusion shortens the distance between surveillance and strike. Gaza absorbs another hit and future campaigns lose room to maneuver.',
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
    text: 'Platform and broadcast consensus narrow what counts as legitimate speech. Global witness recedes and the next global appeal costs more.',
    onReveal: [
      { type: 'modify_gaze', delta: -1 },
    ],
    persistentModifiers: {},
  },
  {
    id: 'sys_corr_meta_visibility_drop',
    deck: 'system',
    name: 'Meta Visibility Drop',
    text: 'Testimony is throttled under policy language and moderation delay. Witness shrinks and coalition draws thin out.',
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
    text: 'War and sanctions are repriced as portfolio risk rather than public ruin. Gulf and Red Sea instability now feeds the same extraction spiral.',
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
    text: 'Commodity traders and shippers pass corridor panic straight into food and fuel discipline. Crisis pressure accelerates across Red Sea routes.',
    onReveal: [
      { type: 'add_extraction', region: 'RedSeaSuezCorridor', amount: 1 },
      { type: 'add_extraction', region: 'GulfHormuzCorridor', amount: 1 },
      { type: 'modify_custom_track', trackId: 'gulf_blowback', delta: 1 },
    ],
    persistentModifiers: {},
  },
];

export default systemCards;
