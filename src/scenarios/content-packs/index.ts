import type { RulesetDefinition } from '../../engine/adapters/compat/types.ts';
import egypt1919Pack from '../egypt_1919_revolution/content.ts';
import algeriaPack from '../algerian_war_of_independence/content.ts';
import stonesCryOutPack from '../stones_cry_out/content.ts';
import tahrirSquarePack from '../tahrir_square/content.ts';
import womanLifeFreedomPack from '../woman_life_freedom/content.ts';

export const CONTENT_PACKS: RulesetDefinition[] = [
  { id: 'dummy_test', name: 'DUMMY TEST SCENARIO', description: 'Testing registration...', rules: { phases: [] }, domains: [], regions: [], factions: [], actions: [], beacons: [], resistanceCards: [], crisisCards: [], systemCards: [], board: { assetPath: '', sourceViewBox: '' } } as any,
  egypt1919Pack,
  stonesCryOutPack,
  tahrirSquarePack,
  womanLifeFreedomPack,
  algeriaPack,
];

export function getRulesetById(rulesetId: string): RulesetDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === rulesetId);
}
