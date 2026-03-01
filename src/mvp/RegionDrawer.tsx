import {
  getSeatActions,
  getSeatDisabledReason,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type RegionId,
  type ResourceType,
} from '../../engine/index.ts';
import type { ToastMessage } from './ToastStack.tsx';
import { formatEffectPreview, t } from '../i18n/index.ts';
import { ActionCard, PaperSheet, TokenStack, WaxSealLock } from './tabletop.tsx';

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
    <aside className="evidence-drawer" role="dialog" aria-modal="false" aria-labelledby="region-drawer-title">
      <PaperSheet tone="folio" className="evidence-drawer-sheet">
        <div className="drawer-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.civicTheatre', 'Civic Theatre')}</span>
            <h3 id="region-drawer-title">{regionName}</h3>
            <p>{t('ui.regionDrawer.focusedSeat', 'Focused seat: {{seat}}', { seat: focusedSeat + 1 })}</p>
          </div>
          <button type="button" className="mini-plate" onClick={onClose}>
            {t('ui.regionDrawer.close', 'Close')}
          </button>
        </div>

        <div className="drawer-grid">
          <PaperSheet tone="plain">
            <span className="engraved-eyebrow">{t('ui.regionDrawer.tokensLocks', 'Tokens & Locks')}</span>
            <div className="drawer-token-row">
              <TokenStack label={t('ui.game.displacement', 'Displacement')} count={region.tokens.displacement} shape="disc" icon="◎" />
              <TokenStack label={t('ui.game.disinfo', 'Disinfo')} count={region.tokens.disinfo} shape="cube" icon="▣" />
              <TokenStack label={t('ui.game.locks', 'Locks')} count={region.locks.length} shape="bar" icon="▭" />
            </div>
            <div className="lock-ribbon">
              {region.locks.length === 0 ? <span>{t('ui.status.noActiveLocks', 'No active locks.')}</span> : null}
              {region.locks.map((lock) => (
                <span key={lock} className="rule-slip">{lock}</span>
              ))}
            </div>
          </PaperSheet>

          <PaperSheet tone="plain">
            <span className="engraved-eyebrow">{t('ui.regionDrawer.vulnerabilities', 'Vulnerabilities')}</span>
            <div className="ledger-list">
              {Object.entries(region.vulnerability).map(([front, value]) => (
                <div key={front} className="ledger-row">
                  <span>{content.fronts[front as keyof CompiledContent['fronts']].name}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </PaperSheet>
        </div>

        <PaperSheet tone="plain">
          <span className="engraved-eyebrow">{t('ui.game.institutions', 'Institutions')}</span>
          <div className="ledger-list">
            {region.institutions.length === 0 ? <span>{t('ui.status.noInstitutionsYet', 'No institutions yet.')}</span> : null}
            {region.institutions.map((institution) => (
              <div key={institution.type} className="ledger-row">
                <span>{content.institutions[institution.type].name}</span>
                <strong>{institution.status}</strong>
              </div>
            ))}
          </div>
        </PaperSheet>

        <PaperSheet tone="plain">
          <span className="engraved-eyebrow">{t('ui.regionDrawer.actionsTargeting', 'Actions Targeting {{region}}', { region: regionName })}</span>
          <div className="drawer-action-grid">
            {roleActions.map((action) => {
              const target = { kind: 'REGION' as const, regionId };
              const disabled = getSeatDisabledReason(state, content, focusedSeat, action.id, target);
              return (
                <ActionCard
                  key={action.id}
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
                  <span className="engraved-eyebrow">{t('ui.actionBoard.priorityCode', 'P{{priority}}', { priority: action.resolvePriority })}</span>
                  <strong>{action.name}</strong>
                  <span>{formatEffectPreview(action, content)}</span>
                  {disabled.disabled ? <WaxSealLock label={disabled.reason ?? t('ui.game.sealed', 'Sealed')} /> : null}
                </ActionCard>
              );
            })}
          </div>
        </PaperSheet>
      </PaperSheet>
    </aside>
  );
}
