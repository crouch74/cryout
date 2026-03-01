import type { EngineState } from '../../engine/index.ts';
import { getTemperatureBand } from '../../engine/index.ts';

interface DebugOverlayProps {
  state: EngineState;
  roomId?: string | null;
}

export function DebugOverlay({ state, roomId }: DebugOverlayProps) {
  const band = getTemperatureBand(state.temperature);

  return (
    <div className="debug-overlay">
      <h4>Debug</h4>
      <div className="debug-grid">
        <span>Seed</span>
        <span>{state.seed}</span>
        <span>RNG Calls</span>
        <span>{state.rng.calls}</span>
        <span>Band</span>
        <span>
          {band.band} / crises {band.crisisCount}
        </span>
        <span>Climate Roll</span>
        <span>{state.debug.climateRoll ?? 'n/a'}</span>
        <span>Fired Rules</span>
        <span>{state.debug.firedRuleIds.join(', ') || 'none'}</span>
        <span>Delayed Effects</span>
        <span>{state.delayedEffects.length}</span>
        <span>Compromise Debt</span>
        <span>{state.globalTokens.compromise_debt ?? 0}</span>
        <span>Flags</span>
        <span>{Object.keys(state.roundFlags).join(', ') || 'none'}</span>
        {roomId && (
          <>
            <span>Room</span>
            <span>{roomId}</span>
          </>
        )}
      </div>
    </div>
  );
}
