import { type ReactNode, useEffect, useId, useState } from 'react';
import {
  buildEffectPreview,
  getAvailableFronts,
  getAvailableRegions,
  getPlayerStatusSummary,
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
  focused: boolean;
  onFocus: () => void;
  onQueueAction: (
    command: EngineCommand,
    resources: ResourceType[],
    toast: Omit<ToastMessage, 'id'>,
  ) => void;
}

type ActionSectionKey = 'queued' | 'standard' | 'breakthrough' | 'selected';

function targetValue(target: ActionTarget) {
  if (target.kind === 'REGION') {
    return target.regionId ?? '';
  }

  if (target.kind === 'FRONT') {
    return target.frontId ?? '';
  }

  return 'NONE';
}

function getDefaultSections() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches) {
    return {
      queued: false,
      standard: false,
      breakthrough: false,
      selected: true,
    } satisfies Record<ActionSectionKey, boolean>;
  }

  return {
    queued: true,
    standard: true,
    breakthrough: false,
    selected: true,
  } satisfies Record<ActionSectionKey, boolean>;
}

interface AccordionSectionProps {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function AccordionSection({ id, label, open, onToggle, children }: AccordionSectionProps) {
  return (
    <section className={`coalition-section ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="coalition-section-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? t('ui.actionBoard.hide', 'Hide') : t('ui.actionBoard.show', 'Show')}</span>
      </button>
      <div id={id} className="coalition-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function ActionBoard({
  seat,
  state,
  content,
  player,
  focused,
  onFocus,
  onQueueAction,
}: ActionBoardProps) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<ActionSectionKey, boolean>>(() => getDefaultSections());
  const actions = getSeatActions(state, content, seat);
  const role = content.roles[player.roleId];
  const allActions = [...actions.standard, ...actions.breakthroughs];
  const boardId = useId();

  useEffect(() => {
    if (allActions.length === 0) {
      setSelectedActionId(null);
      return;
    }

    if (!selectedActionId || !allActions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(allActions[0].id);
    }
  }, [allActions, selectedActionId]);

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

  const selectedAction = allActions.find((action) => action.id === selectedActionId) ?? allActions[0] ?? null;
  const selectedTarget = selectedAction ? resolveTarget(selectedAction.id, selectedAction.targetKind) : { kind: 'NONE' as const };
  const selectedDisabled =
    selectedAction === null
      ? null
      : getSeatDisabledReason(state, content, seat, selectedAction.id, selectedTarget);

  const queueSelectedAction = (action: ActionDefinition, target: ActionTarget) => {
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
        message: t('ui.toast.intentQueuedMessage', '{{action}} was added to Seat {{seat}}.', {
          action: action.name,
          seat: seat + 1,
        }),
        dismissAfterMs: 2200,
      },
    );
  };

  const readyHelper =
    state.phase !== 'COALITION'
      ? t('ui.actionBoard.readyUnlocksDuringCoalition', 'Ready status unlocks during the coalition phase.')
      : player.actionsRemaining !== 0
        ? t('ui.actionBoard.queueMoreBeforeReady', 'Queue {{count}} more action{{plural}} before setting ready.', {
            count: player.actionsRemaining,
            plural: player.actionsRemaining === 1 ? '' : 's',
          })
        : t('ui.actionBoard.seatReadyToCommit', 'Seat is ready to lock and commit the coalition queue.');

  return (
    <div className={`coalition-board ${focused ? 'is-focused' : ''}`} data-seat={`seat-${seat + 1}`} onClick={onFocus}>
      <div className="coalition-board-header">
        <div>
          <h3>
            Seat {seat + 1}: {role.name}
          </h3>
          <p>{getPlayerStatusSummary(player)}</p>
        </div>
        <div className="coalition-burnout-meter">
          <span>{t('ui.actionBoard.burnout', 'Burnout {{current}}/{{max}}', { current: player.burnout, max: player.maxBurnout })}</span>
          <span>{player.ready ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning')}</span>
        </div>
      </div>

      <div className="coalition-meta-row">
        <span className="resource-chip">
          {t('ui.actionBoard.queued', 'Queued {{count}}', { count: player.queuedIntents.length })}
        </span>
        <span className="resource-chip">
          {t('ui.actionBoard.slotsLeft', 'Slots left {{count}}', { count: player.actionsRemaining })}
        </span>
        <span className="resource-chip">
          {t('ui.actionBoard.status', 'Status {{status}}', {
            status: player.ready ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning'),
          })}
        </span>
      </div>

      <AccordionSection
        id={`${boardId}-queued`}
        label={t('ui.actionBoard.queued', 'Queued {{count}}', { count: player.queuedIntents.length })}
        open={openSections.queued}
        onToggle={() => setOpenSections((current) => ({ ...current, queued: !current.queued }))}
      >
        <div className="coalition-queue-list">
          {player.queuedIntents.length === 0 && <span className="muted">{t('ui.status.noActionsQueued', 'No actions queued yet.')}</span>}
          {player.queuedIntents.map((intent) => {
            const action = content.actions[intent.actionId];
            return (
              <div key={`${intent.slot}-${intent.actionId}`} className="coalition-queue-item">
                <span>
                  {intent.slot + 1}. {action.name}
                </span>
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
                        message: t('ui.toast.intentRemovedMessage', '{{action}} was removed from Seat {{seat}}.', {
                          action: action.name,
                          seat: seat + 1,
                        }),
                        dismissAfterMs: 2200,
                      },
                    );
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </AccordionSection>

      <AccordionSection
        id={`${boardId}-standard`}
        label={t('ui.actionBoard.toolkit', 'Toolkit')}
        open={openSections.standard}
        onToggle={() => setOpenSections((current) => ({ ...current, standard: !current.standard }))}
      >
        <div className="coalition-action-chooser">
          {actions.standard.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`coalition-action-toggle ${selectedAction?.id === action.id ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedActionId(action.id);
                setOpenSections((current) => ({ ...current, selected: true }));
              }}
            >
              <strong>{action.name}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection
        id={`${boardId}-breakthrough`}
        label={t('ui.actionBoard.breakthrough', 'Breakthrough')}
        open={openSections.breakthrough}
        onToggle={() => setOpenSections((current) => ({ ...current, breakthrough: !current.breakthrough }))}
      >
        <div className="coalition-action-chooser coalition-action-chooser-breakthrough">
          {actions.breakthroughs.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`coalition-action-toggle coalition-action-toggle-breakthrough ${selectedAction?.id === action.id ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedActionId(action.id);
                setOpenSections((current) => ({ ...current, selected: true }));
              }}
            >
              <strong>{action.name}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection
        id={`${boardId}-selected`}
        label={t('ui.actionBoard.selectedAction', 'Selected action')}
        open={openSections.selected}
        onToggle={() => setOpenSections((current) => ({ ...current, selected: !current.selected }))}
      >
        <div className="coalition-selected-panel">
          {selectedAction ? (
            <article className={`shell-card coalition-selected-card ${actions.breakthroughs.some((action) => action.id === selectedAction.id) ? 'is-breakthrough' : ''}`}>
              <div className="coalition-selected-header">
                <div>
                  <strong>{selectedAction.name}</strong>
                  <p>{selectedAction.description}</p>
                </div>
                <span className="priority-chip">P{selectedAction.resolvePriority}</span>
              </div>

              <div className="chip-row">
                {Object.entries(selectedDisabled?.finalCosts ?? {}).map(([resource, amount]) => (
                  <span key={resource} className="resource-chip">
                    {resource === 'solidarity' ? '🤝' : resource === 'evidence' ? '🛰️' : resource === 'capacity' ? '🧱' : '🩹'} {amount}
                  </span>
                ))}
                {selectedAction.burnoutCost !== undefined && (
                  <span className="resource-chip burnout">🧠 +{selectedAction.burnoutCost}</span>
                )}
              </div>

              {selectedAction.targetKind !== 'NONE' && (
                <label className="action-target">
                  <span>{selectedAction.targetLabel ?? t('ui.actionBoard.target', 'Target')}</span>
                  <select
                    value={targetValue(selectedTarget)}
                    onChange={(event) => setTargets({ ...targets, [selectedAction.id]: event.target.value })}
                  >
                    {(selectedAction.targetKind === 'REGION' ? getAvailableRegions() : getAvailableFronts()).map((option) => (
                      <option key={option} value={option}>
                        {selectedAction.targetKind === 'REGION'
                          ? content.regions[option as RegionId].name
                          : content.fronts[option as FrontId].name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="coalition-effect-preview">
                <span className="eyebrow">{t('ui.actionBoard.projectedEffect', 'Projected effect')}</span>
                <p>{buildEffectPreview(selectedAction)}</p>
              </div>

              <p id={`${boardId}-selected-helper`} className="helper-text">
                {selectedDisabled?.reason ?? t('ui.actionBoard.availableNow', 'Available to queue now.')}
              </p>

              <button
                className="primary-button"
                disabled={selectedDisabled?.disabled}
                aria-describedby={`${boardId}-selected-helper`}
                onClick={() => queueSelectedAction(selectedAction, selectedTarget)}
              >
                {t('ui.actionBoard.queueAction', 'Queue Action')}
              </button>
            </article>
          ) : (
            <p className="muted">{t('ui.actionBoard.noActionsForSeat', 'No actions available for this seat.')}</p>
          )}
        </div>
      </AccordionSection>

      <div className="coalition-ready-block">
        <p id={`${boardId}-ready-helper`} className="helper-text">
          {readyHelper}
        </p>
        <button
          className={`ready-button ${player.ready ? 'active' : ''}`}
          disabled={state.phase !== 'COALITION' || player.actionsRemaining !== 0}
          aria-describedby={`${boardId}-ready-helper`}
          onClick={() => {
            onQueueAction(
              { type: 'SetReady', seat, ready: !player.ready },
              [],
              {
                tone: player.ready ? 'info' : 'success',
                title: player.ready ? t('ui.toast.seatReopenedTitle', 'Seat reopened') : t('ui.toast.seatReadyTitle', 'Seat ready'),
                message: player.ready
                  ? t('ui.toast.seatReopenedMessage', 'Seat {{seat}} is planning again.', { seat: seat + 1 })
                  : t('ui.toast.seatReadyMessage', 'Seat {{seat}} locked its queue and is ready.', { seat: seat + 1 }),
                dismissAfterMs: 2000,
              },
            );
          }}
        >
          {player.ready ? t('ui.actionBoard.unsetReady', 'Unset Ready') : t('ui.actionBoard.setReady', 'Set Ready')}
        </button>
      </div>
    </div>
  );
}
