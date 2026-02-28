// ============================================================
// GameBoard — Main Game Board with Regions
// ============================================================

import type { GameState, RegionName } from '../game/types';
import { REGION_NAMES } from '../game/constants';
import { RegionCard } from './RegionCard';

interface GameBoardProps {
    gameState: GameState;
    selectedRegion: RegionName | null;
    onSelectRegion: (region: RegionName) => void;
}

export function GameBoard({ gameState, selectedRegion, onSelectRegion }: GameBoardProps) {
    return (
        <div className="board-area">
            {REGION_NAMES.map(name => (
                <RegionCard
                    key={name}
                    region={gameState.regions[name]}
                    isSelected={selectedRegion === name}
                    onClick={onSelectRegion}
                />
            ))}
        </div>
    );
}
