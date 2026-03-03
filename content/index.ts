import type { RulesetDefinition } from '../engine/types.ts';
import baseDesignPack from './base_design/pack.ts';
import tahrirSquarePack from './tahrir_square/pack.ts';
import womanLifeFreedomPack from './woman_life_freedom/pack.ts';

export const CONTENT_PACKS: RulesetDefinition[] = [
  baseDesignPack,
  tahrirSquarePack,
  womanLifeFreedomPack,
];

export function getRulesetById(rulesetId: string): RulesetDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === rulesetId);
}
