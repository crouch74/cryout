import {
  buildEffectPreview,
  getSeatActions,
  getSeatDisabledReason,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type RegionId,
  type ResourceType,
} from '../../engine/index.ts';
import type { ToastMessage } from './ToastStack.tsx';
import { t } from '../i18n/index.ts';

interface RegionDrawerProps {
  regionId: RegionId | null;
  focusedSeat: number;
  state: EngineState;
  content: CompiledContent;
  onClose: () => void;
  onQueueAction: (
    command: EngineCommand,
    resources: ResourceType[],
    toast: Omit<ToastMessage, 'id'>,
  ) => void;
}

export function RegionDrawer({ regionId, focusedSeat, state, content, onClose, onQueueAction }: RegionDrawerProps) {
  if (!regionId) {
    return null;
  }

  const region = state.regions[regionId];
  const regionName = content.regions[regionId].name;
  const roleActions = getSeatActions(state, content, focusedSeat).standard.filter((action) => action.targetKind === 'REGION');

  return (
    <aside className="overlay-drawer" role="dialog" aria-modal="false" aria-labelledby="region-drawer-title">
      <div className="overlay-header">
        <div>
          <h3 id="region-drawer-title">{regionName}</h3>
          <p>{t('ui.regionDrawer.focusedSeat', 'Focused seat: {{seat}}', { seat: focusedSeat + 1 })}</p>
        </div>
        <div className="overlay-actions">
          <button className="secondary-button compact-button" onClick={onClose}>
            {t('ui.regionDrawer.close', 'Close')}
          </button>
        </div>
      </div>

      <section className="overlay-section">
        <h4>{t('ui.regionDrawer.tokensLocks', 'Tokens & Locks')}</h4>
        <div className="chip-row">
          <span className="token-chip">🧍 {region.tokens.displacement}</span>
          <span className="token-chip">🛰️ {region.tokens.disinfo}</span>
          <span className="token-chip">🔒 {region.locks.length}</span>
        </div>
        <div className="overlay-stack">
          {region.locks.length === 0 && <span className="muted">{t('ui.status.noActiveLocks', 'No active locks.')}</span>}
          {region.locks.map((lock) => (
            <span key={lock} className="lock-chip">
              {lock}
            </span>
          ))}
        </div>
      </section>

      <section className="overlay-section">
        <h4>{t('ui.regionDrawer.vulnerabilities', 'Vulnerabilities')}</h4>
        <div className="overlay-stack">
          {Object.entries(region.vulnerability).map(([front, value]) => (
            <div key={front} className="row-split overlay-row">
              <span>{content.fronts[front as keyof CompiledContent['fronts']].name}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overlay-section">
        <h4>{t('ui.game.institutions', 'Institutions')}</h4>
        <div className="overlay-stack">
          {region.institutions.length === 0 && <span className="muted">{t('ui.status.noInstitutionsYet', 'No institutions yet.')}</span>}
          {region.institutions.map((institution) => (
            <div key={institution.type} className="overlay-row">
              <strong>{content.institutions[institution.type].name}</strong>
              <span>{institution.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overlay-section">
        <h4>{t('ui.regionDrawer.actionsTargeting', 'Actions Targeting {{region}}', { region: regionName })}</h4>
        <div className="overlay-stack">
          {roleActions.map((action) => {
            const target = { kind: 'REGION' as const, regionId };
            const disabled = getSeatDisabledReason(state, content, focusedSeat, action.id, target);
            return (
              <article key={action.id} className="shell-card overlay-action-card">
                <div className="row-split">
                  <strong>{action.name}</strong>
                  <span className="priority-chip">P{action.resolvePriority}</span>
                </div>
                <p>{buildEffectPreview(action)}</p>
                <p className="helper-text">{disabled.reason ?? t('ui.actionBoard.availableNow', 'Available to queue now.')}</p>
                <button
                  className="primary-button"
                  disabled={disabled.disabled}
                  onClick={() =>
                    onQueueAction(
                      { type: 'QueueIntent', seat: focusedSeat, actionId: action.id, target },
                      Object.keys(disabled.finalCosts) as ResourceType[],
                      {
                        tone: 'success',
                        title: t('ui.toast.intentQueuedTitle', 'Intent queued'),
                        message: t('ui.toast.intentQueuedFromRegionMessage', '{{action}} was added from {{region}}.', {
                          action: action.name,
                          region: regionName,
                        }),
                        dismissAfterMs: 2200,
                      },
                    )
                  }
                >
                  {t('ui.regionDrawer.queueForSeat', 'Queue for Seat {{seat}}', { seat: focusedSeat + 1 })}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
