import type { RulesetDefinition } from '../engine/types.ts';
import baseDesignPack from './base_design/pack.ts';

export const CONTENT_PACKS: RulesetDefinition[] = [baseDesignPack];

export function getRulesetById(rulesetId: string): RulesetDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === rulesetId);
}
