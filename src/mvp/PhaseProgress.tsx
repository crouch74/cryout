import type { Phase } from '../../engine/index.ts';
import { useMemo, type ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { getPhaseProgressSteps } from './gameUiHelpers.ts';
import { PrintedTrack } from './tabletop.tsx';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';

interface PhaseProgressProps {
  phase: Phase;
  activeContent?: ReactNode;
  activeHint?: string;
}

export function PhaseProgress({ phase, activeContent, activeHint }: PhaseProgressProps) {
  const steps = getPhaseProgressSteps(phase);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === 'active'));
  const phaseSignature = useMemo(() => ({ phase }), [phase]);
  const highlightedKeys = useTransientHighlightKeys(phaseSignature, 1500);
  const isAdvancing = highlightedKeys.has('phase');

  return (
    <nav className={`phase-progress-nav ${isAdvancing ? 'is-advancing' : ''}`.trim()} aria-label={t('ui.game.turnProgress', 'Turn progress')}>
      <PrintedTrack
        ariaLabel={t('ui.game.turnProgress', 'Turn progress')}
        steps={steps.map(({ step, copy }, index) => {
          const tooltipId = `phase-progress-help-${step.toLowerCase()}`;

          return {
            key: step,
            label: t(`ui.phases.${step}`, step),
            tooltipId,
            tooltipContent: (
              <>
                <strong>{t(`ui.phases.${step}`, step)}</strong>
                <span>{copy}</span>
                {index === activeIndex && activeHint ? <span>{activeHint}</span> : null}
              </>
            ),
          };
        })}
        activeIndex={activeIndex}
        activeContent={activeContent}
      />
    </nav>
  );
}
