import type { CoreEffect, CoreGameState, ScenarioCard, StructuredEvent } from '../types.ts';
import { toLogEntry } from '../events/bus.ts';

interface EffectResolutionMeta {
  drawnCards?: Array<{ deckId: string; card: ScenarioCard; playerId?: string }>;
  emittedEvents: StructuredEvent[];
}

function clamp(value: number, config: { min?: number; max?: number } | undefined) {
  let next = value;
  if (config?.min !== undefined) {
    next = Math.max(config.min, next);
  }
  if (config?.max !== undefined) {
    next = Math.min(config.max, next);
  }
  return next;
}

function ensurePlayerHand(state: CoreGameState, playerId: string, deckId: string) {
  const player = state.players[playerId];
  if (!player) {
    return [];
  }
  const hands = (player.data.hands ?? {}) as Record<string, string[]>;
  const current = Array.isArray(hands[deckId]) ? [...hands[deckId]] : [];
  player.data = {
    ...player.data,
    hands: {
      ...hands,
      [deckId]: current,
    },
  };
  return current;
}

export function applyPrimitiveEffect(state: CoreGameState, effect: CoreEffect): EffectResolutionMeta {
  const emittedEvents: StructuredEvent[] = [];

  switch (effect.type) {
    case 'adjustTrack': {
      const track = state.tracks[effect.trackId];
      if (track) {
        track.value = clamp(track.value + effect.delta, effect.clamp ?? { min: track.min, max: track.max });
      }
      break;
    }
    case 'setTrack': {
      const track = state.tracks[effect.trackId];
      if (track) {
        track.value = clamp(effect.value, effect.clamp ?? { min: track.min, max: track.max });
      }
      break;
    }
    case 'adjustPlayerResource': {
      const player = state.players[effect.playerId];
      if (player) {
        const before = player.resources[effect.resourceId] ?? 0;
        player.resources[effect.resourceId] = clamp(before + effect.delta, effect.clamp);
      }
      break;
    }
    case 'adjustZoneCounter': {
      const zone = state.zones[effect.zoneId];
      if (zone) {
        const before = zone.counters[effect.counterId] ?? 0;
        zone.counters[effect.counterId] = clamp(before + effect.delta, effect.clamp);
      }
      break;
    }
    case 'adjustEntityCounter': {
      const entity = state.entities[effect.entityId];
      if (entity) {
        const before = entity.counters[effect.counterId] ?? 0;
        entity.counters[effect.counterId] = clamp(before + effect.delta, effect.clamp);
      }
      break;
    }
    case 'moveEntity': {
      const entity = state.entities[effect.entityId];
      if (entity) {
        const previousZoneId = entity.zoneId;
        if (previousZoneId && state.zones[previousZoneId]) {
          state.zones[previousZoneId].entities = state.zones[previousZoneId].entities.filter((entry) => entry !== effect.entityId);
        }
        entity.zoneId = effect.zoneId;
        if (effect.zoneId && state.zones[effect.zoneId] && !state.zones[effect.zoneId].entities.includes(effect.entityId)) {
          state.zones[effect.zoneId].entities.push(effect.entityId);
        }
      }
      break;
    }
    case 'drawCard': {
      const deck = state.decks[effect.deckId];
      if (!deck) {
        break;
      }
      const drawnCards: Array<{ deckId: string; card: ScenarioCard; playerId?: string }> = [];
      const count = effect.count ?? 1;
      for (let index = 0; index < count; index += 1) {
        const cardId = deck.drawPile.shift();
        if (!cardId) {
          break;
        }
        const card = deck.cards[cardId];
        if (!card) {
          continue;
        }
        const destination = effect.destination ?? 'discard';
        if (destination === 'discard') {
          deck.discardPile.push(cardId);
        } else if (destination === 'active') {
          deck.active.push(cardId);
        } else if (destination === 'player' && effect.playerId) {
          const hand = ensurePlayerHand(state, effect.playerId, effect.deckId);
          hand.push(cardId);
        }
        drawnCards.push({ deckId: effect.deckId, card, playerId: effect.playerId });
      }
      return { drawnCards, emittedEvents };
    }
    case 'discardCard': {
      const deck = state.decks[effect.deckId];
      if (deck) {
        deck.active = deck.active.filter((cardId) => cardId !== effect.cardId);
        deck.discardPile.push(effect.cardId);
      }
      break;
    }
    case 'setFlag':
      state.flags[effect.flagId] = effect.value;
      break;
    case 'setCounter':
      state.counters[effect.counterId] = effect.value;
      break;
    case 'adjustCounter':
      state.counters[effect.counterId] = clamp((state.counters[effect.counterId] ?? 0) + effect.delta, effect.clamp);
      break;
    case 'mutateScenarioState':
      state.scenarioState[effect.key] = effect.value;
      break;
    case 'appendLog':
      state.log.push(toLogEntry(state, effect.entry));
      break;
    case 'emitEvent':
      emittedEvents.push(effect.event);
      state.log.push(toLogEntry(state, effect.event));
      break;
    case 'advancePhase':
      state.phase = { id: effect.phaseId, index: effect.index ?? state.phase.index + 1 };
      break;
    case 'batch':
      break;
  }

  return { emittedEvents };
}
