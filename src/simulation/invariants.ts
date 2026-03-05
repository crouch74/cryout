import type { EngineState } from '../engine/index.ts';

export type GameState = EngineState;

export function seatBodies(gameState: GameState, seat: number) {
  return Object.values(gameState.regions).reduce((sum, region) => sum + (region.bodiesPresent[seat] ?? 0), 0);
}

export function totalBodies(gameState: GameState) {
  return gameState.players.reduce((sum, player) => sum + seatBodies(gameState, player.seat), 0);
}

export function totalEvidence(gameState: GameState) {
  return gameState.players.reduce((sum, player) => sum + player.evidence, 0);
}

export function validateResourceInvariants(gameState: GameState) {
  for (const player of gameState.players) {
    const seatTotal = seatBodies(gameState, player.seat);
    if (seatTotal < 0) {
      throw new Error(`💥 Bodies resource underflow detected for seat ${player.seat}`);
    }
  }

  const coalitionBodies = totalBodies(gameState);
  if (coalitionBodies < 0) {
    throw new Error('💥 Bodies resource underflow detected');
  }

  if (coalitionBodies === 0 && gameState.round === 1) {
    console.warn('⚠️ Bodies exhausted in round 1 — possible bug');
  }
}
