import { getTemperatureBand, type EngineState } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';

interface DebugOverlayProps {
  state: EngineState;
  roomId?: string | null;
}

export function DebugOverlay({ state, roomId }: DebugOverlayProps) {
  const band = getTemperatureBand(state.temperature);

  return (
    <aside className="debug-panel shell-card" aria-labelledby="debug-panel-title">
      <h4 id="debug-panel-title">{t('ui.debug.title', 'Debug')}</h4>
      <div className="debug-grid">
        <span>{t('ui.debug.seed', 'Seed')}</span>
        <span>{state.seed}</span>
        <span>{t('ui.debug.rngCalls', 'RNG Calls')}</span>
        <span>{state.rng.calls}</span>
        <span>{t('ui.debug.band', 'Band')}</span>
        <span>
          {t('ui.debug.bandValue', '{{band}} / crises {{count}}', { band: band.band, count: band.crisisCount })}
        </span>
        <span>{t('ui.debug.climateRoll', 'Climate Roll')}</span>
        <span>{state.debug.climateRoll ?? t('ui.debug.na', 'n/a')}</span>
        <span>{t('ui.debug.firedRules', 'Fired Rules')}</span>
        <span>{state.debug.firedRuleIds.join(', ') || t('ui.debug.none', 'none')}</span>
        <span>{t('ui.debug.delayedEffects', 'Delayed Effects')}</span>
        <span>{state.delayedEffects.length}</span>
        <span>{t('ui.debug.compromiseDebt', 'Compromise Debt')}</span>
        <span>{state.globalTokens.compromise_debt ?? 0}</span>
        <span>{t('ui.debug.flags', 'Flags')}</span>
        <span>{Object.keys(state.roundFlags).join(', ') || t('ui.debug.none', 'none')}</span>
        {roomId && (
          <>
            <span>{t('ui.debug.room', 'Room')}</span>
            <span>{roomId}</span>
          </>
        )}
      </div>
    </aside>
  );
}
