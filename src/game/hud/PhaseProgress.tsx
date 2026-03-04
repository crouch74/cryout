import type { Phase } from '../../engine/index.ts';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { t } from '../../i18n/index.ts';
import { getPhaseProgressSteps } from '../presentation/gameUiHelpers.ts';
import { PrintedTrack } from '../../ui/layout/tabletop.tsx';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from '../../ui/primitives/index.ts';

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
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();

  return (
    <nav className={`phase-progress-nav ${isAdvancing ? 'is-advancing' : ''}`.trim()} aria-label={t('ui.game.turnProgress', 'Turn progress')}>
      <PrintedTrack
        ariaLabel={t('ui.game.turnProgress', 'Turn progress')}
        steps={steps.map(({ step }, index) => {
          const isActive = index === activeIndex;

          return {
            key: step,
            label: (
              <span className="phase-progress-label-shell">
                <span>{t(`ui.phases.${step}`, step)}</span>
                {isActive && activeHelpContent ? (
                  <PopoverRoot open={helpOpen} onOpenChange={setHelpOpen}>
                    <span className={`phase-help-anchor ${helpOpen ? 'is-open' : ''}`.trim()}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="phase-help-trigger"
                          aria-expanded={helpOpen}
                          aria-controls={helpId}
                          aria-label={t('ui.game.phaseHelp', 'Phase details')}
                          title={t('ui.game.phaseHelp', 'Phase details')}
                        >
                          {t('ui.game.phaseHelpGlyph', '?')}
                        </button>
                      </PopoverTrigger>
                    </span>
                    <PopoverPortal>
                      <PopoverContent
                        id={helpId}
                        role="tooltip"
                        align="start"
                        side="bottom"
                        sideOffset={8}
                        className="phase-progress-help-tooltip phase-progress-help-popover"
                      >
                        <strong>{t(`ui.phases.${step}`, step)}</strong>
                        {activeHelpContent}
                        {activeHint ? <span>{activeHint}</span> : null}
                      </PopoverContent>
                    </PopoverPortal>
                  </PopoverRoot>
                ) : null}
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
