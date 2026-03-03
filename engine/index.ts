// Deprecated compatibility facade for the pre-framework engine surface.
// Prefer importing canonical APIs from `core/*` and `scenarios/*`.
export { compileContent, getRulesetDefinition, listRulesets, listScenarios } from './legacy/content.ts';
export { createRng, nextInt, nextRandom, shuffle } from './rng.ts';
export {
  buildBalancedSeatOwners,
  dispatchCommand,
  getDisabledActionReason,
  initializeGame,
  normalizeEngineState,
  replayCommands,
  serializeForReplay,
} from './legacy/adapter.ts';
export {
  buildEffectPreview,
  getAvailableDomains,
  getAvailableRegions,
  getMandateStatus,
  getPhaseSummary,
  getPlayerBodyTotal,
  getPlayerStatusSummary,
  getSeatActions,
  getSeatDisabledReason,
  getSeatFaction,
  getVictoryModeSummary,
} from './legacy/selectors.ts';
export { deserializeGame, replaySerializedGame, serializeGame } from './legacy/serializer.ts';
export {
  BUILT_IN_CORE_COMMANDS,
  CORE_VERSION,
  createGameState,
  deserializeSave,
  dispatchCoreCommand,
  serializeSave,
  stringifySave,
} from '../core/index.ts';
export { defineScenario, getScenarioModule, listScenarioMetadata, listScenarioModules } from '../scenarios/index.ts';
export type * from './legacy/types.ts';
