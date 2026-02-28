// ============================================================
// EndScreen — Victory / Defeat & Debrief
// ============================================================

import type { GameState } from '../game/types';

interface EndScreenProps {
    gameState: GameState;
    onReset: () => void;
}

const DEFEAT_MESSAGES: Record<string, string> = {
    region_overwhelmed: 'A region fell to total corporate and military control. The extraction is complete.',
    movement_crushed: 'A movement has been crushed — zero Bodies remain. The resistance is broken.',
    crisis_exhausted: 'The Crisis Deck is empty. The System has outlasted all opposition.',
};

const VICTORY_SUBTITLE = 'The stones have spoken. The world has listened. What was taken is being returned. The struggle continues — but today, hope won.';
const DEFEAT_SUBTITLE = 'The machines hum. The contracts are signed. But somewhere, someone remembers. And remembering is the first act of resistance.';

export function EndScreen({ gameState, onReset }: EndScreenProps) {
    const isVictory = gameState.result === 'victory';

    return (
        <div className={`end-screen ${isVictory ? 'victory' : 'defeat'}`}>
            <h1 className="end-title">{isVictory ? 'Liberation' : 'Defeat'}</h1>
            <p className="end-subtitle">
                {isVictory ? VICTORY_SUBTITLE : (DEFEAT_MESSAGES[gameState.defeatReason || ''] || DEFEAT_SUBTITLE)}
            </p>

            {/* Final Stats */}
            <div style={{
                display: 'flex', gap: '24px', marginBottom: '32px',
                fontFamily: 'var(--font-evidence)', fontSize: '0.85rem', color: 'var(--text-secondary)',
            }}>
                <span>Round {gameState.round}</span>
                <span>Global Gaze: {gameState.globalGaze}</span>
                <span>War Machine: {gameState.northernWarMachine}</span>
            </div>

            {/* Mandate Reveals */}
            <div className="mandate-reveal">
                <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '1.2rem', color: 'var(--ochre)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    Secret Mandates Revealed
                </h2>
                {gameState.players.map(player => (
                    <div className="mandate-card" key={player.id}>
                        <div className="mandate-faction" style={{ color: player.faction.themeColor }}>
                            {player.faction.displayName}
                        </div>
                        <div className="mandate-text">{player.faction.mandate}</div>
                        <div style={{
                            fontFamily: 'var(--font-evidence)',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            marginTop: '8px',
                        }}>
                            Final Bodies: {player.bodies} · Evidence Cards: {player.evidenceHand.length}
                        </div>
                    </div>
                ))}
            </div>

            {/* Debrief */}
            <div className="debrief-section">
                <h3 className="debrief-title">Debrief — Take 10-15 Minutes</h3>
                <div className="debrief-question">What choices were hardest?</div>
                <div className="debrief-question">Did you feel the tension between your Secret Mandate and collective victory?</div>
                <div className="debrief-question">What did you learn about these regions?</div>
                <div className="debrief-question">Is there one action you might take in the real world after playing?</div>
            </div>

            <button
                className="btn btn-primary"
                onClick={onReset}
                style={{ marginTop: '32px', fontSize: '1rem', padding: '12px 48px' }}
            >
                Play Again
            </button>
        </div>
    );
}
