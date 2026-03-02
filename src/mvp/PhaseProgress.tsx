import type { Phase } from '../../engine/index.ts';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { getPhaseProgressSteps } from './gameUiHelpers.ts';
import { PrintedTrack } from './tabletop.tsx';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';

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
  const helpRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!helpRef.current?.contains(event.target as Node)) {
        setHelpOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [helpOpen]);

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
                  <span
                    ref={helpRef}
                    className={`phase-help-anchor ${helpOpen ? 'is-open' : ''}`.trim()}
                    onMouseEnter={() => setHelpOpen(true)}
                    onMouseLeave={() => setHelpOpen(false)}
                    onFocus={() => setHelpOpen(true)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setHelpOpen(false);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="phase-help-trigger"
                      aria-expanded={helpOpen}
                      aria-controls={helpId}
                      aria-label={t('ui.game.phaseHelp', 'Phase details')}
                      title={t('ui.game.phaseHelp', 'Phase details')}
                      onClick={() => setHelpOpen((current) => !current)}
                    >
                      {t('ui.game.phaseHelpGlyph', '?')}
                    </button>
                    <span
                      id={helpId}
                      role="tooltip"
                      className={`phase-progress-help-tooltip phase-progress-help-popover ${helpOpen ? 'is-open' : ''}`.trim()}
                    >
                      <strong>{t(`ui.phases.${step}`, step)}</strong>
                      {activeHelpContent}
                      {activeHint ? <span>{activeHint}</span> : null}
                    </span>
                  </span>
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
