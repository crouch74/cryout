import type { Phase } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { getPhaseProgressSteps } from './gameUiHelpers.ts';

interface PhaseProgressProps {
  phase: Phase;
}

export function PhaseProgress({ phase }: PhaseProgressProps) {
  const steps = getPhaseProgressSteps(phase);

  return (
    <nav className="phase-progress-nav" aria-label={t('ui.game.turnProgress', 'Turn progress')}>
      <ol className="phase-progress-list">
        {steps.map(({ step, number, state, current }) => {
          return (
            <li key={step} className={`phase-progress-step phase-progress-step-${state}`}>
              <span className="phase-progress-link" aria-current={current}>
                <span className="phase-progress-index">{number}</span>
                <span className="phase-progress-label">{t(`ui.phases.${step}`, step)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
