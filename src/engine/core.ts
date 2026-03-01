import { CivicSpace } from './types';
import type { GameState } from './types';
import { evaluateEffects } from './dsl';

export function initializeGameState(scenarioId: string = 'mvp_witness_dignity'): GameState {
    const baseState: GameState = {
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
            MENA: {
                id: "MENA",
                vulnerability: { CLIMATE: 1, WAR: 3 },
                tokens: { displacement: 2 },
                locks: [],
                institutions: [{ id: 'mena_aid', name: 'MENA Relief Hub', type: 'relief', bonus_description: '+1 Relief per round', status: 'active' }]
            },
            SouthAsia: { id: "SouthAsia", vulnerability: { CLIMATE: 3, POVERTY: 2 }, tokens: {}, locks: [], institutions: [] },
            PacificIslands: { id: "PacificIslands", vulnerability: { CLIMATE: 3 }, tokens: {}, locks: [], institutions: [] },
            SubSaharanAfrica: { id: "SubSaharanAfrica", vulnerability: { CLIMATE: 2, POVERTY: 3 }, tokens: {}, locks: [], institutions: [] },
            LatinAmerica: { id: "LatinAmerica", vulnerability: { POVERTY: 2, SPEECH_INFO: 2 }, tokens: {}, locks: [], institutions: [] },
            Europe: { id: "Europe", vulnerability: {}, tokens: {}, locks: [], institutions: [] },
            NorthAmerica: { id: "NorthAmerica", vulnerability: {}, tokens: {}, locks: [], institutions: [] }
        },
        players: [
            { roleId: "organizer", burnout: 0, actionsRemaining: 2, isReady: false },
            { roleId: "investigative_journalist", burnout: 0, actionsRemaining: 2, isReady: false }
        ],
        pendingIntents: [],
        charter: [
            { id: 'clause_1', title: 'Universal Basic Human Rights', description: 'Establishment of global enforcement mechanisms.', status: 'locked', prerequisites: [] },
            { id: 'clause_2', title: 'Climate Debt Reparations', description: 'Wealthy nations fund transition and resilience.', status: 'locked', prerequisites: [] }
        ],
        currentRound: 1,
        phase: "WORLD",
        scenarioId: scenarioId,
        logs: [
            { emoji: "🌍", message: `Game Initialized: ${scenarioId === 'green_resistance' ? 'Green Resistance' : 'Witness & Dignity'} Scenario`, timestamp: Date.now() }
        ]
    };

    if (scenarioId === 'green_resistance') {
        baseState.temperature = 3;
        baseState.civic_space = CivicSpace.REPRESSED;
        baseState.resources.solidarity = 4;
        baseState.fronts.CLIMATE.pressure = 7;
    }

    return baseState;
}


export type Action =
    | { type: 'START_GAME', scenarioId: string }
    | { type: 'COMMIT_INTENT', playerId: number, intent: { actionId: string, targetId?: string } }
    | { type: 'SET_READY', playerId: number, ready: boolean }
    | { type: 'RESOLVE_INTENTS' }
    | { type: 'RESOLVE_WORLD_PHASE' }
    | { type: 'END_TURN' }
    | { type: 'RESET' };

export function gameReducer(state: GameState | null, action: Action): GameState | null {
    if (action.type === 'START_GAME') {
        return initializeGameState(action.scenarioId);
    }

    if (action.type === 'RESET') {
        return null;
    }

    if (!state) return state;

    let newState = JSON.parse(JSON.stringify(state)) as GameState;

    switch (action.type) {

        case 'RESOLVE_WORLD_PHASE':
            if (newState.phase !== "WORLD") return state;

            newState = evaluateEffects(newState, [
                { modify_track: { target: "temperature", delta: 1, clamp: { min: 0, max: 10 } } }
            ], { emoji: "🌍", message: "World Phase resolving: global temperatures rise." });

            newState.phase = "COALITION";
            newState.logs.push({ emoji: "🤝", message: "Coalition Phase started: Players must commit intents.", timestamp: Date.now() });
            return newState;

        case 'COMMIT_INTENT':
            if (newState.phase !== "COALITION") return state;
            const p = newState.players[action.playerId];
            if (p.actionsRemaining <= 0) return state;

            newState.pendingIntents.push({ playerId: action.playerId, ...action.intent });
            p.actionsRemaining -= 1;
            newState.logs.push({ emoji: "📣", message: `${p.roleId} queued an action.`, timestamp: Date.now() });
            return newState;

        case 'SET_READY':
            newState.players[action.playerId].isReady = action.ready;
            newState.logs.push({ emoji: "✅", message: `${newState.players[action.playerId].roleId} is ${action.ready ? 'ready' : 'not ready'}.`, timestamp: Date.now() });
            return newState;

        case 'RESOLVE_INTENTS':
            if (newState.phase !== "COALITION") return state;

            newState.logs.push({ emoji: "⚖️", message: "Resolving Coalition Intents...", timestamp: Date.now() });

            // Resolve all intents in order
            newState.pendingIntents.forEach(intent => {
                const logs = { emoji: "🤝", message: `Intent resolved: ${intent.actionId}` };
                // Simple mock logic for resolution
                if (intent.actionId === "mutual_aid_network") {
                    newState = evaluateEffects(newState, [
                        { modify_track: { target: "fronts.POVERTY.pressure", delta: -1, clamp: { min: 0, max: 10 } } }
                    ], logs);
                } else if (intent.actionId === "expose_corruption") {
                    newState = evaluateEffects(newState, [
                        { modify_track: { target: "fronts.RIGHTS.protection", delta: 1, clamp: { min: 0, max: 10 } } }
                    ], logs);
                }
            });

            newState.pendingIntents = [];
            newState.players.forEach(pl => { pl.isReady = false; });
            newState.phase = "END";
            newState.logs.push({ emoji: "🧩", message: "Coalition Phase resolved. Entering End Phase.", timestamp: Date.now() });
            return newState;

        case 'END_TURN':
            newState.phase = "WORLD";
            newState.currentRound += 1;
            newState.players.forEach(pl => pl.actionsRemaining = 2);
            newState.logs.push({ emoji: "🌍", message: `Round ${newState.currentRound} Begins: World Dynamics accelerating.`, timestamp: Date.now() });
            return newState;

        default:
            return state;
    }
}
