export { CORE_VERSION } from './version.ts';
export { asCoreId, createScopedId } from './ids.ts';
export { createGameState } from './createGame.ts';
export { dispatchCoreCommand } from './reducer.ts';
export { getPhaseId, getPlayer, getQueuedActions, getTrack, getZone } from './selectors.ts';
export { createRng, nextInt, nextRandom, shuffle } from './rng.ts';
export { stringifySave, serializeSave, deserializeSave } from './persistence/serialize.ts';
export { migrateEnvelope } from './persistence/migrate.ts';
export { validateCoreInvariants } from './validation/invariants.ts';
export { validateScenarioModule } from './validation/scenario.ts';
export { cloneCoreState, createBaseState, createDefaultDeck, createDefaultPlayer } from './validation/state.ts';
export { runSystemTurn } from './ai/runner.ts';
export { evaluateRuleExpression } from './rules/predicates.ts';
export { evaluateGameResult } from './rules/outcomes.ts';
export { calculateActionCosts, getActionResolutionContext, validateCommandAction } from './rules/runner.ts';
export { collectActionModifiers } from './rules/modifiers.ts';
export { BUILT_IN_CORE_COMMANDS } from './commands/types.ts';
export { createFixtureScenario } from './testing/fixtures.ts';
export { assertScenarioConformance } from './testing/conformance.ts';
export { compileContent, getRulesetDefinition, listRulesets, listScenarios } from './adapters/compat/content.ts';
export {
  buildBalancedSeatOwners,
  dispatchCommand,
  getDisabledActionReason,
  initializeGame,
  normalizeEngineState,
  replayCommands,
  serializeForReplay,
} from './adapters/compat/runtime.ts';
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
} from './adapters/compat/selectors.ts';
export { deserializeGame, replaySerializedGame, serializeGame } from './adapters/compat/serializer.ts';
export { defineScenario, getScenarioModule, listScenarioMetadata, listScenarioModules } from '../scenarios/index.ts';
export type * from './types.ts';
export type {
  ActionDefinition,
  ActionId,
  BeaconDefinition,
  BoardRegionMapEntry,
  CardRevealEvent,
  CompiledContent,
  CrisisCardDefinition,
  DeckId,
  DisabledActionReason,
  DomainEvent,
  DomainId,
  Effect,
  EffectTrace,
  EngineCommand,
  EngineState,
  FactionDefinition,
  FactionId,
  MapViewport,
  Phase,
  PlayerState,
  QueuedIntent,
  RevealDeckId,
  RegionDefinition,
  RegionId,
  ResistanceCardDefinition,
  RollResolution,
  RulesetDefinition,
  ScenarioBoardDefinition,
  SerializedGame,
  StartGameCommand,
  StateDelta,
  SystemCardDefinition,
  SystemPersistentModifiers,
  VictoryMode,
} from './adapters/compat/types.ts';
