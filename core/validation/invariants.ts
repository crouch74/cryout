import type { CoreGameState, ValidationError } from '../types.ts';

export function validateCoreInvariants(state: CoreGameState): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [trackId, track] of Object.entries(state.tracks)) {
    if (track.min !== undefined && track.value < track.min) {
      errors.push({
        code: 'invariant.track_below_min',
        message: `Track ${trackId} fell below its minimum.`,
        path: `tracks.${trackId}.value`,
      });
    }
    if (track.max !== undefined && track.value > track.max) {
      errors.push({
        code: 'invariant.track_above_max',
        message: `Track ${trackId} exceeded its maximum.`,
        path: `tracks.${trackId}.value`,
      });
    }
  }

  for (const [deckId, deck] of Object.entries(state.decks)) {
    const seen = new Set<string>();
    for (const cardId of [...deck.drawPile, ...deck.discardPile, ...deck.active]) {
      if (seen.has(cardId)) {
        errors.push({
          code: 'invariant.duplicate_card',
          message: `Deck ${deckId} contains duplicate card ${cardId}.`,
          path: `decks.${deckId}`,
        });
      }
      seen.add(cardId);
      if (!deck.cards[cardId]) {
        errors.push({
          code: 'invariant.unknown_card',
          message: `Deck ${deckId} references unknown card ${cardId}.`,
          path: `decks.${deckId}`,
        });
      }
    }
  }

  for (const [zoneId, zone] of Object.entries(state.zones)) {
    for (const entityId of zone.entities) {
      if (!state.entities[entityId]) {
        errors.push({
          code: 'invariant.unknown_zone_entity',
          message: `Zone ${zoneId} references missing entity ${entityId}.`,
          path: `zones.${zoneId}.entities`,
        });
      }
    }
  }

  for (const [entityId, entity] of Object.entries(state.entities)) {
    if (entity.zoneId && !state.zones[entity.zoneId]) {
      errors.push({
        code: 'invariant.unknown_entity_zone',
        message: `Entity ${entityId} references missing zone ${entity.zoneId}.`,
        path: `entities.${entityId}.zoneId`,
      });
    }
  }

  return errors;
}
