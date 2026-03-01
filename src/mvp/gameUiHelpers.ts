import type { Phase, PlayerState } from '../../engine/index.ts';

export const GAME_A11Y_LABELS = {
  phaseProgress: 'Turn progress',
  sharedResources: 'Coalition resources',
  coalitionDesk: 'Coalition desk',
  liveUpdates: 'Live game updates',
} as const;

export function getPhaseProgressSteps(phase: Phase) {
  const sequence: Phase[] = ['SYSTEM', 'COALITION', 'RESOLUTION'];
  const normalized = phase === 'WIN' || phase === 'LOSS' ? 'RESOLUTION' : phase;
  const activeIndex = sequence.indexOf(normalized);
  return sequence.map((step, index) => ({
    step,
    number: index + 1,
    state: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming',
    current: (index === activeIndex ? 'step' : undefined) as 'step' | undefined,
  }));
}

export function getToastRole(tone: 'info' | 'success' | 'warning' | 'error') {
  return tone === 'error' ? 'alert' : 'status';
}

export function getActiveCoalitionSeat(players: PlayerState[]) {
  return players.find((player) => !player.ready && player.actionsRemaining > 0)?.seat ?? players.at(-1)?.seat ?? 0;
}
