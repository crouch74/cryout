import { useEffect, useState } from 'react';
import {
  buildEffectPreview,
  getAvailableFronts,
  getAvailableRegions,
  getPlayerStatusSummary,
  getSeatActions,
  getSeatDisabledReason,
  type ActionTarget,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type FrontId,
  type PlayerState,
  type RegionId,
} from '../../engine/index.ts';

interface ActionBoardProps {
  seat: number;
  state: EngineState;
  content: CompiledContent;
  player: PlayerState;
  focused: boolean;
  onFocus: () => void;
  onCommand: (command: EngineCommand) => void;
}

function targetValue(target: ActionTarget) {
  if (target.kind === 'REGION') {
    return target.regionId ?? '';
  }

  if (target.kind === 'FRONT') {
    return target.frontId ?? '';
  }

  return 'NONE';
}

export function ActionBoard({ seat, state, content, player, focused, onFocus, onCommand }: ActionBoardProps) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const actions = getSeatActions(state, content, seat);
  const role = content.roles[player.roleId];
  const allActions = [...actions.standard, ...actions.breakthroughs];

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

  const renderActionDetails = (actionId: string, breakthrough = false) => {
    const action = content.actions[actionId];
    const target = resolveTarget(action.id, action.targetKind);
    const disabled = getSeatDisabledReason(state, content, seat, action.id, target);

    return (
      <div key={action.id} className={`action-card selected-action ${breakthrough ? 'breakthrough' : ''}`}>
        <div className="action-card-header">
          <div>
            <strong>{action.name}</strong>
            <p>{action.description}</p>
          </div>
          <span className="priority-chip">P{action.resolvePriority}</span>
        </div>

        <div className="chip-row">
          {Object.entries(disabled.finalCosts).map(([resource, amount]) => (
            <span key={resource} className="resource-chip">
              {resource === 'solidarity' ? '🤝' : resource === 'evidence' ? '🛰️' : resource === 'capacity' ? '🧱' : '🩹'} {amount}
            </span>
          ))}
          {action.burnoutCost !== undefined && <span className="resource-chip burnout">🧠 +{action.burnoutCost}</span>}
        </div>

        {action.targetKind !== 'NONE' && (
          <label className="action-target">
            <span>{action.targetLabel ?? 'Target'}</span>
            <select
              value={targetValue(target)}
              onChange={(event) => setTargets({ ...targets, [action.id]: event.target.value })}
            >
              {(action.targetKind === 'REGION' ? getAvailableRegions() : getAvailableFronts()).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="effect-preview">{buildEffectPreview(action)}</div>

        <button
          className="queue-button"
          disabled={disabled.disabled}
          title={disabled.reason}
          onClick={() => onCommand({ type: 'QueueIntent', seat, actionId: action.id, target })}
        >
          Queue Action
        </button>
      </div>
    );
  };

  const selectedAction = allActions.find((action) => action.id === selectedActionId) ?? allActions[0] ?? null;

  return (
    <div className={`action-board ${focused ? 'focused' : ''}`} onClick={onFocus}>
      <div className="action-board-header">
        <div>
          <h3>
            Seat {seat + 1}: {role.name}
          </h3>
          <p>{getPlayerStatusSummary(player)}</p>
        </div>
        <div className="burnout-meter">
          <span>Burnout {player.burnout}/{player.maxBurnout}</span>
          <span>{player.ready ? 'Ready' : 'Planning'}</span>
        </div>
      </div>

      <div className="action-board-stats">
        <span className="resource-chip">Queued {player.queuedIntents.length}</span>
        <span className="resource-chip">Slots left {player.actionsRemaining}</span>
        <span className="resource-chip">Status {player.ready ? 'Ready' : 'Planning'}</span>
      </div>

      <div className="queued-list compact">
        {player.queuedIntents.length === 0 && <span className="muted">No actions queued yet.</span>}
        {player.queuedIntents.map((intent) => {
          const action = content.actions[intent.actionId];
          return (
            <div key={`${intent.slot}-${intent.actionId}`} className="queued-item">
              <span>
                {intent.slot + 1}. {action.name}
              </span>
              <button onClick={() => onCommand({ type: 'RemoveQueuedIntent', seat, slot: intent.slot })}>Remove</button>
            </div>
          );
        })}
      </div>

      <div className="action-selector">
        <div className="action-selector-group">
          <span className="selector-label">Toolkit</span>
          <div className="action-toggle-row">
            {actions.standard.map((action) => (
              <button
                key={action.id}
                className={`action-toggle ${selectedAction?.id === action.id ? 'active' : ''}`}
                onClick={() => setSelectedActionId(action.id)}
              >
                {action.name}
              </button>
            ))}
          </div>
        </div>

        <div className="action-selector-group">
          <span className="selector-label">Breakthrough</span>
          <div className="action-toggle-row">
            {actions.breakthroughs.map((action) => (
              <button
                key={action.id}
                className={`action-toggle breakthrough ${selectedAction?.id === action.id ? 'active' : ''}`}
                onClick={() => setSelectedActionId(action.id)}
              >
                {action.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="selected-action-panel">
        {selectedAction ? renderActionDetails(selectedAction.id, actions.breakthroughs.some((action) => action.id === selectedAction.id)) : null}
      </div>

      <button
        className={`ready-button ${player.ready ? 'active' : ''}`}
        disabled={state.phase !== 'COALITION' || player.actionsRemaining !== 0}
        onClick={() => onCommand({ type: 'SetReady', seat, ready: !player.ready })}
      >
        {player.ready ? 'Unset Ready' : 'Set Ready'}
      </button>
    </div>
  );
}
