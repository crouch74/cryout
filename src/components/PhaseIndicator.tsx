// ============================================================
// PhaseIndicator — Current Phase & Turn Info
// ============================================================

import type { GameState } from '../game/types';
import { getActivePlayer } from '../game/engine';

interface PhaseIndicatorProps {
    gameState: GameState;
}

const PHASE_CONFIG: Record<string, { name: string; icon: string }> = {
    setup: { name: 'Setup', icon: '⚙️' },
    system_extracts: { name: 'The System Extracts', icon: '🏭' },
    resistance_acts: { name: 'The Resistance Acts', icon: '✊' },
    world_watches: { name: 'The World Watches', icon: '🌍' },
    game_over: { name: 'Game Over', icon: '🏁' },
};

export function PhaseIndicator({ gameState }: PhaseIndicatorProps) {
    const config = PHASE_CONFIG[gameState.phase] || PHASE_CONFIG.setup;
    const activePlayer = gameState.phase === 'resistance_acts' ? getActivePlayer(gameState) : null;

    return (
        <div className="phase-indicator">
            <span style={{ fontSize: '1.2rem' }}>{config.icon}</span>
            <div>
                <div className="phase-name">{config.name}</div>
                {activePlayer && (
                    <div className="phase-step">
                        {activePlayer.faction.displayName} — {activePlayer.actionsRemaining} actions left
                    </div>
                )}
            </div>
        </div>
    );
}
