// src/engine/core.ts
import { CivicSpace } from './types';
import type { GameState } from './types';
import { evaluateEffects } from './dsl';

export type GameAction =
    | { type: 'START_GAME' }
    | { type: 'PLAYER_ACTION', playerId: number, actionId: string, payload?: any }
    | { type: 'END_TURN' }
    | { type: 'RESOLVE_WORLD_PHASE' };

export function initializeGameState(): GameState {
    // Hardcoded MVP witness & dignity state mapping for testing frontend easily
    return {
        temperature: 2,
        civic_space: CivicSpace.NARROWED,
        resources: {
            solidarity: 2,
            evidence: 2,
            capacity: 1,
            relief: 0
        },
        globalTokens: {},
        fronts: {
            WAR: { id: "WAR", name: "War & Conflict", pressure: 6, protection: 2, impact: 4 },
            CLIMATE: { id: "CLIMATE", name: "Climate Crisis", pressure: 3, protection: 3, impact: 2 },
            RIGHTS: { id: "RIGHTS", name: "Human Rights", pressure: 5, protection: 3, impact: 3 },
            SPEECH_INFO: { id: "SPEECH_INFO", name: "Speech & Information", pressure: 4, protection: 4, impact: 2 },
            POVERTY: { id: "POVERTY", name: "Economic Poverty", pressure: 5, protection: 2, impact: 4 },
            ENERGY: { id: "ENERGY", name: "Energy Access", pressure: 3, protection: 4, impact: 2 },
            CULTURE: { id: "CULTURE", name: "Art & Culture", pressure: 2, protection: 5, impact: 1 }
        },
        regions: {
            MENA: { id: "MENA", vulnerability: { CLIMATE: 1, WAR: 3 }, tokens: { displacement: 2 }, locks: [] },
            SouthAsia: { id: "SouthAsia", vulnerability: { CLIMATE: 3, POVERTY: 2 }, tokens: {}, locks: [] },
            PacificIslands: { id: "PacificIslands", vulnerability: { CLIMATE: 3 }, tokens: {}, locks: [] },
            SubSaharanAfrica: { id: "SubSaharanAfrica", vulnerability: { CLIMATE: 2, POVERTY: 3 }, tokens: {}, locks: [] },
            LatinAmerica: { id: "LatinAmerica", vulnerability: { POVERTY: 2, SPEECH_INFO: 2 }, tokens: {}, locks: [] },
            Europe: { id: "Europe", vulnerability: {}, tokens: {}, locks: [] },
            NorthAmerica: { id: "NorthAmerica", vulnerability: {}, tokens: {}, locks: [] }
        },
        players: [
            { roleId: "organizer", burnout: 0, actionsRemaining: 2 },
            { roleId: "investigative_journalist", burnout: 0, actionsRemaining: 2 }
        ],
        currentRound: 1,
        phase: "WORLD",
        logs: [
            { emoji: "🌍", message: "Game Initialized: MVP Witness & Dignity Scenario", timestamp: Date.now() }
        ]
    };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
    let newState = { ...state, logs: [...state.logs] };

    switch (action.type) {
        case 'START_GAME':
            return initializeGameState();

        case 'RESOLVE_WORLD_PHASE':
            if (newState.phase !== "WORLD") return state;

            newState = evaluateEffects(newState, [
                { log: { emoji: "🌍", message: "World Phase resolving..." } },
                { modify_track: { target: "temperature", delta: 1, clamp: { min: 0, max: 10 } } },
                { log: { emoji: "🔥", message: "Temperature rising slightly due to global inertia." } }
            ]);
            newState.phase = "COALITION";
            return newState;

        case 'PLAYER_ACTION':
            if (newState.phase !== "COALITION") return state;

            const player = newState.players[action.playerId];
            if (player.actionsRemaining <= 0) return state;

            newState.logs.push({ emoji: "✅", message: `Player ${action.playerId} takes action: ${action.actionId}`, timestamp: Date.now() });
            player.actionsRemaining -= 1;

            // Look up effects based on roleId here in full impl.
            // E.g. trigger DSL evaluation. For MVP mock:
            if (action.actionId === "mutual_aid_network") {
                newState = evaluateEffects(newState, [
                    { modify_track: { target: "fronts.POVERTY.pressure", delta: -1, clamp: { min: 0, max: 10 } } }
                ]);
            }

            return newState;

        case 'END_TURN':
            // Move to compromise or end
            newState.phase = "WORLD";
            newState.currentRound += 1;
            newState.players.forEach(p => p.actionsRemaining = 2); // reset based on role
            newState.logs.push({ emoji: "🌍", message: `Round ${newState.currentRound} Begins`, timestamp: Date.now() });
            return newState;

        default:
            return state;
    }
}
