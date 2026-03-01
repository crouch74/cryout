import type { EngineState } from '../../engine/index.ts';
import { formatNumber, t } from '../i18n/index.ts';
import { PaperSheet } from './tabletop.tsx';

export type AutoPlaySpeedLevel = 1 | 2 | 3 | 4 | 5;

interface DebugOverlayProps {
  state: EngineState;
  roomId?: string | null;
  showDebugSnapshot: boolean;
  autoPlayRounds: string;
  autoPlaySpeed: AutoPlaySpeedLevel;
  autoPlayRunning: boolean;
  autoPlayStatus: string | null;
  onToggleDebugSnapshot: () => void;
  onAutoPlayRoundsChange: (value: string) => void;
  onAutoPlaySpeedChange: (value: AutoPlaySpeedLevel) => void;
  onAutoPlayStart: () => void;
  onAutoPlayStop: () => void;
  onClose: () => void;
}

const AUTO_PLAY_SPEED_OPTIONS: Array<{ value: AutoPlaySpeedLevel; label: string }> = [
  { value: 1, label: t('ui.debug.autoplaySpeed1', '1 - Slow study') },
  { value: 2, label: t('ui.debug.autoplaySpeed2', '2 - Measured') },
  { value: 3, label: t('ui.debug.autoplaySpeed3', '3 - Standard') },
  { value: 4, label: t('ui.debug.autoplaySpeed4', '4 - Quick') },
  { value: 5, label: t('ui.debug.autoplaySpeed5', '5 - Fast-forward') },
];

export function DebugOverlay({
  state,
  roomId,
  showDebugSnapshot,
  autoPlayRounds,
  autoPlaySpeed,
  autoPlayRunning,
  autoPlayStatus,
  onToggleDebugSnapshot,
  onAutoPlayRoundsChange,
  onAutoPlaySpeedChange,
  onAutoPlayStart,
  onAutoPlayStop,
  onClose,
}: DebugOverlayProps) {
  return (
    <aside className="debug-ledger" aria-label={t('ui.debug.devPanel', 'Development panel')}>
      <PaperSheet tone="folio">
        <div className="debug-panel-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.developerTools', 'Developer Tools')}</span>
            <h4 id="debug-panel-title">{t('ui.debug.title', 'Debug')}</h4>
          </div>
          <button type="button" className="mini-plate" onClick={onClose}>
            {t('ui.debug.closePanel', 'Close Panel')}
          </button>
        </div>

        <section className="debug-panel-section" aria-labelledby="debug-autoplay-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">{t('ui.debug.autoplayEyebrow', 'Autoplay')}</span>
              <h5 id="debug-autoplay-title">{t('ui.debug.autoplayTitle', 'Run rounds automatically')}</h5>
            </div>
            {autoPlayRunning ? <span className="engraved-eyebrow">{t('ui.debug.running', 'Running')}</span> : null}
          </div>

          <div className="debug-panel-form">
            <label className="debug-panel-field">
              <span>{t('ui.debug.autoplayRounds', 'Rounds to play')}</span>
              <input
                type="number"
                min="1"
                max="24"
                value={autoPlayRounds}
                onChange={(event) => onAutoPlayRoundsChange(event.target.value)}
                disabled={autoPlayRunning}
              />
            </label>

            <label className="debug-panel-field">
              <span>{t('ui.debug.autoplaySpeed', 'Execution speed')}</span>
              <select
                value={String(autoPlaySpeed)}
                onChange={(event) => onAutoPlaySpeedChange(Number(event.target.value) as AutoPlaySpeedLevel)}
                disabled={autoPlayRunning}
              >
                {AUTO_PLAY_SPEED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="debug-panel-actions">
            <button type="button" className="mini-plate" onClick={onAutoPlayStart} disabled={autoPlayRunning}>
              {t('ui.debug.startAutoplay', 'Start Autoplay')}
            </button>
            <button type="button" className="mini-plate mini-plate-danger" onClick={onAutoPlayStop} disabled={!autoPlayRunning}>
              {t('ui.debug.stopAutoplay', 'Stop')}
            </button>
          </div>

          <p className="debug-panel-status">
            {autoPlayStatus ?? t('ui.debug.autoplayIdle', 'Ready to run scripted rounds through the normal game flow.')}
          </p>
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-snapshot-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">{t('ui.debug.snapshot', 'Snapshot')}</span>
              <h5 id="debug-snapshot-title">{t('ui.debug.snapshotTitle', 'Engine debug snapshot')}</h5>
            </div>
            <button type="button" className="mini-plate" onClick={onToggleDebugSnapshot}>
              {showDebugSnapshot ? t('ui.game.hideDebug', 'Hide Debug') : t('ui.game.showDebug', 'Show Debug')}
            </button>
          </div>

          {showDebugSnapshot ? (
            <div className="ledger-list">
              <div className="ledger-row"><span>{t('ui.debug.round', 'Round')}</span><strong>{formatNumber(state.round)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.phase', 'Phase')}</span><strong>{t(`ui.phases.${state.phase}`, state.phase)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.seed', 'Seed')}</span><strong>{state.seed}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.rngCalls', 'RNG Calls')}</span><strong>{formatNumber(state.rng.calls)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.extractionPool', 'Extraction Pool')}</span><strong>{formatNumber(state.extractionPool)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.gaze', 'Global Gaze')}</span><strong>{formatNumber(state.globalGaze)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.warMachine', 'Northern War Machine')}</span><strong>{formatNumber(state.northernWarMachine)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.activeBeacons', 'Active Beacons')}</span><strong>{state.activeBeaconIds.length || t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.systemCards', 'Last system cards')}</span><strong>{state.lastSystemCardIds.join(', ') || t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.attentionFeed', 'Attention feed')}</span><strong>{state.publicAttentionEvents.at(-1) ?? t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.commandLog', 'Command log')}</span><strong>{formatNumber(state.commandLog.length)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.eventLog', 'Event log')}</span><strong>{formatNumber(state.eventLog.length)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.winner', 'Winner')}</span><strong>{state.winner ?? t('ui.debug.na', 'n/a')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.lossReason', 'Loss reason')}</span><strong>{state.lossReason ?? t('ui.debug.na', 'n/a')}</strong></div>
              {roomId ? <div className="ledger-row"><span>{t('ui.debug.room', 'Room')}</span><strong>{roomId}</strong></div> : null}
            </div>
          ) : null}
        </section>
      </PaperSheet>
    </aside>
  );
}
