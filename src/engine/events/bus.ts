import type { CoreGameState, StructuredEvent, StructuredLogEntry } from '../types.ts';

export function emitStructuredEvent(events: StructuredEvent[], event: StructuredEvent) {
  events.push(event);
}

export function toLogEntry(state: CoreGameState, event: StructuredEvent): StructuredLogEntry {
  return {
    ...event,
    round: state.round,
    phaseId: state.phase.id,
  };
}
