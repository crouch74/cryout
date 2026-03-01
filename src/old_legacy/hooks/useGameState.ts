// ============================================================
// useGameState — React Hook for Game State Management
// ============================================================

import { useState, useCallback } from 'react';
import type { GameState, FactionId, ActionParams, RegionName } from '../game/types';
import {
    initializeGame, phaseSystemExtracts, executeAction,
    phaseWorldWatches, startResistancePhase, advanceToNextPlayer,
    getActivePlayer
} from '../game/engine';

export type GameScreen = 'setup' | 'playing' | 'game_over';

export interface UseGameStateReturn {
    screen: GameScreen;
    gameState: GameState | null;
    selectedRegion: RegionName | null;

    // Setup actions
    startGame: (playerCount: number, factions: FactionId[]) => void;

    // Game flow
    runSystemExtracts: () => void;
    performAction: (action: ActionParams) => void;
    endTurn: () => void;
    continueToResistance: () => void;
    continueToWorldWatches: () => void;

    // UI state
    selectRegion: (region: RegionName | null) => void;
    resetGame: () => void;
}

export function useGameState(): UseGameStateReturn {
    const [screen, setScreen] = useState<GameScreen>('setup');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<RegionName | null>(null);

    const startGame = useCallback((playerCount: number, factions: FactionId[]) => {
        console.log('🎮 Starting game with factions:', factions);
        const state = initializeGame(playerCount, factions);
        setGameState(state);
        setScreen('playing');
    }, []);

    const runSystemExtracts = useCallback(() => {
        if (!gameState) return;
        console.log('🏭 Running System Extracts phase');
        const newState = phaseSystemExtracts({ ...gameState });
        setGameState(newState);

        if (newState.phase === 'game_over') {
            setScreen('game_over');
        }
    }, [gameState]);

    const continueToResistance = useCallback(() => {
        if (!gameState) return;
        console.log('✊ Moving to Resistance Acts phase');
        const newState = startResistancePhase({ ...gameState });
        setGameState(newState);
    }, [gameState]);

    const performAction = useCallback((action: ActionParams) => {
        if (!gameState) return;
        const activePlayer = getActivePlayer(gameState);
        console.log(`🎯 Player ${activePlayer.faction.displayName} performs: ${action.type}`);
        const newState = executeAction({ ...gameState }, activePlayer.id, action);
        setGameState({ ...newState });

        if (newState.phase === 'game_over') {
            setScreen('game_over');
        }
    }, [gameState]);

    const endTurn = useCallback(() => {
        if (!gameState) return;
        const newState = advanceToNextPlayer({ ...gameState });
        setGameState(newState);

        if (newState.phase === 'game_over') {
            setScreen('game_over');
        }
    }, [gameState]);

    const continueToWorldWatches = useCallback(() => {
        if (!gameState) return;
        console.log('🌍 Running World Watches phase');
        const newState = phaseWorldWatches({ ...gameState });
        setGameState(newState);

        if (newState.phase === 'game_over') {
            setScreen('game_over');
        }
    }, [gameState]);

    const selectRegion = useCallback((region: RegionName | null) => {
        setSelectedRegion(region);
    }, []);

    const resetGame = useCallback(() => {
        setGameState(null);
        setScreen('setup');
        setSelectedRegion(null);
    }, []);

    return {
        screen, gameState, selectedRegion,
        startGame, runSystemExtracts, performAction, endTurn,
        continueToResistance, continueToWorldWatches,
        selectRegion, resetGame,
    };
}
