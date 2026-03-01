import { CONTENT_PACKS, getPackById } from '../content/index.ts';
import type {
  ActionDefinition,
  CardDefinition,
  CompiledContent,
  DeckId,
  ExpansionDefinition,
  FrontDefinition,
  HookName,
  InstitutionDefinition,
  PackDefinition,
  RegionDefinition,
  RoleDefinition,
  ScenarioDefinition,
  CharterClauseDefinition,
  RuleDefinition,
} from './types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function dedupeById<T extends { id: string }>(items: T[], kind: string): Record<string, T> {
  const map: Record<string, T> = {};

  for (const item of items) {
    assert(!map[item.id], `Duplicate ${kind} id: ${item.id}`);
    map[item.id] = item;
  }

  return map;
}

function collectHooks(baseHooks: RuleDefinition[], scenarioHooks: RuleDefinition[], expansionHooks: RuleDefinition[]) {
  const hookMap: Record<HookName, RuleDefinition[]> = {
    on_round_start: [],
    on_world_phase_pre: [],
    on_capture_card_resolve: [],
    on_crisis_resolve: [],
    on_player_action: [],
    on_compromise_offer: [],
    on_end_phase: [],
    on_check_win_loss: [],
  };

  for (const hook of [...baseHooks, ...scenarioHooks, ...expansionHooks]) {
    hookMap[hook.hook].push(hook);
  }

  return hookMap;
}

export function compileContent(scenarioId: string, expansionIds: string[] = []): CompiledContent {
  const basePack = CONTENT_PACKS.find((pack) => pack.type === 'base');
  const scenarioPack = CONTENT_PACKS.find((pack) => pack.type === 'scenario' && pack.scenario?.id === scenarioId);
  assert(basePack, 'Missing base content pack.');
  assert(scenarioPack?.scenario, `Missing scenario pack for ${scenarioId}.`);

  const expansions = expansionIds
    .map((expansionId) => getPackById(expansionId))
    .filter((pack): pack is PackDefinition => Boolean(pack && pack.expansion));

  const frontMap = dedupeById(basePack.fronts ?? [], 'front');
  const regionMap = dedupeById(basePack.regions ?? [], 'region');
  const institutionMap = dedupeById(basePack.institutions ?? [], 'institution');
  const charterMap = dedupeById(basePack.charter ?? [], 'charter clause');
  const roleMap = dedupeById(basePack.roles ?? [], 'role');

  const actionItems: ActionDefinition[] = [
    ...(basePack.actions ?? []),
    ...expansions.flatMap((pack) => pack.expansion?.actions ?? []),
  ];
  const actionMap = dedupeById(actionItems, 'action');

  const cards: CardDefinition[] = [
    ...(basePack.cards ?? []),
    ...expansions.flatMap((pack) => pack.expansion?.cards ?? []),
  ];
  const cardMap = dedupeById(cards, 'card');

  for (const role of Object.values(roleMap) as RoleDefinition[]) {
    for (const actionId of [...role.actionIds, ...role.breakthroughActionIds]) {
      assert(actionMap[actionId], `Role ${role.id} references missing action ${actionId}.`);
    }
  }

  const decks: Record<DeckId, string[]> = {
    capture: cards.filter((card) => card.deck === 'capture').map((card) => card.id),
    crisis: cards.filter((card) => card.deck === 'crisis').map((card) => card.id),
    culture: cards.filter((card) => card.deck === 'culture').map((card) => card.id),
  };

  const scenario = scenarioPack.scenario as ScenarioDefinition;
  const enabledExpansions: ExpansionDefinition[] = expansions
    .map((pack) => pack.expansion)
    .filter((expansion): expansion is ExpansionDefinition => Boolean(expansion));

  return {
    version: [
      basePack.version,
      scenarioPack.version,
      ...enabledExpansions.map((expansion) => expansion.id),
    ].join(':'),
    fronts: frontMap as Record<keyof CompiledContent['fronts'], FrontDefinition>,
    regions: regionMap as Record<keyof CompiledContent['regions'], RegionDefinition>,
    institutions: institutionMap as Record<keyof CompiledContent['institutions'], InstitutionDefinition>,
    charter: charterMap as Record<string, CharterClauseDefinition>,
    roles: roleMap as Record<keyof CompiledContent['roles'], RoleDefinition>,
    actions: actionMap,
    cards: cardMap,
    decks,
    hooks: collectHooks(basePack.hooks ?? [], scenario.hooks ?? [], expansions.flatMap((pack) => pack.expansion?.hooks ?? [])),
    scenario,
    expansions: enabledExpansions,
  };
}
