import { useReducer } from 'react';
import { gameReducer, initializeGameState } from './engine/core';
import type { Front, Region, PlayerState } from './engine/types';
import './index.css';

function MeterBar({ value, type }: { value: number; type: 'pressure' | 'protection' | 'impact' }) {
    const percentage = (value / 10) * 100;
    return (
        <div className="meter-row">
            <span className="meter-label">{type.toUpperCase()}</span>
            <div className="meter-bar-bg">
                <div
                    className={`meter-fill ${type}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span>{value}/10</span>
        </div>
    );
}

function FrontCard({ front }: { front: Front }) {
    const pressureLevel = front.pressure >= 8 ? 'high' : (front.pressure >= 5 ? 'med' : 'low');

    return (
        <div className="front-card" data-pressure={pressureLevel}>
            <div className="front-header">
                <span className="front-name">{front.name}</span>
            </div>
            <MeterBar value={front.pressure} type="pressure" />
            <MeterBar value={front.protection} type="protection" />
            <MeterBar value={front.impact} type="impact" />
        </div>
    );
}

function RegionNode({ region }: { region: Region }) {
    return (
        <div className="region-node">
            <div className="region-name">{region.id}</div>
            <div className="region-tokens">
                {Object.entries(region.tokens).map(([tokenType, count]) => {
                    if (!count || count <= 0) return null;
                    return <span key={tokenType} className="token-badge">{tokenType}: {count}</span>;
                })}
                {region.locks.map(lock => (
                    <span key={lock} className="token-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', borderColor: 'rgba(245, 158, 11, 0.5)' }}>
                        🔒 {lock}
                    </span>
                ))}
            </div>
        </div>
    );
}

function PlayerPanel({ player, onAction }: { player: PlayerState; onAction: (id: string) => void }) {
    return (
        <div className="player-card">
            <div className="player-name">Player ({player.roleId})</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Burnout: {player.burnout} | Actions Left: {player.actionsRemaining}
            </div>
            <div className="player-actions">
                {/* Mock actions for the UI button based on role */}
                {player.roleId === "organizer" && (
                    <button
                        className="btn-action"
                        disabled={player.actionsRemaining <= 0}
                        onClick={() => onAction("mutual_aid_network")}
                    >
                        Mutual Aid Network
                    </button>
                )}
                {player.roleId === "investigative_journalist" && (
                    <button
                        className="btn-action"
                        disabled={player.actionsRemaining <= 0}
                        onClick={() => onAction("expose_corruption")}
                    >
                        Expose Corruption
                    </button>
                )}
            </div>
        </div>
    );
}

export default function App() {
    const [state, dispatch] = useReducer(gameReducer, null as any, initializeGameState);
    const syncStatus = "Local Offline Mode";

    const handlePlayerAction = (playerId: number, actionId: string) => {
        dispatch({ type: 'PLAYER_ACTION', playerId, actionId });
        // In a full implementation, we'd also POST to the backend here.
    };

    const advancePhase = () => {
        if (state.phase === "WORLD") {
            dispatch({ type: 'RESOLVE_WORLD_PHASE' });
        } else if (state.phase === "COALITION") {
            dispatch({ type: 'END_TURN' });
        }
    };

    return (
        <div className="layout-grid">

            {/* HEADER */}
            <div className="header glass-panel">
                <div>
                    <h1>The Stones Are Crying Out</h1>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', gap: '1rem' }}>
                        <span>Phase: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{state.phase}</span></span>
                        <span>Round: {state.currentRound}</span>
                        <span>{syncStatus}</span>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-item">
                        <span className="label">Temperature</span>
                        <span className={`value ${state.temperature >= 7 ? 'critical' : (state.temperature >= 4 ? 'warning' : '')}`}>
                            +{state.temperature}°C
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Civic Space</span>
                        <span className="value" style={{ color: '#8b5cf6' }}>{state.civic_space}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Solidarity</span>
                        <span className="value">{state.resources.solidarity}</span>
                    </div>
                </div>
            </div>

            {/* LEFT: FRONTS */}
            <div className="systems-dashboard glass-panel">
                <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Fronts</h3>
                {Object.values(state.fronts).map(front => (
                    <FrontCard key={front.id} front={front} />
                ))}
            </div>

            {/* CENTER: MAP */}
            <div className="world-map">
                {Object.values(state.regions).map(region => (
                    <RegionNode key={region.id} region={region} />
                ))}

                <div className="phase-ctl">
                    {state.phase === "WORLD" && (
                        <button className="btn-phase" onClick={advancePhase}>
                            Resolve World Phase
                        </button>
                    )}
                    {state.phase === "COALITION" && (
                        <button className="btn-phase" onClick={advancePhase}>
                            End Player Coalition Phase
                        </button>
                    )}
                </div>
            </div>

            {/* RIGHT: PLAYERS & LOG */}
            <div className="right-sidebar glass-panel">
                <div className="player-panel">
                    <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coalition</h3>
                    {state.players.map((p, i) => (
                        <PlayerPanel key={i} player={p} onAction={(actId) => handlePlayerAction(i, actId)} />
                    ))}
                </div>

                <div className="log-panel">
                    <div className="log-header">ACTION LOG</div>
                    <div className="log-messages">
                        {state.logs.slice().reverse().map((log, idx) => (
                            <div key={idx} className="log-entry">
                                <span className="log-emoji">{log.emoji}</span>
                                <div style={{ flex: 1 }}>
                                    <div className="log-text">{log.message}</div>
                                    <div className="log-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
