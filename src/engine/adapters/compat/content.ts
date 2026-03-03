import { CONTENT_PACKS, getRulesetById } from '../../../scenarios/content-packs/index.ts';
import type { CompiledContent, RulesetDefinition } from './types.ts';

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function listRulesets(): RulesetDefinition[] {
  return CONTENT_PACKS.slice();
}

export function listScenarios(): RulesetDefinition[] {
  return listRulesets();
}

export function getRulesetDefinition(rulesetId: string): RulesetDefinition | undefined {
  return getRulesetById(rulesetId);
}

export function compileContent(rulesetId: string = CONTENT_PACKS[0]?.id ?? 'base_design'): CompiledContent {
  const ruleset = getRulesetDefinition(rulesetId);

  if (!ruleset) {
    throw new Error(`Missing ruleset: ${rulesetId}`);
  }

  return {
    version: `design-cutover:${ruleset.id}:2`,
    ruleset,
    actions: byId(ruleset.actions) as CompiledContent['actions'],
    domains: byId(ruleset.domains) as CompiledContent['domains'],
    regions: byId(ruleset.regions) as CompiledContent['regions'],
    factions: byId(ruleset.factions) as CompiledContent['factions'],
    beacons: byId(ruleset.beacons),
    cards: byId([...ruleset.resistanceCards, ...ruleset.crisisCards, ...ruleset.systemCards]),
    decks: {
      system: ruleset.systemCards.map((card) => card.id),
      resistance: ruleset.resistanceCards.map((card) => card.id),
      crisis: ruleset.crisisCards.map((card) => card.id),
    },
  };
}
