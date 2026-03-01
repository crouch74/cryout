import { useReducer, useState } from 'react';
import { gameReducer } from './engine/core';
import type { PlayerRole, ScenarioMetadata } from './engine/types';
import './index.css';

// Components
import { RegionDrawer } from './components/RegionDrawer';
import { PhaseTimeline } from './components/PhaseTimeline';
import { EffectTraceDrawer } from './components/EffectTraceDrawer';
import { ActionList } from './components/ActionList';
import { CharterPanel } from './components/CharterPanel';
import { ScenarioBrief } from './components/ScenarioBrief';
import { DealModal } from './components/DealModal';
import { LandingPage } from './components/LandingPage';
import { ScenarioSelect } from './components/ScenarioSelect';

// Mock Roles for MVP
const MOCK_ROLES: PlayerRole[] = [
    {
        id: 'organizer',
        name: 'Community Organizer',
        base_actions_per_turn: 2,
        burnout_max: 10,
        burnout_strained_threshold: 7,
        passive: 'Mutual Aid: -1 Solidarity cost for local actions.',
        unique_actions: [
            { id: 'mutual_aid_network', name: 'Mutual Aid Network', description: 'Reduce poverty pressure.', resource_costs: { solidarity: 1 }, burnout_cost: 1, effects: [] },
            { id: 'protest_march', name: 'Protest March', description: 'Counter disinformation.', resource_costs: { evidence: 1 }, burnout_cost: 1, effects: [] }
        ],
        breakthrough_action: { id: 'general_strike', name: 'General Strike', description: 'Massive pressure reduction.', effects: [] }
    },
    {
        id: 'investigative_journalist',
        name: 'Investigative Journalist',
        base_actions_per_turn: 2,
        burnout_max: 8,
        burnout_strained_threshold: 5,
        passive: 'Truth Seeker: +1 Evidence when exposing corruption.',
        unique_actions: [
            { id: 'expose_corruption', name: 'Expose Corruption', description: 'Increase rights protection.', resource_costs: { solidarity: 1 }, burnout_cost: 1, effects: [] },
            { id: 'deep_investigation', name: 'Deep Investigation', description: 'Gain massive evidence.', resource_costs: { capacity: 1 }, burnout_cost: 1, effects: [] }
        ],
        breakthrough_action: { id: 'global_expose', name: 'Global Expose', description: 'Massive impact on speech.', effects: [] }
    }
];

const MOCK_SCENARIOS: ScenarioMetadata[] = [
    {
        id: 'mvp_witness_dignity',
        name: "Witness & Dignity",
        description: "High pressure in MENA. Global solidarity is our only shield.",
        introduction: "In a world where the stones themselves seem to cry out against injustice, you lead a coalition of truth-seekers and community organizers. The 'Witness & Dignity' scenario focuses on the intense pressures within the MENA region, where global solidarity is the only shield against escalating conflict and climate collapse.",
        story: "The dust never settles here. In the ruins of what was once a vibrant neighborhood, the silence is deafening. But then, a rhythmic tapping. A child, hit by the debris of a fallen world, is using a stone to pulse a signal into the night. They are not just rubble. They are witnesses."
    },
    {
        id: 'green_resistance',
        name: "Green Resistance",
        description: "Protecting indigenous land rights and stopping illegal extraction.",
        introduction: "Beyond the cities, a different kind of war is being fought. The 'Green Resistance' explores the struggle for land and life in the Amazon and Sub-Saharan Africa. Can you protect the last lungs of the Earth against corporate-driven extraction?",
        story: "They come at night, with machines that sound like thunder. The jungle, once alive with a thousand voices, is becoming a graveyard of ancient giants. But the roots hold deep. And they are whispering to us. We will stand with the green."
    }
];

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
        </div>
    );
}

export default function App() {
    const [state, dispatch] = useReducer(gameReducer, null);
    const [flow, setFlow] = useState<'landing' | 'scenarios' | 'game'>('landing');
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [selectedLogIdx, setSelectedLogIdx] = useState<number | null>(null);
    const [isDealOpen, setIsDealOpen] = useState(false);
    const [activeOverlay, setActiveOverlay] = useState<string>('displacement');

    if (flow === 'landing') {
        return <LandingPage onStart={() => setFlow('scenarios')} />;
    }

    if (flow === 'scenarios' || !state) {
        return (
            <ScenarioSelect
                scenarios={MOCK_SCENARIOS}
                onBack={() => setFlow('landing')}
                onStartGame={(scenarioId: string) => {
                    dispatch({ type: 'START_GAME', scenarioId });
                    setFlow('game');
                }}
            />
        );
    }

    const isCoalitionReady = state.players.every(p => p.isReady);

    const advancePhase = () => {
        if (state.phase === "WORLD") {
            dispatch({ type: 'RESOLVE_WORLD_PHASE' });
        } else if (state.phase === "COALITION" && isCoalitionReady) {
            dispatch({ type: 'RESOLVE_INTENTS' });
        } else if (state.phase === "END") {
            dispatch({ type: 'END_TURN' });
        }
    };

    const handleCommitIntent = (playerId: number, actionId: string, targetId?: string) => {
        dispatch({ type: 'COMMIT_INTENT', playerId, intent: { actionId, targetId } });
    };

    const handleSetReady = (playerId: number, ready: boolean) => {
        dispatch({ type: 'SET_READY', playerId, ready });
    };

    const getTemperatureBand = (temp: number) => {
        if (temp < 4) return { band: 1, max: 4, desc: 'Draw 1 crisis, cascade chance 0%' };
        if (temp < 7) return { band: 2, max: 4, desc: 'Draw 1 crisis, cascade chance 10%' };
        if (temp < 10) return { band: 3, max: 4, desc: 'Draw 2 crisis, cascade chance 25%' };
        return { band: 4, max: 4, desc: 'CRITICAL CASCADE' };
    };

    const tempInfo = getTemperatureBand(state.temperature);

    const resetToHome = () => {
        dispatch({ type: 'RESET' });
        setFlow('landing');
    };

    return (
        <div className="layout-grid">
            {/* HEADER */}
            <div className="header glass-panel">
                <div onClick={resetToHome} style={{ cursor: 'pointer' }}>
                    <h1>The Stones Are Crying Out</h1>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        ROUND: 0{state.currentRound} | COALITION OF SEVEN | LOCAL | CLICK TO HOME
                    </div>
                </div>

                <PhaseTimeline phase={state.phase} />

                <div className="header-stats">
                    <div className="stat-item tooltip-host">
                        <span className="label">Temperature</span>
                        <span className={`value ${state.temperature >= 7 ? 'critical' : (state.temperature >= 4 ? 'warning' : '')}`}>
                            🌡️ +{state.temperature}°C ({tempInfo.band}/{tempInfo.max})
                        </span>
                        <div className="tooltip">{tempInfo.desc}</div>
                    </div>
                    <div className="stat-item">
                        <span className="label">Civic Space</span>
                        <span className="value" style={{ color: '#c084fc' }}>⚖️ {state.civic_space}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Solidarity</span>
                        <span className="value" style={{ color: 'var(--accent-green)' }}>🤝 {state.resources.solidarity}</span>
                    </div>
                </div>
            </div>

            {/* LEFT: FRONTS & CHARTER */}
            <div className="systems-dashboard glass-panel">
                <ScenarioBrief
                    title={state.scenarioId === 'green_resistance' ? "Green Resistance" : "Witness & Dignity"}
                    description={state.scenarioId === 'green_resistance' ?
                        "Protect the lungs of the earth from illegal extraction." :
                        "The occupation intensifies in MENA. Global solidarity is our only shield."}
                    rules={state.scenarioId === 'green_resistance' ?
                        ['Guardian Bond: +1 Protection in Amazon', 'Extraction Ban: Strict'] :
                        ['Witness Window: +1 Evidence in MENA', 'Aid Corridor: Locked']}
                />

                <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Systemic Fronts</h3>
                {Object.values(state.fronts).map(front => (
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
                            {ov}
                        </button>
                    ))}
                </div>

                {Object.values(state.regions).map(region => (
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
                            🌍 Resolve World Phase
                        </button>
                    ) : state.phase === 'COALITION' ? (
                        <button
                            className="btn-phase"
                            onClick={advancePhase}
                            disabled={!isCoalitionReady}
                        >
                            🤝 {isCoalitionReady ? 'Commit Coalition Intents' : 'Players Selecting...'}
                        </button>
                    ) : (
                        <button className="btn-phase" onClick={advancePhase}>
                            🧩 End Round Phase
                        </button>
                    )}
                </div>
            </div>

            {/* RIGHT: PLAYERS & LOG */}
            <div className="right-sidebar glass-panel">
                <div className="player-panel">
                    <h3 style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Coalition Strategic Intent</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {state.players.map((p, i) => (
                            <div key={i} className={`player-intent-block ${p.isReady ? 'ready' : ''}`}>
                                <ActionList
                                    player={p}
                                    role={MOCK_ROLES[i]}
                                    gameState={state}
                                    onCommit={(actId) => handleCommitIntent(i, actId)}
                                    onReady={(ready) => handleSetReady(i, ready)}
                                />
                                {state.pendingIntents.filter(pi => pi.playerId === i).length > 0 && (
                                    <div className="intent-preview" style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--accent-blue)' }}>
                                        Queued: {state.pendingIntents.filter(pi => pi.playerId === i).map(pi => pi.actionId).join(', ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="log-panel" style={{ marginTop: '2rem' }}>
                    <div className="log-header">SYSTEM TRACE LOG</div>
                    <div className="log-messages">
                        {state.logs.slice().reverse().map((log, idx) => (
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
                                        {log.message.includes('temperature') && <span className="tag token" style={{ fontSize: '0.6rem' }}>🌡️ +1</span>}
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
                role={MOCK_ROLES[0]} // Mock for first player interaction
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
