import { useEffect, useMemo, useRef, useState } from 'react';
import { getMandateStatus, getSeatFaction, type CompiledContent, type EngineState } from '../../engine/index.ts';
import { localizeFactionField, localizeScenarioField, t } from '../../i18n/index.ts';
import { Icon } from '../../ui/icon/Icon.tsx';

type MandateRevealStage = 'sealed' | 'opening' | 'revealed' | 'closing';

interface SecretMandateModalProps {
  open: boolean;
  state: EngineState;
  content: CompiledContent;
  seat: number;
  startupReveal?: boolean;
  motionMode: 'full' | 'reduced';
  autoAdvance?: boolean;
  onRequestClose: () => void;
}

export function SecretMandateModal({
  open,
  state,
  content,
  seat,
  startupReveal = false,
  motionMode,
  autoAdvance = false,
  onRequestClose,
}: SecretMandateModalProps) {
  const [stage, setStage] = useState<MandateRevealStage>('sealed');
  const [dismissEnabled, setDismissEnabled] = useState(false);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const player = state.players[seat] ?? state.players[0];
  const faction = getSeatFaction(state, content, player.seat);
  const mandate = getMandateStatus(state, content, player.seat);

  const dramatizedContext = useMemo(
    () => localizeScenarioField(content.ruleset.id, 'dramatization', content.ruleset.introduction),
    [content],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (motionMode === 'reduced') {
      setStage('revealed');
      setDismissEnabled(true);
      return;
    }

    setStage('sealed');
    setDismissEnabled(false);

    const openEnvelopeTimer = window.setTimeout(() => {
      setStage('opening');
    }, 220);

    const revealLetterTimer = window.setTimeout(() => {
      setStage('revealed');
      setDismissEnabled(true);
    }, 980);

    return () => {
      window.clearTimeout(openEnvelopeTimer);
      window.clearTimeout(revealLetterTimer);
    };
  }, [motionMode, open, seat]);

  useEffect(() => {
    if (!open || stage !== 'revealed') {
      return;
    }

    continueButtonRef.current?.focus();
  }, [open, stage]);

  useEffect(() => {
    if (!open || !autoAdvance || !dismissEnabled) {
      return;
    }

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (motionMode === 'reduced') {
        onRequestClose();
        return;
      }
      setDismissEnabled(false);
      setStage('closing');
      dismissTimerRef.current = window.setTimeout(() => {
        onRequestClose();
      }, 760);
    }, motionMode === 'reduced' ? 240 : 800);

    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [autoAdvance, dismissEnabled, motionMode, onRequestClose, open]);

  useEffect(() => () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const dismissReveal = () => {
    if (!dismissEnabled) {
      return;
    }

    if (motionMode === 'reduced') {
      onRequestClose();
      return;
    }

    setDismissEnabled(false);
    setStage('closing');
    dismissTimerRef.current = window.setTimeout(() => {
      onRequestClose();
    }, 760);
  };

  return (
    open ? (
      <div
        className={`mandate-reveal-overlay mandate-reveal-stage-${stage}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mandate-reveal-title"
        aria-describedby="mandate-reveal-description"
      >
        <div className="mandate-reveal-vignette" />
        <div className="mandate-reveal-theatre">
          <div className="mandate-envelope-spotlight" aria-hidden="true" />
          <div className="mandate-envelope-scene" aria-hidden="true">
            <div className="mandate-envelope">
              <div className="mandate-envelope-pocket" />
              <div className="mandate-envelope-letter-edge" />
              <div className="mandate-envelope-flap">
                <span className="mandate-envelope-seal">
                  <Icon type="mandate" size={18} />
                </span>
              </div>
            </div>
          </div>

          <article className="mandate-letter-sheet">
            <header className="mandate-reveal-header">
              <div className="mandate-reveal-heading">
                <span className="engraved-eyebrow">{t('ui.game.privateDispatch', 'Private Dispatch')}</span>
                <h2 id="mandate-reveal-title">{t('ui.game.secretMandate', 'Secret Mandate')}</h2>
                <p id="mandate-reveal-description">
                  {t('ui.game.mandateForFaction', 'For {{faction}} only.', {
                    faction: localizeFactionField(faction.id, 'name', faction.name),
                  })}
                </p>
              </div>
              <button
                type="button"
                className="campaign-result-tooltip-trigger mandate-reveal-close"
                onClick={dismissReveal}
                aria-label={t('ui.game.close', 'Close')}
                title={t('ui.game.close', 'Close')}
                disabled={!dismissEnabled}
              >
                <Icon type="close" size={16} ariaLabel={t('ui.game.close', 'Close')} />
              </button>
            </header>
            <span className="engraved-eyebrow">
              {startupReveal
                ? t('ui.game.startupMandateReveal', 'Private instruction before the table opens')
                : t('ui.game.privateObjective', 'Private objective')}
            </span>
            <strong className="mandate-letter-title">
              {localizeFactionField(faction.id, 'mandateTitle', mandate.title)}
            </strong>
            <p className="mandate-letter-body">
              {localizeFactionField(faction.id, 'mandateDescription', mandate.description)}
            </p>
            <blockquote className="mandate-letter-context">
              {dramatizedContext}
            </blockquote>
            <div className="mandate-letter-footer">
              <span>{localizeFactionField(faction.id, 'shortName', faction.shortName)}</span>
              <span>{t('ui.game.mandatePrivateLetter', 'Keep this letter private to your seat.')}</span>
            </div>
            <div className="mandate-reveal-actions">
              <button
                ref={continueButtonRef}
                type="button"
                className="reveal-action-button"
                disabled={!dismissEnabled}
                onClick={dismissReveal}
              >
                {startupReveal
                  ? t('ui.game.enterTable', 'Enter the Table')
                  : t('ui.game.foldLetter', 'Fold the Letter')}
              </button>
            </div>
          </article>
        </div>
      </div>
    ) : null
  );
}
