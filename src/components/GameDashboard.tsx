import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PlayerRole, GameState, Region, Front, PlayerState } from '../engine/types';
import { formatNumber, t } from '../i18n/index.ts';

// Components
import { RegionDrawer } from './RegionDrawer';
import { PhaseTimeline } from './PhaseTimeline';
import { EffectTraceDrawer } from './EffectTraceDrawer';
import { ActionList } from './ActionList';
import { CharterPanel } from './CharterPanel';
import { ScenarioBrief } from './ScenarioBrief';
import { DealModal } from './DealModal';

function MeterBar({ value, type }: { value: number; type: 'pressure' | 'protection' | 'impact' }) {
    const percentage = (value / 10) * 100;
    return (
        <div className="meter-row">
            <span className="meter-label">{t(`ui.legacyDashboard.meter.${type}`, type.toUpperCase())}</span>
            <div className="meter-bar-bg">
                <div
                    className={`meter-fill ${type}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export function GameDashboard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [state, setState] = useState<GameState | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);

    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [selectedLogIdx, setSelectedLogIdx] = useState<number | null>(null);
    const [isDealOpen, setIsDealOpen] = useState(false);
    const [activeOverlay, setActiveOverlay] = useState<string>('displacement');
    const mockRoles: PlayerRole[] = [
        {
            id: 'organizer',
            name: t('ui.legacyDashboard.roles.organizer.name', 'Community Organizer'),
            base_actions_per_turn: 2,
            burnout_max: 10,
            burnout_strained_threshold: 7,
            passive: t('ui.legacyDashboard.roles.organizer.passive', 'Mutual Aid: -1 Solidarity cost for local actions.'),
            unique_actions: [
                {
                    id: 'mutual_aid_network',
                    name: t('ui.legacyDashboard.roles.organizer.action1Name', 'Mutual Aid Network'),
                    description: t('ui.legacyDashboard.roles.organizer.action1Desc', 'Reduce poverty pressure.'),
                    resource_costs: { solidarity: 1 },
                    burnout_cost: 1,
                    effects: [],
                },
                {
                    id: 'protest_march',
                    name: t('ui.legacyDashboard.roles.organizer.action2Name', 'Protest March'),
                    description: t('ui.legacyDashboard.roles.organizer.action2Desc', 'Counter disinformation.'),
                    resource_costs: { evidence: 1 },
                    burnout_cost: 1,
                    effects: [],
                },
            ],
            breakthrough_action: {
                id: 'general_strike',
                name: t('ui.legacyDashboard.roles.organizer.breakthroughName', 'General Strike'),
                description: t('ui.legacyDashboard.roles.organizer.breakthroughDesc', 'Massive pressure reduction.'),
                effects: [],
            },
        },
        {
            id: 'investigative_journalist',
            name: t('ui.legacyDashboard.roles.journalist.name', 'Investigative Journalist'),
            base_actions_per_turn: 2,
            burnout_max: 8,
            burnout_strained_threshold: 5,
            passive: t('ui.legacyDashboard.roles.journalist.passive', 'Truth Seeker: +1 Evidence when exposing corruption.'),
            unique_actions: [
                {
                    id: 'expose_corruption',
                    name: t('ui.legacyDashboard.roles.journalist.action1Name', 'Expose Corruption'),
                    description: t('ui.legacyDashboard.roles.journalist.action1Desc', 'Increase rights protection.'),
                    resource_costs: { solidarity: 1 },
                    burnout_cost: 1,
                    effects: [],
                },
                {
                    id: 'deep_investigation',
                    name: t('ui.legacyDashboard.roles.journalist.action2Name', 'Deep Investigation'),
                    description: t('ui.legacyDashboard.roles.journalist.action2Desc', 'Gain massive Evidence.'),
                    resource_costs: { capacity: 1 },
                    burnout_cost: 1,
                    effects: [],
                },
            ],
            breakthrough_action: {
                id: 'global_expose',
                name: t('ui.legacyDashboard.roles.journalist.breakthroughName', 'Global Expose'),
                description: t('ui.legacyDashboard.roles.journalist.breakthroughDesc', 'Massive impact on speech.'),
                effects: [],
            },
        },
    ];

    useEffect(() => {
        if (!state && id && !roomId) {
            // Start game on backend
            fetch(`http://localhost:8000/rooms?scenario_id=${id}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    setRoomId(data.room_id);
                    setState(data.state);
                })
                .catch(err => {
                    console.error("Failed to connect to backend", err);
                    // Fallback to mock initialization if backend is down since it's an MVP scaffold
                    import('../engine/core').then(mod => {
                        setState(mod.initializeGameState(id));
                    });
                });
        }
    }, [id, state, roomId]);

    if (!state) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>{t('ui.legacyDashboard.loadingScenario', 'Loading scenario...')}</div>;
    }

    const isCoalitionReady = state.players.every((p: PlayerState) => p.isReady);

    const advancePhase = async () => {
        if (!roomId) {
            import('../engine/core').then(() => {
                let nextPhase = state.phase;
                if (state.phase === "WORLD") nextPhase = "COALITION";
                else if (state.phase === "COALITION") nextPhase = "END";
                else nextPhase = "WORLD";
                setState({ ...state, phase: nextPhase });
            });
            return;
        }

        const res = await fetch(`http://localhost:8000/rooms/${roomId}/phase`, { method: 'POST' });
        const data = await res.json();
        if (data.state) setState(data.state);
    };

    const handleCommitIntent = async (playerId: number, actionId: string, targetId?: string) => {
        if (!roomId) return;
        const payload = { playerId, actionId, targetId };
        const res = await fetch(`http://localhost:8000/rooms/${roomId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.state) setState(data.state);
    };

    const handleSetReady = async (playerId: number, ready: boolean) => {
        // Optimistic UI for ready states (backend doesn't explicitly toggle ready status uniquely yet)
        const newState = { ...state };
        newState.players[playerId].isReady = ready;
        setState(newState);
    };

    const getTemperatureBand = (temp: number) => {
        if (temp < 4) return { band: 1, max: 4, desc: t('ui.legacyDashboard.temperatureBand1', 'Draw 1 crisis, cascade chance 0%') };
        if (temp < 7) return { band: 2, max: 4, desc: t('ui.legacyDashboard.temperatureBand2', 'Draw 1 crisis, cascade chance 10%') };
        if (temp < 10) return { band: 3, max: 4, desc: t('ui.legacyDashboard.temperatureBand3', 'Draw 2 crisis, cascade chance 25%') };
        return { band: 4, max: 4, desc: t('ui.legacyDashboard.temperatureBand4', 'CRITICAL CASCADE') };
    };

    const tempInfo = getTemperatureBand(state.temperature);

    const resetToHome = () => {
        navigate('/');
    };

    return (
        <div className="layout-grid">
            {/* HEADER */}
            <div className="header glass-panel">
                <div onClick={resetToHome} style={{ cursor: 'pointer' }}>
                    <h1>The Stones Are Crying Out</h1>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {t('ui.legacyDashboard.headerMeta', 'ROUND: {{round}} | COALITION OF SEVEN | LOCAL | CLICK TO HOME', {
                            round: `0${state.currentRound}`,
                        })}
                    </div>
                </div>

                <PhaseTimeline phase={state.phase} />

                <div className="header-stats">
                    <div className="stat-item tooltip-host">
                        <span className="label">{t('ui.legacyDashboard.temperature', 'Temperature')}</span>
                        <span className={`value ${state.temperature >= 7 ? 'critical' : (state.temperature >= 4 ? 'warning' : '')}`}>
                            🌡️ +{formatNumber(state.temperature)}°C ({formatNumber(tempInfo.band)}/{formatNumber(tempInfo.max)})
                        </span>
                        <div className="tooltip">{tempInfo.desc}</div>
                    </div>
                    <div className="stat-item">
                        <span className="label">{t('ui.legacyDashboard.civicSpace', 'Civic Space')}</span>
                        <span className="value" style={{ color: '#c084fc' }}>⚖️ {state.civic_space}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">{t('ui.legacyDashboard.solidarity', 'Solidarity')}</span>
                        <span className="value" style={{ color: 'var(--accent-green)' }}>🤝 {state.resources.solidarity}</span>
                    </div>
                </div>
            </div>

            {/* LEFT: FRONTS & CHARTER */}
            <div className="systems-dashboard glass-panel">
                <ScenarioBrief
                    title={state.scenarioId === 'green_resistance'
                        ? t('ui.legacyDashboard.greenResistance', 'Green Resistance')
                        : t('ui.legacyDashboard.witnessDignity', 'Witness & Dignity')}
                    description={state.scenarioId === 'green_resistance' ?
                        t('ui.legacyDashboard.greenResistanceDesc', 'Protect the lungs of the earth from illegal extraction.') :
                        t('ui.legacyDashboard.witnessDignityDesc', 'The occupation intensifies in MENA. Global solidarity is our only shield.')}
                    rules={state.scenarioId === 'green_resistance' ?
                        [
                            t('ui.legacyDashboard.greenRule1', 'Guardian Bond: +1 Protection in Amazon'),
                            t('ui.legacyDashboard.greenRule2', 'Extraction Ban: Strict'),
                        ] :
                        [
                            t('ui.legacyDashboard.witnessRule1', 'Witness Window: +1 Evidence in MENA'),
                            t('ui.legacyDashboard.witnessRule2', 'Aid Corridor: Locked'),
                        ]}
                />

                <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {t('ui.legacyDashboard.systemicFronts', 'Systemic Fronts')}
                </h3>
                {(Object.values(state.fronts) as Front[]).map(front => (
                    <div key={front.id} className="front-card" style={{ borderLeftColor: front.pressure >= 7 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>{front.name}</div>
                        <MeterBar value={front.pressure} type="pressure" />
                        <MeterBar value={front.protection} type="protection" />
                        <MeterBar value={front.impact} type="impact" />
                    </div>
                ))}

                <CharterPanel clauses={state.charter} />
            </div>

            {/* CENTER: MAP */}
            <div className="world-map">
                <div className="overlay-toggles">
                    {['displacement', 'disinfo', 'locks', 'institutions'].map(ov => (
                        <button
                            key={ov}
                            className={`btn-overlay ${activeOverlay === ov ? 'active' : ''}`}
                            onClick={() => setActiveOverlay(ov)}
                        >
                            {t(`ui.legacyDashboard.overlays.${ov}`, ov)}
                        </button>
                    ))}
                </div>

                {(Object.values(state.regions) as Region[]).map(region => (
                    <div
                        key={region.id}
                        className="region-node"
                        onClick={() => setSelectedRegionId(region.id)}
                    >
                        <div className="region-name">{region.id}</div>
                        <div className="token-grid">
                            <div className={`token-chip displacement ${activeOverlay === 'displacement' ? 'highlight' : ''}`}>
                                🧍 {region.tokens.displacement || 0}
                            </div>
                            <div className={`token-chip disinfo ${activeOverlay === 'disinfo' ? 'highlight' : ''}`}>
                                🛰 {region.tokens.disinformation || 0}
                            </div>
                            <div className={`token-chip lock ${activeOverlay === 'locks' ? 'highlight' : ''}`}>
                                🔒 {region.locks.length || 0}
                            </div>
                            <div className={`token-chip institution ${activeOverlay === 'institutions' ? 'highlight' : ''}`}>
                                🏛 {region.institutions.length || 0}
                            </div>
                        </div>
                    </div>
                ))}

                <div className="phase-ctl" style={{ top: 'auto', bottom: '2rem', position: 'absolute' }}>
                    {state.phase === 'WORLD' ? (
                        <button className="btn-phase" onClick={advancePhase}>
                            🌍 {t('ui.legacyDashboard.resolveWorldPhase', 'Resolve World Phase')}
                        </button>
                    ) : state.phase === 'COALITION' ? (
                        <button
                            className="btn-phase"
                            onClick={advancePhase}
                            disabled={!isCoalitionReady}
                        >
                            🤝 {isCoalitionReady
                                ? t('ui.legacyDashboard.commitCoalitionIntents', 'Commit Coalition Intents')
                                : t('ui.legacyDashboard.playersSelecting', 'Players Selecting...')}
                        </button>
                    ) : (
                        <button className="btn-phase" onClick={advancePhase}>
                            🧩 {t('ui.legacyDashboard.endRoundPhase', 'End Round Phase')}
                        </button>
                    )}
                </div>
            </div>

            {/* RIGHT: PLAYERS & LOG */}
            <div className="right-sidebar glass-panel">
                <div className="player-panel">
                    <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {t('ui.legacyDashboard.coalitionStrategicIntent', 'Coalition Strategic Intent')}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {state.players.map((p, i) => (
                            <div key={i} className={`player-intent-block ${p.isReady ? 'ready' : ''}`}>
                                <ActionList
                                    player={p}
                                    role={mockRoles[i % mockRoles.length]}
                                    gameState={state}
                                    onCommit={(actId) => handleCommitIntent(i, actId)}
                                    onReady={(ready) => handleSetReady(i, ready)}
                                />
                                {state.pendingIntents.filter(pi => String(pi.playerId) === String(i) || String(pi.playerId) === p.roleId).length > 0 && (
                                    <div className="intent-preview" style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--accent-blue)' }}>
                                        {state.pendingIntents.filter((pi: any) => String(pi.playerId) === String(i) || String(pi.playerId) === p.roleId).map((pi: any) => pi.actionId).join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="log-panel" style={{ marginTop: '2rem' }}>
                    <div className="log-header">{t('ui.legacyDashboard.systemTraceLog', 'SYSTEM TRACE LOG')}</div>
                    <div className="log-messages">
                        {state.logs.slice().reverse().map((log: any, idx: number) => (
                            <div
                                key={idx}
                                className="log-entry"
                                onClick={() => log.traces && setSelectedLogIdx(state.logs.length - 1 - idx)}
                                style={{ borderLeft: log.traces ? '2px solid var(--accent-blue)' : 'none' }}
                            >
                                <span className="log-emoji">{log.emoji}</span>
                                <div style={{ flex: 1 }}>
                                    <div className="log-text">{log.message}</div>
                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                                        {/* Mock delta chips if info was in log */}
                                        {log.message.includes('temperature') && <span className="tag token" style={{ fontSize: '0.6rem' }}>🌡️ +{formatNumber(1)}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <RegionDrawer
                region={selectedRegionId ? state.regions[selectedRegionId] : null}
                gameState={state}
                role={mockRoles[0]} // Mock for first player interaction
                onClose={() => setSelectedRegionId(null)}
                onAction={(actId, targetId) => handleCommitIntent(0, actId, targetId)}
            />

            <EffectTraceDrawer
                logEntry={selectedLogIdx !== null ? state.logs[selectedLogIdx] : null}
                onClose={() => setSelectedLogIdx(null)}
            />

            <DealModal
                isOpen={isDealOpen}
                onClose={() => setIsDealOpen(false)}
                onResolve={(choice) => {
                    console.log("Deal resolved:", choice);
                    setIsDealOpen(false);
                }}
            />
        </div>
    );
}
