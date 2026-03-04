import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getMandateStatus, getSeatFaction, type CompiledContent, type EngineState } from '../../engine/index.ts';
import { localizeFactionField, localizeRulesetField, localizeScenarioField, t } from '../../i18n/index.ts';

type MandateRevealStage =
  | 'sealed'
  | 'breaking'
  | 'opening'
  | 'extracting'
  | 'unfolding'
  | 'revealed'
  | 'refolding'
  | 'reinserting'
  | 'closing';

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
  const openStageTimersRef = useRef<number[]>([]);
  const reverseStageTimersRef = useRef<number[]>([]);

  const player = state.players[seat] ?? state.players[0];
  const faction = getSeatFaction(state, content, player.seat);
  const mandate = getMandateStatus(state, content, player.seat);

  const dramatizedContext = useMemo(
    () => localizeScenarioField(
      content.ruleset.id,
      'dramatization',
      localizeRulesetField(content.ruleset.id, 'introduction', content.ruleset.introduction),
    ),
    [content.ruleset.id, content.ruleset.introduction],
  );

  const clearOpenStageTimers = useCallback(() => {
    openStageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    openStageTimersRef.current = [];
  }, []);

  const clearReverseStageTimers = useCallback(() => {
    reverseStageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    reverseStageTimersRef.current = [];
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const finishRevealImmediately = useCallback(() => {
    clearAutoAdvanceTimer();
    clearOpenStageTimers();
    clearReverseStageTimers();
    setStage('revealed');
    setDismissEnabled(true);
  }, [clearAutoAdvanceTimer, clearOpenStageTimers, clearReverseStageTimers]);

  const startReverseSequence = useCallback(() => {
    if (motionMode === 'reduced') {
      onRequestClose();
      return;
    }

    clearAutoAdvanceTimer();
    clearOpenStageTimers();
    clearReverseStageTimers();
    setDismissEnabled(false);
    setStage('refolding');

    reverseStageTimersRef.current = [
      window.setTimeout(() => {
        setStage('reinserting');
      }, 220),
      window.setTimeout(() => {
        setStage('closing');
      }, 520),
      window.setTimeout(() => {
        onRequestClose();
      }, 700),
    ];
  }, [clearAutoAdvanceTimer, clearOpenStageTimers, clearReverseStageTimers, motionMode, onRequestClose]);

  const dismissReveal = useCallback(() => {
    if (!dismissEnabled) {
      return;
    }

    startReverseSequence();
  }, [dismissEnabled, startReverseSequence]);

  useEffect(() => {
    if (!open) {
      return;
    }

    clearAutoAdvanceTimer();
    clearOpenStageTimers();
    clearReverseStageTimers();

    if (motionMode === 'reduced') {
      setStage('revealed');
      setDismissEnabled(true);
      return;
    }

    setStage('sealed');
    setDismissEnabled(false);

    openStageTimersRef.current = [
      window.setTimeout(() => {
        setStage('breaking');
      }, 180),
      window.setTimeout(() => {
        setStage('opening');
      }, 420),
      window.setTimeout(() => {
        setStage('extracting');
      }, 760),
      window.setTimeout(() => {
        setStage('unfolding');
      }, 1120),
      window.setTimeout(() => {
        setStage('revealed');
        setDismissEnabled(true);
      }, 1560),
    ];

    return () => {
      clearOpenStageTimers();
    };
  }, [clearAutoAdvanceTimer, clearOpenStageTimers, clearReverseStageTimers, motionMode, open, seat]);

  useEffect(() => {
    if (!open || stage !== 'revealed') {
      return;
    }

    continueButtonRef.current?.focus();
  }, [open, stage]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();

      if (dismissEnabled) {
        dismissReveal();
        return;
      }

      finishRevealImmediately();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissEnabled, dismissReveal, finishRevealImmediately, open]);

  useEffect(() => {
    if (!open || !autoAdvance || !dismissEnabled) {
      return;
    }

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      startReverseSequence();
    }, motionMode === 'reduced' ? 240 : 800);

    return () => {
      clearAutoAdvanceTimer();
    };
  }, [autoAdvance, clearAutoAdvanceTimer, dismissEnabled, motionMode, open, startReverseSequence]);

  useEffect(() => () => {
    clearAutoAdvanceTimer();
    clearOpenStageTimers();
    clearReverseStageTimers();
  }, [clearAutoAdvanceTimer, clearOpenStageTimers, clearReverseStageTimers]);

  const revealVisible = stage === 'revealed';
  const contentVisible = stage === 'unfolding' || stage === 'revealed';

  return (
    open ? (
      <div
        className={`mandate-reveal-overlay mandate-reveal-stage-${stage}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mandate-reveal-title"
        aria-describedby="mandate-reveal-description"
        onPointerDown={(event) => {
          if (!dismissEnabled) {
            finishRevealImmediately();
            return;
          }

          if (event.target === event.currentTarget) {
            dismissReveal();
          }
        }}
      >
        <div className="mandate-reveal-vignette" />
        <div className="mandate-reveal-theatre">
          <div className="mandate-envelope-spotlight" aria-hidden="true" />
          <div
            className="mandate-envelope-scene"
            role="img"
            aria-label={t('ui.game.sealedDispatch', 'Sealed private dispatch')}
          >
            <svg
              className="mandate-envelope-art mandate-envelope-art-back"
              viewBox="0 0 560 360"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="mandate-envelope-body-light" x1="64" y1="92" x2="496" y2="328" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="var(--paper-elevated)" stopOpacity="0.42" />
                  <stop offset="48%" stopColor="var(--paper-elevated)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--paper-base)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="mandate-envelope-body-shade" x1="96" y1="92" x2="496" y2="328" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="100%" stopColor="var(--mandate-envelope-paper-shadow)" />
                </linearGradient>
                <filter id="mandate-envelope-grain" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
                  <feColorMatrix
                    type="matrix"
                    values="
                      1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 0.06 0
                    "
                  />
                </filter>
              </defs>
              <ellipse className="mandate-envelope-shadow" cx="280" cy="316" rx="176" ry="30" />
              <g className="mandate-envelope-body-group">
                <rect className="mandate-envelope-body-plate" x="64" y="92" width="432" height="236" rx="26" ry="26" />
                <rect className="mandate-envelope-body-highlight" x="64" y="92" width="432" height="236" rx="26" ry="26" />
                <path
                  className="mandate-envelope-body-shade"
                  d="M490 120C462 100 404 92 280 92C156 92 98 100 70 120V302C98 316 156 322 280 322C404 322 462 316 490 302Z"
                />
                <rect className="mandate-envelope-body-grain" x="64" y="92" width="432" height="236" rx="26" ry="26" filter="url(#mandate-envelope-grain)" />
                <path className="mandate-envelope-body-crease" d="M84 106H476" />
              </g>
            </svg>
            <div className="mandate-envelope-note-well" aria-hidden="true">
              <div className="mandate-letter-folded" aria-hidden="true">
                <div className="mandate-letter-folded-face mandate-letter-folded-face-top" />
                <div className="mandate-letter-folded-face mandate-letter-folded-face-bottom" />
              </div>
            </div>
            <svg
              className="mandate-envelope-art mandate-envelope-art-front"
              viewBox="0 0 560 360"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <filter id="mandate-envelope-grain-front" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
                  <feColorMatrix
                    type="matrix"
                    values="
                      1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 0.06 0
                    "
                  />
                </filter>
              </defs>
              <g className="mandate-envelope-pocket-group">
                <path
                  className="mandate-envelope-pocket-shape"
                  d="M64 222C104 200 168 192 280 192C392 192 456 200 496 222V312C496 330 482 344 464 344H96C78 344 64 330 64 312Z"
                />
                <path className="mandate-envelope-pocket-ridge" d="M88 214C140 200 196 196 280 196C364 196 420 200 472 214" />
                <path className="mandate-envelope-pocket-seam" d="M104 222L194 338" />
                <path className="mandate-envelope-pocket-seam" d="M456 222L366 338" />
                <path className="mandate-envelope-pocket-grain" d="M64 222C104 200 168 192 280 192C392 192 456 200 496 222V312C496 330 482 344 464 344H96C78 344 64 330 64 312Z" filter="url(#mandate-envelope-grain-front)" />
              </g>
              <g className="mandate-envelope-flap-group">
                <path className="mandate-envelope-flap-shape" d="M64 92H496C446 102 390 132 280 224C170 132 114 102 64 92Z" />
                <path className="mandate-envelope-flap-highlight" d="M104 102C154 110 204 132 280 196C356 132 406 110 456 102V96H104Z" />
                <path className="mandate-envelope-flap-crease" d="M80 96C148 96 210 98 280 100C350 98 412 96 480 96" />
              </g>
              <g className="mandate-envelope-seal-group">
                <circle className="mandate-envelope-seal" cx="280" cy="172" r="21" />
                <circle className="mandate-envelope-seal-shadow" cx="280" cy="172" r="16" />
                <g className="mandate-envelope-seal-mark">
                  <path d="M272 168L280 176L288 168" />
                  <path d="M272 176H288" />
                </g>
              </g>
            </svg>
          </div>
          <div className="mandate-letter-unfold" aria-hidden="true">
            <div className="mandate-letter-unfold-panel mandate-letter-unfold-panel-top" />
            <div className="mandate-letter-unfold-panel mandate-letter-unfold-panel-bottom" />
            <div className="mandate-letter-unfold-seam" />
          </div>
          <article
            className="mandate-letter-sheet"
            aria-hidden={!contentVisible}
            aria-live={contentVisible ? 'polite' : undefined}
            onPointerDown={(event) => event.stopPropagation()}
          >
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
                tabIndex={dismissEnabled ? 0 : -1}
              >
                <X size={16} aria-label={t('ui.game.close', 'Close')} />
              </button>
            </header>
            <span className="engraved-eyebrow mandate-letter-copy">
              {startupReveal
                ? t('ui.game.startupMandateReveal', 'Private instruction before the table opens')
                : t('ui.game.privateObjective', 'Private objective')}
            </span>
            <strong className="mandate-letter-title mandate-letter-copy">
              {localizeFactionField(faction.id, 'mandateTitle', mandate.title)}
            </strong>
            <p className="mandate-letter-body mandate-letter-copy">
              {localizeFactionField(faction.id, 'mandateDescription', mandate.description)}
            </p>
            <blockquote className="mandate-letter-context mandate-letter-copy">
              {dramatizedContext}
            </blockquote>
            <div className="mandate-letter-footer mandate-letter-copy">
              <span>{localizeFactionField(faction.id, 'shortName', faction.shortName)}</span>
              <span>{t('ui.game.mandatePrivateLetter', 'Keep this letter private to your seat.')}</span>
            </div>
          </article>
          <div className="mandate-reveal-copy-hint" aria-hidden={!revealVisible}>
            <span>{t('ui.game.mandatePrivateLetter', 'Keep this letter private to your seat.')}</span>
          </div>
          <div className="mandate-reveal-actions" aria-hidden={!revealVisible}>
            <div className="mandate-reveal-action-row">
              <span className="mandate-reveal-action-copy">
                {startupReveal
                  ? t('ui.game.privateInstruction', 'Read the private instruction before the struggle resumes.')
                  : t('ui.game.privateInstructionReview', 'Review the letter, then return it to the envelope.')}
              </span>
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
          </div>
        </div>
      </div>
    ) : null
  );
}
