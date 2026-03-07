import type { RulesetDefinition } from '../../engine/adapters/compat/types.ts';
import egypt1919Pack from '../egypt_1919_revolution/content.ts';
import algeriaPack from '../algerian_war_of_independence/content.ts';
import stonesCryOutPack from '../stones_cry_out/content.ts';
import tahrirSquarePack from '../tahrir_square/content.ts';
import womanLifeFreedomPack from '../woman_life_freedom/content.ts';
import whenTheCorridorsBurnPack from '../when_the_corridors_burn/content.ts';

export const CONTENT_PACKS: RulesetDefinition[] = [

  egypt1919Pack,
  stonesCryOutPack,
  tahrirSquarePack,
  womanLifeFreedomPack,
  algeriaPack,
  whenTheCorridorsBurnPack,
];

export function getRulesetById(rulesetId: string): RulesetDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === rulesetId);
}
