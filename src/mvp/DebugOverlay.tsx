import { getTemperatureBand, type EngineState } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { PaperSheet } from './tabletop.tsx';

interface DebugOverlayProps {
  state: EngineState;
  roomId?: string | null;
}

export function DebugOverlay({ state, roomId }: DebugOverlayProps) {
  const band = getTemperatureBand(state.temperature);

  return (
    <aside className="debug-ledger" aria-labelledby="debug-panel-title">
      <PaperSheet tone="folio">
        <span className="engraved-eyebrow">{t('ui.debug.title', 'Debug')}</span>
        <h4 id="debug-panel-title">{t('ui.debug.title', 'Debug')}</h4>
        <div className="ledger-list">
          <div className="ledger-row"><span>{t('ui.debug.seed', 'Seed')}</span><strong>{state.seed}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.rngCalls', 'RNG Calls')}</span><strong>{state.rng.calls}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.band', 'Band')}</span><strong>{t('ui.debug.bandValue', '{{band}} / crises {{count}}', { band: band.band, count: band.crisisCount })}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.climateRoll', 'Climate Roll')}</span><strong>{state.debug.climateRoll ?? t('ui.debug.na', 'n/a')}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.firedRules', 'Fired Rules')}</span><strong>{state.debug.firedRuleIds.join(', ') || t('ui.debug.none', 'none')}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.delayedEffects', 'Delayed Effects')}</span><strong>{state.delayedEffects.length}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.compromiseDebt', 'Compromise Debt')}</span><strong>{state.globalTokens.compromise_debt ?? 0}</strong></div>
          <div className="ledger-row"><span>{t('ui.debug.flags', 'Flags')}</span><strong>{Object.keys(state.roundFlags).join(', ') || t('ui.debug.none', 'none')}</strong></div>
          {roomId ? <div className="ledger-row"><span>{t('ui.debug.room', 'Room')}</span><strong>{roomId}</strong></div> : null}
        </div>
      </PaperSheet>
    </aside>
  );
}
