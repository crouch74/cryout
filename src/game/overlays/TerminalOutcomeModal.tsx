import type { CompiledContent, EngineState } from '../../engine/index.ts';
import { formatNumber, localizeRulesetField, t } from '../../i18n/index.ts';
import { presentTerminalOutcome } from '../presentation/historyPresentation.ts';
import { Icon } from '../../ui/icon/Icon.tsx';
import { ModalFrame } from '../../ui/components/overlay/ModalFrame.tsx';
import { MetricRibbon } from '../../ui/components/data/MetricRibbon.tsx';
import { UiButton } from '../../ui/components/actions/UiButton.tsx';

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
  const finalStateItems = [
    { label: t('ui.game.globalGaze', 'Global Gaze'), value: formatNumber(state.globalGaze) },
    { label: t('ui.game.northernWarMachine', 'War Machine'), value: formatNumber(state.northernWarMachine) },
    { label: t('ui.game.extractionTokens', 'Extraction Tokens'), value: formatNumber(totalExtraction) },
    ...(state.secretMandatesEnabled ? [{ label: t('ui.game.secretMandate', 'Secret Mandates'), value: mandateSummary }] : []),
  ];

  return (
    <ModalFrame
      open={open}
      size="lg"
      variant="game"
      title={outcome.title}
      description={localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
      shellClassName={`terminal-outcome-shell terminal-outcome-${state.phase === 'WIN' ? 'victory' : 'defeat'}`.trim()}
      className="terminal-outcome-card"
    >
      <div className="terminal-outcome-header">
        <span className="engraved-eyebrow">{outcome.eyebrow}</span>
        <p className="terminal-outcome-ruleset">
          {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
        </p>
      </div>

      <section className="terminal-outcome-summary">
        <strong>{outcome.reasonLabel}</strong>
        <p>{outcome.summary}</p>
      </section>

      <section aria-label={t('ui.terminal.finalState', 'Final state')}>
        <MetricRibbon className="terminal-outcome-final-state" columns={state.secretMandatesEnabled ? 4 : 3} items={finalStateItems} />
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
        <UiButton variant="primary" onClick={onReviewLedger} icon={<Icon type="ledger" size="md" />}>
          {t('ui.terminal.reviewLedger', 'Review Ledger')}
        </UiButton>
        <UiButton variant="secondary" onClick={onBack} icon={<Icon type="home" size="md" />}>
          {t('ui.terminal.backHome', 'Back Home')}
        </UiButton>
      </div>
    </ModalFrame>
  );
}
