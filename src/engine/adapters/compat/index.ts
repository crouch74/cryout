// Deprecated compatibility facade for the pre-framework engine surface.
// Prefer importing canonical APIs from `src/engine/*` and `src/scenarios/*`.
export { compileContent, getRulesetDefinition, listRulesets, listScenarios } from './content.ts';
export { createRng, nextInt, nextRandom, shuffle } from './rng.ts';
export {
  buildBalancedSeatOwners,
  dispatchCommand,
  getDisabledActionReason,
  initializeGame,
  normalizeEngineState,
  replayCommands,
  serializeForReplay,
} from './runtime.ts';
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
} from './selectors.ts';
export { deserializeGame, replaySerializedGame, serializeGame } from './serializer.ts';
export {
  BUILT_IN_CORE_COMMANDS,
} from '../../commands/types.ts';
export { CORE_VERSION } from '../../version.ts';
export { createGameState } from '../../createGame.ts';
export { deserializeSave, serializeSave, stringifySave } from '../../persistence/serialize.ts';
export { dispatchCoreCommand } from '../../reducer.ts';
export { defineScenario, getScenarioModule, listScenarioMetadata, listScenarioModules } from '../../../scenarios/index.ts';
export type * from './types.ts';
