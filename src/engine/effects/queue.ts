import { emitStructuredEvent } from '../events/bus.ts';
import { applyPrimitiveEffect } from './primitives.ts';
import type { CoreEffect, CoreGameState, GameAction, HookContext, ReductionResult, ScenarioCard, ScenarioModule, StructuredEvent } from '../types.ts';

function appendHookEffects(queue: CoreEffect[], effects: CoreEffect[] | undefined) {
  if (effects) {
    queue.push(...effects);
  }
}

function applyHookResult(queue: CoreEffect[], emittedEvents: StructuredEvent[], debugTrace: string[], hookResult: ReturnType<ScenarioModule['hooks']['onEffectResolve']>) {
  if (!hookResult) {
    return;
  }
  appendHookEffects(queue, hookResult.effects);
  for (const event of hookResult.events ?? []) {
    emitStructuredEvent(emittedEvents, event);
  }
  debugTrace.push(...(hookResult.debug ?? []));
}

function resolveCardLifecycle(
  state: CoreGameState,
  scenario: ScenarioModule,
  deckId: string,
  card: ScenarioCard,
  command: HookContext['command'],
  action: GameAction | undefined,
  emittedEvents: StructuredEvent[],
  debugTrace: string[],
  queue: CoreEffect[],
) {
  const cardDrawResult = scenario.hooks.onCardDraw(deckId, card, {
    state,
    scenario,
    command,
    action,
    card,
    emittedEvents,
    debugTrace,
  });
  applyHookResult(queue, emittedEvents, debugTrace, cardDrawResult);

  const resolver = card.resolverId ? scenario.behaviors.cardResolvers[card.resolverId] : undefined;
  if (card.autoResolve && resolver) {
    queue.push(...resolver(state, card, scenario, { state, scenario, command, action, card, emittedEvents, debugTrace }));
    const cardResolveResult = scenario.hooks.onCardResolve(card, {
      state,
      scenario,
      command,
      action,
      card,
      emittedEvents,
      debugTrace,
    });
    applyHookResult(queue, emittedEvents, debugTrace, cardResolveResult);
  }
}

export function resolveEffectQueue(
  state: CoreGameState,
  effects: CoreEffect[],
  scenario: ScenarioModule,
  command: HookContext['command'],
  action: GameAction | undefined,
  emittedEvents: StructuredEvent[],
  debugTrace: string[],
): Pick<ReductionResult, 'state' | 'emittedEvents' | 'debugTrace'> {
  const queue = [...effects];

  while (queue.length > 0) {
    const effect = queue.shift() as CoreEffect;
    if (effect.type === 'batch') {
      queue.push(...effect.effects);
      continue;
    }

    const meta = applyPrimitiveEffect(state, effect);
    for (const event of meta.emittedEvents) {
      emitStructuredEvent(emittedEvents, event);
    }

    if (meta.drawnCards) {
      for (const entry of meta.drawnCards) {
        resolveCardLifecycle(state, scenario, entry.deckId, entry.card, command, action, emittedEvents, debugTrace, queue);
      }
    }

    const hookResult = scenario.hooks.onEffectResolve(effect, {
      state,
      scenario,
      command,
      action,
      effect,
      emittedEvents,
      debugTrace,
    });
    applyHookResult(queue, emittedEvents, debugTrace, hookResult);
  }

  return { state, emittedEvents, debugTrace };
}
