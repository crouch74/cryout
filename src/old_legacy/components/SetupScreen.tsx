// ============================================================
// SetupScreen — Game Lobby & Faction Selection
// ============================================================

import { useState } from 'react';
import type { FactionId } from '../game/types';
import { FACTIONS, FACTION_IDS } from '../game/constants';

interface SetupScreenProps {
    onStartGame: (playerCount: number, factions: FactionId[]) => void;
}

const FACTION_EMOJIS: Record<FactionId, string> = {
    forest_defenders: '🌿',
    the_sumud: '🫒',
    riverkeepers: '🌊',
    the_guardians: '🌳',
};

export function SetupScreen({ onStartGame }: SetupScreenProps) {
    const [playerCount, setPlayerCount] = useState(2);
    const [selectedFactions, setSelectedFactions] = useState<FactionId[]>(['forest_defenders', 'the_sumud']);
    const [showScene, setShowScene] = useState(false);

    const toggleFaction = (factionId: FactionId) => {
        if (selectedFactions.includes(factionId)) {
            setSelectedFactions(prev => prev.filter(f => f !== factionId));
        } else if (selectedFactions.length < playerCount) {
            setSelectedFactions(prev => [...prev, factionId]);
        }
    };

    const handleCountChange = (count: number) => {
        setPlayerCount(count);
        // Trim selected factions if needed
        if (selectedFactions.length > count) {
            setSelectedFactions(prev => prev.slice(0, count));
        }
    };

    const canStart = selectedFactions.length === playerCount;

    return (
        <div className="setup-screen">
            <h1 className="setup-title">Where the Stones Cry Out</h1>
            <p className="setup-subtitle">"The land remembers what the maps forget."</p>

            {!showScene ? (
                <>
                    {/* Player Count */}
                    <div className="setup-section">
                        <h2 className="setup-section-title">Number of Movements</h2>
                        <div className="player-count-selector">
                            {[2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    className={`count-btn ${playerCount === n ? 'selected' : ''}`}
                                    onClick={() => handleCountChange(n)}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Faction Selection */}
                    <div className="setup-section">
                        <h2 className="setup-section-title">Choose Your Movements ({selectedFactions.length}/{playerCount})</h2>
                        <div className="faction-grid">
                            {FACTION_IDS.map(id => {
                                const faction = FACTIONS[id];
                                const isSelected = selectedFactions.includes(id);
                                const isDisabled = !isSelected && selectedFactions.length >= playerCount;

                                return (
                                    <div
                                        key={id}
                                        className={`faction-option ${id} ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                                        onClick={() => !isDisabled && toggleFaction(id)}
                                    >
                                        <div className="faction-header">
                                            <span className="faction-emoji">{FACTION_EMOJIS[id]}</span>
                                            <div>
                                                <div className="faction-title">{faction.displayName}</div>
                                                <div className="faction-home">{faction.homeRegion}</div>
                                            </div>
                                        </div>
                                        <div className="faction-ability-name">
                                            {faction.abilityName}: {faction.ability}
                                        </div>
                                        <div className="faction-stats">
                                            <span>🔴 {faction.startingBodies} Bodies</span>
                                            <span>🔵 {faction.startingEvidence} Evidence</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scenario Info */}
                    <div className="setup-section">
                        <h2 className="setup-section-title">Scenario 1 — 2024: The Current Moment</h2>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            The world as of early 2024. Congo's M23 rebellion fueled by mineral demand. Gaza under bombardment.
                            Amazon activists assassinated. French withdrawal from the Sahel. Chinese dams drowning the Mekong.
                            Lithium mines consuming the Andes.
                        </p>
                        <p style={{ fontFamily: 'var(--font-flavor)', fontSize: '1rem', color: 'var(--ochre)', marginTop: '12px' }}>
                            Northern War Machine: 7 · Global Gaze: 5 · The system is entrenched. Begin.
                        </p>
                    </div>

                    <button
                        className="btn btn-primary"
                        disabled={!canStart}
                        onClick={() => setShowScene(true)}
                        style={{ fontSize: '1.1rem', padding: '12px 48px' }}
                    >
                        Begin the Struggle
                    </button>
                </>
            ) : (
                /* Dramatized Scene */
                <div className="setup-section" style={{ maxWidth: '600px' }}>
                    <h2 className="setup-section-title">The Dramatized Scene</h2>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                        <p style={{ marginBottom: '16px' }}>
                            <em style={{ fontFamily: 'var(--font-flavor)', fontSize: '1.1rem', color: 'var(--ochre)' }}>
                                The stones beneath your feet hold memory. They remember the weight of every boot,
                                every bulldozer, every child who played upon them before the machines came.
                            </em>
                        </p>
                        <p style={{ marginBottom: '16px' }}>
                            In the Congo, they dig coltan for your phone. In Palestine, they uproot olive trees
                            older than nations. In the Amazon, the last guardians face bullets for defending what
                            remains. In the Sahel, uranium powers European cities while villages go dark.
                            Along the Mekong, dams drown ancestral lands for foreign profit. In the Andes,
                            lithium mines drain the waters of those who will never drive an electric car.
                        </p>
                        <p style={{ marginBottom: '16px' }}>
                            You are the resistance. Not perfect, not pure, not always right. But present.
                            You are the ones who remain when the cameras leave. You are the stones that cry out.
                        </p>
                        <p style={{ fontFamily: 'var(--font-flavor)', fontSize: '1.1rem', color: 'var(--ochre)' }}>
                            This is not a game about winning. It is a game about what it costs to fight.
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => onStartGame(playerCount, selectedFactions)}
                            style={{ fontSize: '1.1rem', padding: '12px 48px' }}
                        >
                            The Struggle Begins
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
