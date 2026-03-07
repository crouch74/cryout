import type { ScenarioOverlayId } from './types.ts';

const SCENARIO_THEME_MAP: Record<string, ScenarioOverlayId> = {
  stones_cry_out: 'burnt-earth-resistance',
  tahrir_square: 'night-map-escalation',
  woman_life_freedom: 'dossier-of-the-disappeared',
  algerian_war_of_independence: 'desert-horizon',
  egypt_1919_revolution: 'papyrus-insurgency',
  when_the_corridors_burn: 'burnt-earth-resistance',
};

export function getScenarioOverlayForRuleset(rulesetId: string): ScenarioOverlayId | null {
  return SCENARIO_THEME_MAP[rulesetId] ?? null;
}

export function listScenarioThemeMappings() {
  return Object.entries(SCENARIO_THEME_MAP).map(([rulesetId, overlayId]) => ({
    rulesetId,
    overlayId,
  }));
}
