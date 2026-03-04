import type { RulesetDefinition } from '../../engine/adapters/compat/types.ts';
import algeriaPack from '../algerian_war_of_independence/content.ts';
import baseDesignPack from '../base_design/content.ts';
import tahrirSquarePack from '../tahrir_square/content.ts';
import womanLifeFreedomPack from '../woman_life_freedom/content.ts';

export const CONTENT_PACKS: RulesetDefinition[] = [
  baseDesignPack,
  tahrirSquarePack,
  womanLifeFreedomPack,
  algeriaPack,
];

export function getRulesetById(rulesetId: string): RulesetDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === rulesetId);
}
