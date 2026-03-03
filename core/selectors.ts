import type { CoreGameState, CorePlayerState, CoreTrackState, CoreZoneState, GameAction } from './types.ts';

export function getPlayer(state: CoreGameState, playerId: string): CorePlayerState | undefined {
  return state.players[playerId];
}

export function getTrack(state: CoreGameState, trackId: string): CoreTrackState | undefined {
  return state.tracks[trackId];
}

export function getZone(state: CoreGameState, zoneId: string): CoreZoneState | undefined {
  return state.zones[zoneId];
}

export function getQueuedActions(state: CoreGameState, playerId: string): GameAction[] {
  return state.players[playerId]?.queuedActions ?? [];
}

export function getPhaseId(state: CoreGameState) {
  return state.phase.id;
}
