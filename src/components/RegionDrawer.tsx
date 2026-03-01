// src/components/RegionDrawer.tsx
import type { Region, PlayerRole, GameState } from '../engine/types';

interface RegionDrawerProps {
    region: Region | null;
    gameState: GameState | null;
    role: PlayerRole | null;
    onClose: () => void;
    onAction: (actionId: string, targetId: string) => void;
}

export function RegionDrawer({ region, gameState, role, onClose, onAction }: RegionDrawerProps) {
    if (!region || !gameState || !role) return <div className={`drawer ${region ? 'open' : ''}`} />;

    return (
        <div className={`drawer glass-panel ${region ? 'open' : ''}`}>
            <div className="drawer-header">
                <h2>{region.id.toUpperCase()} STATUS</h2>
                <button className="btn-close" onClick={onClose}>×</button>
            </div>

            <div className="drawer-content">
                <section>
                    <h4>Vulnerabilities</h4>
                    <div className="tag-cloud" style={{ marginTop: '0.5rem' }}>
                        {Object.entries(region.vulnerability).map(([front, val]) => (
                            <span key={front} className="tag vulnerability">
                                {front}: {val}/3
                            </span>
                        ))}
                    </div>
                </section>

                <section>
                    <h4>Tokens & Dynamics</h4>
                    <div className="token-grid" style={{ marginTop: '0.5rem' }}>
                        {Object.entries(region.tokens).map(([type, count]) => (
                            <div key={type} className={`token-chip ${type}`}>
                                {type === 'displacement' ? '🧍' : type === 'disinformation' ? '🛰' : '🌍'} {count} {type.toUpperCase()}
                            </div>
                        ))}
                        {region.locks.map(lock => (
                            <div key={lock} className="token-chip lock">🔒 {lock.toUpperCase()}</div>
                        ))}
                    </div>
                </section>

                <section>
                    <h4>Local Institutions</h4>
                    <div className="clause-list" style={{ marginTop: '0.5rem' }}>
                        {region.institutions.map(inst => (
                            <div key={inst.id} className={`clause-item unlocked status-${inst.status}`}>
                                <div style={{ fontSize: '1.2rem' }}>
                                    {inst.type === 'relief' ? '🏥' : inst.type === 'media' ? '🎙' : '🏛'}
                                </div>
                                <div className="clause-info">
                                    <strong>{inst.name} ({inst.status})</strong>
                                    <p style={{ fontSize: '0.7rem' }}>{inst.bonus_description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {gameState.phase === 'COALITION' && (
                    <section>
                        <h4>Actions Targeting {region.id}</h4>
                        <div className="actions-grid" style={{ marginTop: '1rem' }}>
                            {role.unique_actions.map(action => (
                                <button
                                    key={action.id}
                                    className="btn-action-card"
                                    onClick={() => onAction(action.id, region.id)}
                                >
                                    <strong>{action.name}</strong>
                                    <span style={{ fontSize: '0.7rem' }}>{action.description}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
