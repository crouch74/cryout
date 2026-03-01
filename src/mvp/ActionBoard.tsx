import { useState } from 'react';
import {
  buildEffectPreview,
  getAvailableFronts,
  getAvailableRegions,
  getSeatActions,
  getSeatDisabledReason,
  type ActionDefinition,
  type ActionTarget,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type FrontId,
  type PlayerState,
  type RegionId,
  type ResourceType,
} from '../../engine/index.ts';
import type { ToastMessage } from './ToastStack.tsx';
import { t } from '../i18n/index.ts';

interface ActionBoardProps {
  seat: number;
  state: EngineState;
  content: CompiledContent;
  player: PlayerState;
  onQueueAction: (
    command: EngineCommand,
    resources: ResourceType[],
    toast: Omit<ToastMessage, 'id'>,
  ) => void;
}

export function ActionBoard({
  seat,
  state,
  content,
  player,
  onQueueAction,
}: ActionBoardProps) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [readingActionId, setReadingActionId] = useState<string | null>(null);
  const actions = getSeatActions(state, content, seat);
  const allActions = [...actions.standard, ...actions.breakthroughs];

  const resolveTarget = (actionId: string, targetKind: 'NONE' | 'REGION' | 'FRONT'): ActionTarget => {
    if (targetKind === 'REGION') {
      return {
        kind: 'REGION',
        regionId: (targets[actionId] as RegionId | undefined) ?? getAvailableRegions()[0],
      };
    }
    if (targetKind === 'FRONT') {
      return {
        kind: 'FRONT',
        frontId: (targets[actionId] as FrontId | undefined) ?? getAvailableFronts()[0],
      };
    }
    return { kind: 'NONE' };
  };

  const readingAction = allActions.find((a) => a.id === readingActionId) ?? null;
  const readingTarget = readingAction ? resolveTarget(readingAction.id, readingAction.targetKind) : { kind: 'NONE' as const };
  const readingDisabled = readingAction ? getSeatDisabledReason(state, content, seat, readingAction.id, readingTarget) : null;

  const queueActionInternal = (action: ActionDefinition, target: ActionTarget) => {
    const disabled = getSeatDisabledReason(state, content, seat, action.id, target);
    if (disabled.disabled) return;

    onQueueAction(
      { type: 'QueueIntent', seat, actionId: action.id, target },
      Object.keys(disabled.finalCosts) as ResourceType[],
      {
        tone: 'success',
        title: t('ui.toast.intentQueuedTitle', 'Intent queued'),
        message: t('ui.toast.intentQueuedMessage', '{{action}} added to Seat {{seat}}.', {
          action: action.name,
          seat: seat + 1,
        }),
        dismissAfterMs: 2200,
      },
    );
    setReadingActionId(null);
  };

  return (
    <div className="coalition-board" data-seat={`seat-${seat + 1}`}>
      <div className="section-heading compact">
        <span className="eyebrow">{t('ui.actionBoard.queued', 'Resolution Queue')}</span>
      </div>

      <div className="coalition-queue-list compact">
        {player.queuedIntents.length === 0 && (
          <div className="empty-queue-placeholder">
            <span>{t('ui.status.noActionsQueued', 'Wait for resolve')}</span>
          </div>
        )}
        {player.queuedIntents.map((intent) => {
          const action = content.actions[intent.actionId];
          return (
            <div key={`${intent.slot}-${intent.actionId}`} className="coalition-queue-item shell-card compact">
              <span>{action.name}</span>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => {
                  onQueueAction(
                    { type: 'RemoveQueuedIntent', seat, slot: intent.slot },
                    Object.keys(action.resourceCosts ?? {}) as ResourceType[],
                    {
                      tone: 'info',
                      title: t('ui.toast.intentRemovedTitle', 'Intent removed'),
                      message: t('ui.toast.intentRemovedMessage', 'Removed from Seat {{seat}}.', { seat: seat + 1 }),
                      dismissAfterMs: 2200,
                    },
                  );
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="section-divider" />

      <div className="section-heading compact">
        <span className="eyebrow">{t('ui.actionBoard.toolkit', 'Action Toolkit')}</span>
      </div>

      <div className="coalition-hand-container">
        {allActions.map((action) => {
          const isBreakthrough = actions.breakthroughs.some((b) => b.id === action.id);
          return (
            <article
              key={action.id}
              className={`action-card ${selectedActionId === action.id ? 'selected' : ''} ${isBreakthrough ? 'is-breakthrough' : ''}`}
              onClick={() => {
                setSelectedActionId(action.id);
                setReadingActionId(action.id);
              }}
            >
              <div className="action-card-name">{action.name}</div>
              <div className="action-card-cost">
                {Object.entries(action.resourceCosts ?? {}).map(([res, amt]) => (
                  <span key={res} className="mini-cost">
                    {res === 'solidarity' ? '🤝' : res === 'evidence' ? '🛰️' : res === 'capacity' ? '🧱' : '🩹'} {amt}
                  </span>
                ))}
              </div>
              <div className="action-card-footer">
                <span>P{action.resolvePriority}</span>
                {isBreakthrough && <span>✨</span>}
              </div>
            </article>
          );
        })}
      </div>

      {readingAction && (
        <div className="action-reading-pane" onClick={() => setReadingActionId(null)}>
          <div className="reading-card-content" onClick={(e) => e.stopPropagation()}>
            <div className="row-split">
              <h2>{readingAction.name}</h2>
              <span className="status-pill neutral">P{readingAction.resolvePriority}</span>
            </div>
            <p className="reading-description">{readingAction.description}</p>

            <div className="section-divider" />

            {readingAction.targetKind !== 'NONE' && (
              <label className="action-target">
                <span>{readingAction.targetLabel ?? t('ui.actionBoard.target', 'Select Target')}</span>
                <select
                  value={targets[readingAction.id] ?? ''}
                  onChange={(event) => setTargets({ ...targets, [readingAction.id]: event.target.value })}
                >
                  {(readingAction.targetKind === 'REGION' ? getAvailableRegions() : getAvailableFronts()).map((option) => (
                    <option key={option} value={option}>
                      {readingAction.targetKind === 'REGION'
                        ? content.regions[option as RegionId].name
                        : content.fronts[option as FrontId].name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="coalition-effect-preview">
              <span className="eyebrow">{t('ui.actionBoard.projectedEffect', 'Projected effect')}</span>
              <p>{buildEffectPreview(readingAction)}</p>
            </div>

            <div className="row-split margin-top-lg">
              <button className="secondary-button" onClick={() => setReadingActionId(null)}>
                {t('ui.game.back', 'Back')}
              </button>
              <button
                className="primary-button"
                disabled={readingDisabled?.disabled}
                onClick={() => queueActionInternal(readingAction, readingTarget)}
              >
                {readingDisabled?.disabled
                  ? readingDisabled.reason
                  : t('ui.actionBoard.queueAction', 'Queue Action')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
