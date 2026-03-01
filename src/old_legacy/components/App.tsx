// ============================================================
// App — Root Component
// ============================================================

import { useState } from 'react';
import { useGameState } from '../hooks/useGameState';
import { SetupScreen } from './SetupScreen';
import { GlobalTracks } from './GlobalTracks';
import { GameBoard } from './GameBoard';
import { PlayerMat } from './PlayerMat';
import { ActionPanel } from './ActionPanel';
import { EventLog } from './EventLog';
import { PhaseIndicator } from './PhaseIndicator';
import { CrisisCard } from './CrisisCard';
import { EndScreen } from './EndScreen';
import { getActivePlayer } from '../game/engine';
import type { RegionName } from '../game/types';

export function App() {
    const {
        screen, gameState, selectedRegion,
        startGame, runSystemExtracts, performAction, endTurn,
        continueToResistance, continueToWorldWatches,
        selectRegion, resetGame,
    } = useGameState();

    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [showCrisis, setShowCrisis] = useState(false);

    const toggleCard = (cardId: string) => {
        setSelectedCards(prev =>
            prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
        );
    };

    // ---- Setup Screen ----
    if (screen === 'setup') {
        return <SetupScreen onStartGame={(count, factions) => {
            startGame(count, factions);
            setSelectedCards([]);
        }} />;
    }

    // ---- Game Over Screen ----
    if (screen === 'game_over' && gameState) {
        return <EndScreen gameState={gameState} onReset={resetGame} />;
    }

    if (!gameState) return null;

    const activePlayer = gameState.phase === 'resistance_acts' ? getActivePlayer(gameState) : null;

    // Phase control buttons
    const renderPhaseControls = () => {
        switch (gameState.phase) {
            case 'setup':
            case 'system_extracts':
                if (!gameState.currentExtractionResults) {
                    return (
                        <button className="btn btn-danger" onClick={() => {
                            runSystemExtracts();
                            setShowCrisis(true);
                        }}>
                            🏭 Run System Extracts
                        </button>
                    );
                }
                return (
                    <button className="btn btn-primary" onClick={() => {
                        continueToResistance();
                        setSelectedCards([]);
                    }}>
                        ✊ Begin Resistance Phase
                    </button>
                );

            case 'resistance_acts':
                if (activePlayer && activePlayer.actionsRemaining <= 0) {
                    // Check if all players have acted
                    const allDone = gameState.players.every(p => p.actionsRemaining <= 0);
                    if (allDone) {
                        return (
                            <button className="btn btn-primary" onClick={continueToWorldWatches}>
                                🌍 World Watches Phase
                            </button>
                        );
                    }
                    return (
                        <button className="btn btn-primary" onClick={() => {
                            endTurn();
                            setSelectedCards([]);
                        }}>
                            ➡️ Next Player's Turn
                        </button>
                    );
                }
                return null;

            case 'world_watches':
                return (
                    <button className="btn btn-primary" onClick={() => {
                        runSystemExtracts();
                        setShowCrisis(true);
                    }}>
                        🏭 Next Round — System Extracts
                    </button>
                );

            default:
                return null;
        }
    };

    return (
        <div className="app-container">
            {/* Top bar — Global Tracks */}
            <GlobalTracks gameState={gameState} />

            {/* Phase bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '4px 24px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
            }}>
                <PhaseIndicator gameState={gameState} />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {renderPhaseControls()}
                </div>
            </div>

            {/* Main area — Board + Sidebar */}
            <div className="main-area">
                {/* Board */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <GameBoard
                        gameState={gameState}
                        selectedRegion={selectedRegion}
                        onSelectRegion={(r: RegionName) => selectRegion(selectedRegion === r ? null : r)}
                    />
                </div>

                {/* Right sidebar — Action Panel + Event Log */}
                <div style={{
                    width: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    flexShrink: 0,
                }}>
                    {/* Action panel (only during resistance phase) */}
                    {gameState.phase === 'resistance_acts' && activePlayer && activePlayer.actionsRemaining > 0 && (
                        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', overflow: 'auto', maxHeight: '50%' }}>
                            <ActionPanel
                                gameState={gameState}
                                selectedRegion={selectedRegion}
                                selectedCards={selectedCards}
                                onPerformAction={(action) => {
                                    performAction(action);
                                    setSelectedCards([]);
                                }}
                                onSelectRegion={selectRegion}
                            />
                        </div>
                    )}

                    {/* Event Log */}
                    <EventLog events={gameState.eventLog} />
                </div>
            </div>

            {/* Bottom bar — Player Mats */}
            <div className="bottom-bar">
                {gameState.players.map(player => (
                    <PlayerMat
                        key={player.id}
                        player={player}
                        isActive={activePlayer?.id === player.id}
                        selectedCards={selectedCards}
                        onToggleCard={toggleCard}
                    />
                ))}
            </div>

            {/* Crisis Card Modal */}
            {showCrisis && gameState.currentCrisisCard && (
                <CrisisCard
                    card={gameState.currentCrisisCard}
                    onDismiss={() => setShowCrisis(false)}
                />
            )}
        </div>
    );
}
