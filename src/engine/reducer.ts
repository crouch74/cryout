import { applyBuiltInCommand } from './commands/handlers.ts';
import { BUILT_IN_CORE_COMMANDS } from './commands/types.ts';
import { validateBuiltInCommand } from './commands/validation.ts';
import { resolveEffectQueue } from './effects/queue.ts';
import { runSystemTurn } from './ai/runner.ts';
import { evaluateGameResult } from './rules/outcomes.ts';
import { getActionResolutionContext, validateCommandAction } from './rules/runner.ts';
import { cloneCoreState } from './validation/state.ts';
import { validateCoreInvariants } from './validation/invariants.ts';
import type { CoreCommand, CoreEffect, CoreGameState, GameAction, ReductionResult, ScenarioModule } from './types.ts';

function appendDebug(debugTrace: string[], message: string) {
  debugTrace.push(message);
}

function appendHookEvents(
  state: CoreGameState,
  emittedEvents: ReductionResult['emittedEvents'],
  events: import('./types.ts').StructuredEvent[] | undefined,
) {
  for (const event of events ?? []) {
    emittedEvents.push(event);
    state.log.push({
      ...event,
      round: state.round,
      phaseId: state.phase.id,
    });
  }
}

function appendHookEffects(effects: CoreEffect[], hookResult: ReturnType<ScenarioModule['hooks']['onBeforeAction']>, debugTrace: string[]) {
  if (!hookResult) {
    return;
  }
  if (hookResult.effects) {
    effects.push(...hookResult.effects);
  }
  debugTrace.push(...(hookResult.debug ?? []));
}

function resolveAction(
  state: CoreGameState,
  action: GameAction,
  scenario: ScenarioModule,
  command: CoreCommand,
  emittedEvents: ReductionResult['emittedEvents'],
  debugTrace: string[],
) {
  const queue: CoreEffect[] = [];
  appendDebug(debugTrace, `🎲 Core action ${action.id} entered reducer.`);

  const beforeHook = scenario.hooks.onBeforeAction(action, {
    state,
    scenario,
    command,
    action,
    emittedEvents,
    debugTrace,
  });
  appendHookEffects(queue, beforeHook, debugTrace);

  const resolution = getActionResolutionContext(state, action, scenario);
  if (resolution.costs.length > 0) {
    appendDebug(debugTrace, `💸 Action ${action.id} costs ${resolution.costs.map((entry) => `${entry.amount}:${entry.resourceId}`).join(', ')}.`);
  }
  if (resolution.modifiers.length > 0) {
    appendDebug(debugTrace, `🧮 Action ${action.id} resolved ${resolution.modifiers.length} modifiers.`);
  }

  const resolver = scenario.behaviors.actionResolvers[action.id];
  if (resolver) {
    queue.push(...resolver(state, action, scenario, { state, scenario, command, action, emittedEvents, debugTrace }));
  }

  resolveEffectQueue(state, queue, scenario, command, action, emittedEvents, debugTrace);

  const afterHook = scenario.hooks.onAfterAction(action, {
    state,
    scenario,
    command,
    action,
    emittedEvents,
    debugTrace,
  });
  if (afterHook?.effects?.length) {
    resolveEffectQueue(state, afterHook.effects, scenario, command, action, emittedEvents, debugTrace);
  }
  debugTrace.push(...(afterHook?.debug ?? []));
}

export function dispatchCoreCommand(
  state: CoreGameState,
  command: CoreCommand,
  scenario: ScenarioModule,
): ReductionResult {
  if (scenario.behaviors.commandBridge?.dispatch) {
    return scenario.behaviors.commandBridge.dispatch(state, command, scenario);
  }

  const next = cloneCoreState(state);
  const emittedEvents: ReductionResult['emittedEvents'] = [];
  const debugTrace: string[] = [];
  const validationErrors = [
    ...validateBuiltInCommand(next, command),
    ...validateCommandAction(next, command, scenario),
  ];

  if (validationErrors.length > 0) {
    appendDebug(debugTrace, `❌ Command ${command.type} failed validation.`);
    return { state: next, emittedEvents, validationErrors, debugTrace };
  }

  next.commandLog.push(structuredClone(command));

  switch (command.type) {
    case BUILT_IN_CORE_COMMANDS.action:
      if (command.action) {
        resolveAction(next, command.action, scenario, command, emittedEvents, debugTrace);
      }
      break;
    case BUILT_IN_CORE_COMMANDS.runSystem: {
      const roundStartHook = scenario.hooks.onRoundStart({
        state: next,
        scenario,
        command,
        emittedEvents,
        debugTrace,
      });
      if (roundStartHook?.effects?.length) {
        resolveEffectQueue(next, roundStartHook.effects, scenario, command, undefined, emittedEvents, debugTrace);
      }
      appendHookEvents(next, emittedEvents, roundStartHook?.events);
      debugTrace.push(...(roundStartHook?.debug ?? []));

      const effects = runSystemTurn(next, scenario);
      resolveEffectQueue(next, effects, scenario, command, undefined, emittedEvents, debugTrace);
      break;
    }
    case BUILT_IN_CORE_COMMANDS.resolveQueue: {
      const ordered = Object.values(next.players)
        .flatMap((player) => player.queuedActions.map((action) => ({ playerId: player.id, action })))
        .sort((left, right) => String(left.action.id).localeCompare(String(right.action.id)));
      for (const entry of ordered) {
        resolveAction(next, entry.action, scenario, command, emittedEvents, debugTrace);
      }
      for (const player of Object.values(next.players)) {
        player.queuedActions = [];
      }

      const roundEndHook = scenario.hooks.onRoundEnd({
        state: next,
        scenario,
        command,
        emittedEvents,
        debugTrace,
      });
      if (roundEndHook?.effects?.length) {
        resolveEffectQueue(next, roundEndHook.effects, scenario, command, undefined, emittedEvents, debugTrace);
      }
      appendHookEvents(next, emittedEvents, roundEndHook?.events);
      debugTrace.push(...(roundEndHook?.debug ?? []));
      break;
    }
    default:
      applyBuiltInCommand(next, command);
      break;
  }

  if (command.type === BUILT_IN_CORE_COMMANDS.advancePhase) {
    const phaseStartHook = scenario.hooks.onPhaseStart(next.phase.id, {
      state: next,
      scenario,
      command,
      emittedEvents,
      debugTrace,
    });
    if (phaseStartHook?.effects?.length) {
      resolveEffectQueue(next, phaseStartHook.effects, scenario, command, undefined, emittedEvents, debugTrace);
    }
    appendHookEvents(next, emittedEvents, phaseStartHook?.events);
    debugTrace.push(...(phaseStartHook?.debug ?? []));
  }

  const gameResult = evaluateGameResult(next, scenario);
  if (gameResult) {
    next.status = gameResult.status;
    next.flags.gameResult = gameResult as unknown as import('./types.ts').JsonValue;
    const gameEndHook = scenario.hooks.onGameEnd(gameResult, {
      state: next,
      scenario,
      command,
      result: gameResult,
      emittedEvents,
      debugTrace,
    });
    if (gameEndHook?.effects?.length) {
      resolveEffectQueue(next, gameEndHook.effects, scenario, command, undefined, emittedEvents, debugTrace);
    }
    appendHookEvents(next, emittedEvents, gameEndHook?.events);
    debugTrace.push(...(gameEndHook?.debug ?? []));
  }

  const invariantErrors = validateCoreInvariants(next);
  validationErrors.push(...invariantErrors);
  if (invariantErrors.length > 0) {
    appendDebug(debugTrace, `🧱 Invariant validation found ${invariantErrors.length} issue(s).`);
  }

  return { state: next, emittedEvents, validationErrors, debugTrace };
}
