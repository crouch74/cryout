import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CampaignResolvedEventPayload, CompiledContent } from '../../engine/index.ts';
import { presentCampaignResult } from '../presentation/campaignResultPresentation.ts';
import { DiceResolutionAnimation } from './DiceResolutionAnimation.tsx';
import { Modal } from '../../ui/modal/Modal.tsx';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';
import { getModalRoot } from '../../ui/modal/ModalRoot.tsx';

interface CampaignResultModalProps {
  open: boolean;
  result: CampaignResolvedEventPayload | null;
  content: CompiledContent;
  motionMode: 'full' | 'reduced';
  dismissEnabled: boolean;
  onRequestClose: () => void;
  onAnimationComplete: () => void;
}

export function CampaignResultModal({
  open,
  result,
  content,
  motionMode,
  dismissEnabled,
  onRequestClose,
  onAnimationComplete,
}: CampaignResultModalProps) {
  const descriptionId = useId();
  const titleId = useId();
  const equationTooltipId = useId();
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const equationHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number } | null>(null);
  const tooltipRoot = getModalRoot();

  useEffect(() => {
    if (!tooltipOpen || !equationHelpButtonRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = equationHelpButtonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const tooltipWidth = Math.min(360, window.innerWidth - 32);
      const centeredLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      const left = Math.max(16, Math.min(centeredLeft, window.innerWidth - tooltipWidth - 16));
      const top = Math.min(rect.bottom + 10, window.innerHeight - 16);
      setTooltipStyle({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [tooltipOpen]);

  if (!result) {
    return null;
  }

  const presentation = presentCampaignResult(result, content);

  return (
    <Modal
      open={open}
      titleId={titleId}
      describedById={descriptionId}
      dismissEnabled={dismissEnabled}
      onRequestClose={onRequestClose}
      initialFocusRef={dismissEnabled ? continueButtonRef : undefined}
      shellClassName="campaign-result-shell"
      className="campaign-result-modal"
    >
      <PaperSheet tone="folio" className="campaign-result-sheet" aria-label={presentation.a11yLabel}>
        <header className="campaign-result-header">
          <span className="engraved-eyebrow">{presentation.actionLabel}</span>
          <h2 id={titleId}>{presentation.title}</h2>
          <p id={descriptionId}>{presentation.description}</p>
        </header>

        <div className="campaign-result-meta" aria-label={presentation.a11yLabel}>
          <span>{presentation.regionLabel}</span>
          <span>{presentation.domainLabel}</span>
          <span>{presentation.seatLabel}</span>
        </div>

        <section className="campaign-result-grid" aria-label={presentation.resultLabel}>
          <article className="campaign-result-panel campaign-result-panel-dice">
            <span className="engraved-eyebrow">{presentation.diceLabel}</span>
            <DiceResolutionAnimation
              kind={result.diceKind}
              values={result.dice}
              motionMode={motionMode}
              eventSeq={result.eventSeq}
              onComplete={onAnimationComplete}
              onSkip={() => undefined}
            />
            <div className="campaign-result-equation-block">
              <div className="campaign-result-equation-header">
                <span className="engraved-eyebrow">{presentation.equationLabel}</span>
                <span className="campaign-result-tooltip-anchor">
                  <button
                    ref={equationHelpButtonRef}
                    type="button"
                    className="campaign-result-tooltip-trigger"
                    aria-describedby={equationTooltipId}
                    aria-label={presentation.equationHelpLabel}
                    onMouseEnter={() => setTooltipOpen(true)}
                    onMouseLeave={() => setTooltipOpen(false)}
                    onFocus={() => setTooltipOpen(true)}
                    onBlur={() => setTooltipOpen(false)}
                  >
                    {presentation.equationHelpGlyph}
                  </button>
                </span>
              </div>
              <strong className="campaign-result-equation" aria-label={presentation.equationSummary}>
                <span className="campaign-result-equation-row" aria-hidden="true">
                  {presentation.equationTokens.map((token, index) => (
                    <span key={`${token}:${index}`} className="campaign-result-equation-token">{token}</span>
                  ))}
                </span>
              </strong>
            </div>
            <div className="campaign-result-compact-stats">
              <article className="campaign-result-compact-stat">
                <span className="engraved-eyebrow">{presentation.thresholdLabel}</span>
                <strong>{presentation.thresholdValue}</strong>
              </article>
              <article className="campaign-result-compact-stat">
                <span className="engraved-eyebrow">{presentation.resultLabel}</span>
                <strong>{presentation.resultValue}</strong>
              </article>
            </div>
          </article>

          <article className="campaign-result-panel campaign-result-panel-summary">
            <span className="engraved-eyebrow">{presentation.modifiersLabel}</span>
            <div className="campaign-result-compact-summary" aria-label={presentation.modifiersLabel}>
              {presentation.modifiers.map((modifier) => (
                <article key={modifier.key} className="campaign-result-line">
                  <span>{modifier.label}</span>
                  <strong>{modifier.value}</strong>
                </article>
              ))}
            </div>
          </article>

          <article className="campaign-result-panel campaign-result-panel-summary">
            <span className="engraved-eyebrow">{presentation.effectsLabel}</span>
            <div className="campaign-result-compact-summary" aria-label={presentation.effectsLabel}>
              {presentation.effects.map((effect) => (
                <article key={effect.key} className="campaign-result-line">
                  <span>{effect.label}</span>
                  <strong>{effect.value}</strong>
                </article>
              ))}
            </div>
          </article>
        </section>

        <div className="campaign-result-actions">
          <button
            ref={continueButtonRef}
            type="button"
            className="primary-button"
            onClick={onRequestClose}
            disabled={!dismissEnabled}
          >
            {presentation.continueLabel}
          </button>
        </div>
      </PaperSheet>
      {tooltipOpen && tooltipStyle && tooltipRoot
        ? createPortal(
          <div
            id={equationTooltipId}
            role="tooltip"
            className="campaign-result-tooltip is-overlay"
            style={{
              top: `${tooltipStyle.top}px`,
              left: `${tooltipStyle.left}px`,
              width: `min(360px, calc(100vw - 32px))`,
            }}
          >
            <strong>{presentation.equationLabel}</strong>
            <span>{presentation.equationGeneralExplanation}</span>
            <span>{presentation.equationSpecificExplanation}</span>
          </div>,
          tooltipRoot,
        )
        : null}
    </Modal>
  );
}
