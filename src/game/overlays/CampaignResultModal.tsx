import { useId, useRef } from 'react';
import type { CampaignResolvedEventPayload, CompiledContent } from '../../engine/index.ts';
import { presentCampaignResult } from '../presentation/campaignResultPresentation.ts';
import { DiceResolutionAnimation } from './DiceResolutionAnimation.tsx';
import { Modal } from '../../ui/modal/Modal.tsx';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../../ui/primitives/index.ts';

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
      a11yTitle={presentation.title}
      a11yDescription={presentation.description}
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
                  <TooltipProvider delayDuration={100}>
                    <TooltipRoot>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="campaign-result-tooltip-trigger"
                          aria-describedby={equationTooltipId}
                          aria-label={presentation.equationHelpLabel}
                        >
                          {presentation.equationHelpGlyph}
                        </button>
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent
                          id={equationTooltipId}
                          side="top"
                          align="center"
                          sideOffset={8}
                          className="campaign-result-tooltip"
                        >
                          <strong>{presentation.equationLabel}</strong>
                          <span>{presentation.equationGeneralExplanation}</span>
                          <span>{presentation.equationSpecificExplanation}</span>
                        </TooltipContent>
                      </TooltipPortal>
                    </TooltipRoot>
                  </TooltipProvider>
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
    </Modal>
  );
}
