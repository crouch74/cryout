import type { Phase } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { getPhaseProgressSteps } from './gameUiHelpers.ts';
import { PrintedTrack } from './tabletop.tsx';

interface PhaseProgressProps {
  phase: Phase;
}

export function PhaseProgress({ phase }: PhaseProgressProps) {
  const steps = getPhaseProgressSteps(phase);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === 'active'));

  return (
    <nav className="phase-progress-nav" aria-label={t('ui.game.turnProgress', 'Turn progress')}>
      <PrintedTrack
        title={t('ui.game.turnProgress', 'Turn progress')}
        steps={steps.map(({ step, number }) => `${number}. ${t(`ui.phases.${step}`, step)}`)}
        activeIndex={activeIndex}
      />
    </nav>
  );
}
