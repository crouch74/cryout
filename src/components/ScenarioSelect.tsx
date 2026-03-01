import React, { useState } from 'react';
import type { ScenarioMetadata } from '../engine/types';

interface ScenarioSelectProps {
    scenarios: ScenarioMetadata[];
    onStartGame: (scenarioId: string) => void;
    onBack?: () => void;
}

export const ScenarioSelect: React.FC<ScenarioSelectProps> = ({ scenarios, onStartGame, onBack }) => {
    const [selectedScenario, setSelectedScenario] = useState<ScenarioMetadata | null>(null);

    return (
        <div className="scenario-selector-page">
            <button className="btn-skip" style={{ position: 'absolute', top: '2rem', left: '2rem' }} onClick={onBack}>
                ← Return to Landing Page
            </button>

            <h2>Choose Your Strategic Scenario</h2>
            <p className="subtitle">
                Each scenario offers unique initial states, regional vulnerabilities, and special rules that define the struggle.
            </p>

            <div className="scenario-selection">
                {scenarios.map((scenario) => (
                    <div
                        key={scenario.id}
                        className={`scenario-card glass-panel ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
                        onClick={() => setSelectedScenario(scenario)}
                    >
                        <div className="scenario-card-content">
                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                                Available Scenario
                            </div>
                            <h3>{scenario.name}</h3>
                            <p className="desc">{scenario.description}</p>
                            <div className="scenario-story">
                                "{scenario.story.split('\n')[0].substring(0, 120)}..."
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedScenario && (
                <div className="modal-overlay" onClick={() => setSelectedScenario(null)}>
                    <div className="modal-content glass-panel intro-modal" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderTop: '6px solid var(--accent-blue)', borderRadius: '32px' }}>
                        <h2 style={{ color: 'var(--accent-blue)', marginBottom: '1.5rem', textAlign: 'left' }}>{selectedScenario.name}</h2>
                        <span className="section-label" style={{ textAlign: 'left', margin: '0 0 1rem 0' }}>The Challenge</span>

                        <div style={{ marginBottom: '2.5rem', fontSize: '1.15rem', lineHeight: '1.7', color: '#cbd5e1' }}>
                            {selectedScenario.introduction}
                        </div>

                        <span className="section-label" style={{ textAlign: 'left', margin: '2rem 0 1rem 0' }}>The Storyscape</span>
                        <div className="dramatization-text">
                            {selectedScenario.story}
                        </div>

                        <button
                            className="btn-cta btn-start"
                            onClick={() => onStartGame(selectedScenario.id)}
                            style={{ width: '100%', padding: '1.5rem', borderRadius: '50px' }}
                        >
                            Begin the Struggle
                        </button>

                        <button
                            className="btn-overlay"
                            style={{ marginTop: '1.5rem', width: '100%', color: 'var(--text-secondary)' }}
                            onClick={() => setSelectedScenario(null)}
                        >
                            Close Scenario
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
