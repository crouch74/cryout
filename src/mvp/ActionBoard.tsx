import { useState } from 'react';
import {
  getAvailableDomains,
  getAvailableRegions,
  getSeatActions,
  getSeatDisabledReason,
  type ActionDefinition,
  type ActionTarget,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type DomainId,
  type PlayerState,
  type RegionId,
  type ResourceType,
} from '../../engine/index.ts';
import type { ToastMessage } from './ToastStack.tsx';
import {
  formatEffectPreview,
  getFrontLabel,
  getRegionLabel,
  localizeActionField,
  t,
} from '../i18n/index.ts';
import { ActionCard, PaperSheet, WaxSealLock } from './tabletop.tsx';

interface ActionBoardProps {
  seat: number;
  state: EngineState;
  content: CompiledContent;
  player: PlayerState;
  onCommand: (command: EngineCommand) => void;
  onQueueAction: (
    command: EngineCommand,
    resources: ResourceType[],
    toast: Omit<ToastMessage, 'id'>,
  ) => void;
}

function renderTargetLabel(content: CompiledContent, target: ActionTarget) {
  if (target.kind === 'REGION' && target.regionId) {
    return getRegionLabel(target.regionId);
  }

  if (target.kind === 'FRONT' && target.frontId) {
    return getFrontLabel(target.frontId);
  }

  return t('ui.actionBoard.tableWide', 'Table-wide');
}

export function ActionBoard({
  seat,
  state,
  content,
  player,
  onCommand,
  onQueueAction,
}: ActionBoardProps) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [readingActionId, setReadingActionId] = useState<string | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
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
        frontId: (targets[actionId] as DomainId | undefined) ?? getAvailableDomains()[0],
      } as ActionTarget;
    }
    return { kind: 'NONE' };
  };

  const readingAction = allActions.find((action) => action.id === readingActionId) ?? null;
  const readingTarget = readingAction ? resolveTarget(readingAction.id, readingAction.targetKind) : { kind: 'NONE' as const };
  const readingDisabled = readingAction ? getSeatDisabledReason(state, content, seat, readingAction.id, readingTarget) : null;

  const queueActionInternal = (action: ActionDefinition, target: ActionTarget) => {
    const disabled = getSeatDisabledReason(state, content, seat, action.id, target);
    if (disabled.disabled) {
      return;
    }

    onQueueAction(
      { type: 'QueueIntent', seat, actionId: action.id, target },
      Object.keys(disabled.finalCosts) as ResourceType[],
      {
        tone: 'success',
        title: t('ui.toast.intentQueuedTitle', 'Intent queued'),
        message: t('ui.toast.intentQueuedMessage', '{{action}} added to Seat {{seat}}.', {
          action: localizeActionField(action.id, 'name', action.name),
          seat: seat + 1,
        }),
        dismissAfterMs: 2200,
      },
    );
    setReadingActionId(null);
  };

  return (
    <div className="planned-moves-board" data-seat={`seat-${seat + 1}`}>
      <PaperSheet tone="plain" className="planned-moves-sheet">
        <div className="planned-moves-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.plannedMoves', 'Planned Moves')}</span>
            <h3>{t('ui.actionBoard.plannedMovesTitle', 'Arrange the action cards')}</h3>
          </div>
          <span className="engraved-eyebrow">
            {t('ui.actionBoard.slotsLeft', 'Slots left {{count}}', { count: player.actionsRemaining })}
          </span>
        </div>

        <div className="planned-moves-row" role="list" aria-label={t('ui.game.coalitionDeskSections', 'Coalition desk sections')}>
          {player.queuedIntents.length === 0 ? (
            <div className="planned-moves-empty">{t('ui.status.noActionsQueued', 'No actions queued yet.')}</div>
          ) : null}

          {player.queuedIntents.map((intent) => {
            const action = content.actions[intent.actionId];
            return (
              <article
                key={`${intent.slot}-${intent.actionId}`}
                className="planned-move-card"
                role="listitem"
                draggable
                onDragStart={() => setDragSlot(intent.slot)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragSlot === null || dragSlot === intent.slot) {
                    return;
                  }
                  onCommand({ type: 'ReorderQueuedIntent', seat, fromSlot: dragSlot, toSlot: intent.slot });
                  setDragSlot(null);
                }}
              >
                <div className="planned-move-card-copy">
                  <span className="engraved-eyebrow">
                    {t('ui.actionBoard.priority', 'Priority {{priority}}', { priority: action.resolvePriority })}
                  </span>
                  <strong>{localizeActionField(action.id, 'name', action.name)}</strong>
                  <span>{renderTargetLabel(content, intent.target)}</span>
                </div>
                <div className="planned-move-card-actions">
                  <button
                    type="button"
                    className="mini-plate"
                    disabled={intent.slot === 0}
                    onClick={() => onCommand({ type: 'ReorderQueuedIntent', seat, fromSlot: intent.slot, toSlot: intent.slot - 1 })}
                  >
                    {t('ui.actionBoard.moveLeft', 'Move Left')}
                  </button>
                  <button
                    type="button"
                    className="mini-plate"
                    disabled={intent.slot === player.queuedIntents.length - 1}
                    onClick={() => onCommand({ type: 'ReorderQueuedIntent', seat, fromSlot: intent.slot, toSlot: intent.slot + 1 })}
                  >
                    {t('ui.actionBoard.moveRight', 'Move Right')}
                  </button>
                  <button
                    type="button"
                    className="mini-plate mini-plate-danger"
                    onClick={() =>
                      onQueueAction(
                        { type: 'RemoveQueuedIntent', seat, slot: intent.slot },
                        Object.keys(action.resourceCosts ?? {}) as ResourceType[],
                        {
                          tone: 'info',
                          title: t('ui.toast.intentRemovedTitle', 'Intent removed'),
                          message: t('ui.toast.intentRemovedMessage', 'Removed from Seat {{seat}}.', { seat: seat + 1 }),
                          dismissAfterMs: 2200,
                        },
                      )
                    }
                  >
                    {t('ui.actionBoard.pullTab', 'Pull Tab')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </PaperSheet>

      <PaperSheet tone="plain" className="action-library-sheet">
        <div className="planned-moves-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.actionBoard.toolkit', 'Action Toolkit')}</span>
            <h3>{t('ui.actionBoard.libraryTitle', 'Action cards in hand')}</h3>
          </div>
        </div>

        <div className="action-library-grid">
          {allActions.map((action) => {
            const isBreakthrough = actions.breakthroughs.some((breakthrough) => breakthrough.id === action.id);
            return (
              <ActionCard key={action.id} onClick={() => setReadingActionId(action.id)}>
                <span className="engraved-eyebrow">
                  {t('ui.actionBoard.priorityCode', 'P{{priority}}', { priority: action.resolvePriority })}
                  {isBreakthrough ? ` · ${t('ui.actionBoard.breakthrough', 'Breakthrough')}` : ''}
                </span>
                <strong>{localizeActionField(action.id, 'name', action.name)}</strong>
                <span>{formatEffectPreview(action, content)}</span>
              </ActionCard>
            );
          })}
        </div>
      </PaperSheet>

      {readingAction ? (
        <PaperSheet tone="note" className="action-reading-sheet">
          <div className="planned-moves-header">
            <div>
              <span className="engraved-eyebrow">{t('ui.actionBoard.selectedAction', 'Selected Action')}</span>
              <h3>{localizeActionField(readingAction.id, 'name', readingAction.name)}</h3>
            </div>
            <button type="button" className="mini-plate" onClick={() => setReadingActionId(null)}>
              {t('ui.game.back', 'Back')}
            </button>
          </div>

          <p>{localizeActionField(readingAction.id, 'description', readingAction.description)}</p>

          {readingAction.targetKind !== 'NONE' ? (
            <label className="action-target-picker">
              <span>{readingAction.targetLabel ?? t('ui.actionBoard.target', 'Target')}</span>
              <select
                value={targets[readingAction.id] ?? ''}
                onChange={(event) => setTargets({ ...targets, [readingAction.id]: event.target.value })}
              >
                {(readingAction.targetKind === 'REGION' ? getAvailableRegions(content) : getAvailableDomains(content)).map((option) => (
                  <option key={option} value={option}>
                    {readingAction.targetKind === 'REGION'
                      ? getRegionLabel(option as RegionId)
                      : getFrontLabel(option as DomainId)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="projected-effect-sheet">
            <span className="engraved-eyebrow">{t('ui.actionBoard.projectedEffect', 'Projected effect')}</span>
            <p>{formatEffectPreview(readingAction, content)}</p>
          </div>

          <div className="action-reading-footer">
            <button type="button" className="mini-plate" onClick={() => setReadingActionId(null)}>
              {t('ui.actionBoard.hide', 'Hide')}
            </button>
            <ActionCard
              onClick={() => queueActionInternal(readingAction, readingTarget)}
              disabled={readingDisabled?.disabled}
            >
              <span className="engraved-eyebrow">{t('ui.actionBoard.queueAction', 'Queue Action')}</span>
              <strong>{readingDisabled?.disabled ? readingDisabled.reason : t('ui.actionBoard.queueAction', 'Queue Action')}</strong>
              {readingDisabled?.disabled ? <WaxSealLock label={t('ui.game.sealed', 'Sealed')} /> : null}
            </ActionCard>
          </div>
        </PaperSheet>
      ) : null}
    </div>
  );
}
