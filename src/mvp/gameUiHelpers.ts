import type { Phase } from '../../engine/index.ts';

export const GAME_A11Y_LABELS = {
  phaseProgress: 'Turn progress',
  sharedResources: 'Shared resources',
  scenarioDesk: 'Scenario desk sections',
  coalitionDesk: 'Coalition desk sections',
  liveUpdates: 'Live game updates',
} as const;

export function getPhaseProgressSteps(phase: Phase) {
  const sequence: Phase[] = ['WORLD', 'COALITION', 'COMPROMISE', 'END'];
  const normalizedPhase = phase === 'WIN' || phase === 'LOSS' ? 'END' : phase;
  const activeIndex = sequence.indexOf(normalizedPhase);

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
