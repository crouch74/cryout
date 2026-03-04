import type { CompiledContent, EngineState } from '../../engine/index.ts';
import { formatNumber, localizeRulesetField, t } from '../../i18n/index.ts';
import { presentTerminalOutcome } from '../presentation/historyPresentation.ts';
import { Icon } from '../../ui/icon/Icon.tsx';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';

interface TerminalOutcomeModalProps {
  open?: boolean;
  state: EngineState;
  content: CompiledContent;
  onReviewLedger: () => void;
  onBack: () => void;
}

export function TerminalOutcomeModal({
  open = true,
  state,
  content,
  onReviewLedger,
  onBack,
}: TerminalOutcomeModalProps) {
  if (!open) {
    return null;
  }

  const outcome = presentTerminalOutcome(state, content);
  if (!outcome) {
    return null;
  }

  const totalExtraction = Object.values(state.regions).reduce((sum, region) => sum + region.extractionTokens, 0);
  const mandateSummary = state.terminalOutcome?.cause === 'mandate_failure'
    ? t('ui.terminal.finalMandatesFailed', '{{count}} failed', {
      count: state.terminalOutcome.failedMandateIds?.length ?? 0,
    })
    : t('ui.terminal.finalMandatesHeld', 'held');

  return (
    <div
      className={`modal-shell terminal-outcome-shell terminal-outcome-${state.phase === 'WIN' ? 'victory' : 'defeat'}`.trim()}
      role="presentation"
    >
      <PaperSheet
        tone="folio"
        className="modal-card terminal-outcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-outcome-title"
      >
        <header className="terminal-outcome-header">
          <span className="engraved-eyebrow">{outcome.eyebrow}</span>
          <h2 id="terminal-outcome-title">{outcome.title}</h2>
          <p className="terminal-outcome-ruleset">
            {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
          </p>
        </header>

        <section className="terminal-outcome-summary">
          <strong>{outcome.reasonLabel}</strong>
          <p>{outcome.summary}</p>
        </section>

        <section className="terminal-outcome-final-state" aria-label={t('ui.terminal.finalState', 'Final state')}>
          <article>
            <span>{t('ui.game.globalGaze', 'Global Gaze')}</span>
            <strong>{formatNumber(state.globalGaze)}</strong>
          </article>
          <article>
            <span>{t('ui.game.northernWarMachine', 'War Machine')}</span>
            <strong>{formatNumber(state.northernWarMachine)}</strong>
          </article>
          <article>
            <span>{t('ui.game.extractionTokens', 'Extraction Tokens')}</span>
            <strong>{formatNumber(totalExtraction)}</strong>
          </article>
          {state.secretMandatesEnabled ? (
            <article>
              <span>{t('ui.game.secretMandate', 'Secret Mandates')}</span>
              <strong>{mandateSummary}</strong>
            </article>
          ) : null}
        </section>

        <div className="terminal-outcome-grid">
          <section className="terminal-outcome-section">
            <span className="engraved-eyebrow">{t('ui.terminal.contextHeading', 'Context')}</span>
            <div className="terminal-outcome-list">
              {outcome.contextLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>

          <section className="terminal-outcome-section">
            <span className="engraved-eyebrow">{t('ui.terminal.feedbackHeading', 'Feedback')}</span>
            <div className="terminal-outcome-list">
              {outcome.feedbackLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        </div>

        <blockquote className="terminal-outcome-closing">
          {outcome.closingNote}
        </blockquote>

        <div className="terminal-outcome-actions">
          <button type="button" className="primary-button" onClick={onReviewLedger}>
            <Icon type="ledger" size={18} />
            <span>{t('ui.terminal.reviewLedger', 'Review Ledger')}</span>
          </button>
          <button type="button" className="secondary-button" onClick={onBack}>
            <Icon type="home" size={18} />
            <span>{t('ui.terminal.backHome', 'Back Home')}</span>
          </button>
        </div>
      </PaperSheet>
    </div>
  );
}
