import type { FactionId } from '../engine/index.ts';

const FALLBACK_FACTION_ACCENT = 'var(--color-accent)';

const FACTION_ACCENTS: Record<FactionId, string> = {
  congo_basin_collective: '#2f7a4c',
  levant_sumud: '#b24738',
  mekong_echo_network: '#2f8088',
  amazon_guardians: '#4d8f41',
  april_6_youth: '#b43d34',
  labor_movement: '#8f6a2d',
  independent_journalists: '#2f67ab',
  rights_defenders: '#7a4ea0',
  kurdish_women: '#b24186',
  student_union: '#2f6ecc',
  diaspora_coalition: '#5f5fc1',
  bazaar_strikers: '#b97d2f',
  male_allies: '#5d6f8f',
  fln_urban_cells: '#2f7a56',
  kabyle_maquis: '#9e6a2f',
  rural_organizing_committees: '#7d7447',
  border_solidarity_networks: '#2f8291',
};

export function getFactionAccent(factionId: FactionId | undefined | null): string {
  if (!factionId) {
    return FALLBACK_FACTION_ACCENT;
  }
  return FACTION_ACCENTS[factionId] ?? FALLBACK_FACTION_ACCENT;
}
