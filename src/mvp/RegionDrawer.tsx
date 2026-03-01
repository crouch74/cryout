import {
  buildEffectPreview,
  getSeatActions,
  getSeatDisabledReason,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type RegionId,
} from '../../engine/index.ts';

interface RegionDrawerProps {
  regionId: RegionId | null;
  focusedSeat: number;
  state: EngineState;
  content: CompiledContent;
  onClose: () => void;
  onCommand: (command: EngineCommand) => void;
}

export function RegionDrawer({ regionId, focusedSeat, state, content, onClose, onCommand }: RegionDrawerProps) {
  if (!regionId) {
    return null;
  }

  const region = state.regions[regionId];
  const roleActions = getSeatActions(state, content, focusedSeat).standard.filter((action) => action.targetKind === 'REGION');

  return (
    <aside className="side-drawer">
      <div className="drawer-header">
        <div>
          <h3>{regionId}</h3>
          <p>Focused seat: {focusedSeat + 1}</p>
        </div>
        <button onClick={onClose}>Close</button>
      </div>

      <section>
        <h4>Tokens & Locks</h4>
        <div className="chip-row">
          <span className="token-chip">🧍 {region.tokens.displacement}</span>
          <span className="token-chip">🛰️ {region.tokens.disinfo}</span>
          <span className="token-chip">🔒 {region.locks.length}</span>
        </div>
        <div className="drawer-stack">
          {region.locks.length === 0 && <span className="muted">No active locks.</span>}
          {region.locks.map((lock) => (
            <span key={lock} className="lock-chip">
              {lock}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h4>Vulnerabilities</h4>
        <div className="drawer-stack">
          {Object.entries(region.vulnerability).map(([front, value]) => (
            <div key={front} className="row-split">
              <span>{front}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4>Institutions</h4>
        <div className="drawer-stack">
          {region.institutions.length === 0 && <span className="muted">No institutions yet.</span>}
          {region.institutions.map((institution) => (
            <div key={institution.type} className="institution-row">
              <strong>{content.institutions[institution.type].name}</strong>
              <span>{institution.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4>Actions Targeting {regionId}</h4>
        <div className="drawer-stack">
          {roleActions.map((action) => {
            const target = { kind: 'REGION' as const, regionId };
            const disabled = getSeatDisabledReason(state, content, focusedSeat, action.id, target);
            return (
              <button
                key={action.id}
                className="drawer-action"
                disabled={disabled.disabled}
                title={disabled.reason}
                onClick={() => onCommand({ type: 'QueueIntent', seat: focusedSeat, actionId: action.id, target })}
              >
                <strong>{action.name}</strong>
                <span>{buildEffectPreview(action)}</span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
