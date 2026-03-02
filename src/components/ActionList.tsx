// src/components/ActionList.tsx
import type { PlayerState, PlayerRole, ActionDef, GameState } from '../engine/types';
import { t } from '../i18n/index.ts';

interface ActionListProps {
    player: PlayerState;
    role: PlayerRole;
    gameState: GameState;
    onCommit: (actionId: string) => void;
    onReady: (ready: boolean) => void;
}

export function ActionList({ player, role, gameState, onCommit, onReady }: ActionListProps) {
    const isOutOfActions = player.actionsRemaining <= 0;
    const isWorldPhase = gameState.phase === 'WORLD';

    return (
        <div className="player-action-list">
            <div className="player-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className={`role-badge ${role.id}`} style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-blue)' }}>{role.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {t('ui.legacyDashboard.readyLabel', 'Ready')}: {player.isReady ? '✅' : '⚪'}
                </span>
            </div>

            <div className="actions-grid">
                {role.unique_actions.map(action => {
                    const enoughRes = checkCosts(action, gameState);
                    const isCommittable = !isOutOfActions && !isWorldPhase && enoughRes;

                    return (
                        <button
                            key={action.id}
                            className={`btn-action-card ${!isCommittable ? 'disabled' : ''}`}
                            disabled={!isCommittable}
                            onClick={() => onCommit(action.id)}
                        >
                            <div className="action-header">
                                <div className="action-name">{action.name}</div>
                                {action.burnout_cost && <span className="res-chip burnout-chip">🧠 +{action.burnout_cost}</span>}
                            </div>

                            <div className="cost-row">
                                {Object.entries(action.resource_costs || {}).map(([res, val]) => (
                                    <span key={res} className="res-chip">
                                        {res === 'solidarity' ? '🤝' : res === 'evidence' ? '🛰' : '🧱'} {val}
                                    </span>
                                ))}
                            </div>

                            <div className="effect-preview">
                                {action.description}
                            </div>
                        </button>
                    );
                })}
            </div>

            <button
                className={`btn-ready ${player.isReady ? 'ready' : ''} ${isWorldPhase ? 'disabled' : ''}`}
                disabled={isWorldPhase}
                onClick={() => onReady(!player.isReady)}
                style={{ marginTop: '1rem' }}
            >
                {player.isReady
                    ? t('ui.legacyDashboard.readyForResolve', 'READY FOR RESOLVE')
                    : t('ui.legacyDashboard.setReady', 'SET READY')}
            </button>
        </div>
    );
}

function checkCosts(action: ActionDef, state: GameState): boolean {
    if (!action.resource_costs) return true;
    for (const [res, val] of Object.entries(action.resource_costs)) {
        if ((state.resources as any)[res] < val) return false;
    }
    return true;
}
