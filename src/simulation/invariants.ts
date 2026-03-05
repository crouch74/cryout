import type { EngineState } from '../engine/index.ts';

export type GameState = EngineState;

export function seatComrades(gameState: GameState, seat: number) {
  return Object.values(gameState.regions).reduce((sum, region) => sum + (region.comradesPresent[seat] ?? 0), 0);
}

export function totalComrades(gameState: GameState) {
  return gameState.players.reduce((sum, player) => sum + seatComrades(gameState, player.seat), 0);
}

export function totalEvidence(gameState: GameState) {
  return gameState.players.reduce((sum, player) => sum + player.evidence, 0);
}

export function validateResourceInvariants(gameState: GameState) {
  for (const player of gameState.players) {
    const seatTotal = seatComrades(gameState, player.seat);
    if (seatTotal < 0) {
      throw new Error(`💥 Comrades resource underflow detected for seat ${player.seat}`);
    }
  }

  const coalitionComrades = totalComrades(gameState);
  if (coalitionComrades < 0) {
    throw new Error('💥 Comrades resource underflow detected');
  }

  if (coalitionComrades === 0 && gameState.round === 1 && process.env.SIMULATION_QUIET !== '1') {
    console.warn('⚠️ Comrades exhausted in round 1 — possible bug');
  }
}
