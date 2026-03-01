import type { PackDefinition } from '../engine/types.ts';
import basePack from './base/pack.ts';
import witnessPack from './scenarios/witness_dignity/pack.ts';
import lastResortDefensePack from './expansions/last_resort_defense/pack.ts';

export const CONTENT_PACKS: PackDefinition[] = [basePack, witnessPack, lastResortDefensePack];

export function getPackById(packId: string): PackDefinition | undefined {
  return CONTENT_PACKS.find((pack) => pack.id === packId);
}
