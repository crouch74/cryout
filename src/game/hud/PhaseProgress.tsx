import type { Phase } from '../../engine/index.ts';
import { useMemo, type ReactNode } from 'react';
import { t } from '../../i18n/index.ts';
import { getPhaseProgressSteps } from '../presentation/gameUiHelpers.ts';
import { PrintedTrack } from '../../ui/components/data/PrintedTrack.tsx';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';

interface PhaseProgressProps {
  phase: Phase;
  activeContent?: ReactNode;
  activeHint?: string;
  activeHelpContent?: ReactNode;
}

export function PhaseProgress({ phase, activeContent, activeHint, activeHelpContent }: PhaseProgressProps) {
  const steps = getPhaseProgressSteps(phase);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === 'active'));
  const phaseSignature = useMemo(() => ({ phase }), [phase]);
  const highlightedKeys = useTransientHighlightKeys(phaseSignature, 1500);
  const isAdvancing = highlightedKeys.has('phase');

  return (
    <nav className={`phase-progress-nav ${isAdvancing ? 'is-advancing' : ''}`.trim()} aria-label={t('ui.game.turnProgress', 'Turn progress')}>
      <PrintedTrack
        ariaLabel={t('ui.game.turnProgress', 'Turn progress')}
        steps={steps.map(({ step, copy, verb, urgency }, index) => {
          const isActive = index === activeIndex;
          const title = t(`ui.phases.${step}`, step);
          const tooltipId = `phase-help-${step.toLowerCase()}`;
          const tooltipContent = isActive && activeHelpContent
            ? (
              <>
                <strong>{title}</strong>
                {activeHelpContent}
                {activeHint ? <span>{activeHint}</span> : null}
              </>
            )
            : (
              <>
                <strong>{title}</strong>
                <span className="phase-help-copy">
                  <span>{copy}</span>
                  <span>{`${verb} • ${urgency}`}</span>
                </span>
              </>
            );

          return {
            key: step,
            tooltipId,
            tooltipClassName: 'phase-progress-help-popover',
            tooltipContent,
            label: (
              <span className="phase-progress-label-shell">
                <span>{title}</span>
                <span className="phase-help-trigger" aria-expanded={isActive && activeHelpContent ? 'true' : 'false'}>
                  <span className="phase-help-glyph" aria-hidden="true">{t('ui.game.phaseHelpGlyph', '?')}</span>
                </span>
              </span>
            ),
          };
        })}
        activeIndex={activeIndex}
        activeContent={activeContent}
      />
    </nav>
  );
}
