// ============================================================
// Core Game Engine — "Where the Stones Cry Out"
// Pure logic, no UI dependencies
// ============================================================

import type {
    GameState, Player, Region, RegionName, DomainName, FactionId,
    Card, CampaignResult, CampaignModifiers, InterventionResult,
    ActionParams, GameEvent,
} from './types';
import { FACTIONS, FACTION_IDS, REGION_NAMES, REGION_DATA, SCENARIO_1, DOMAIN_NAMES, RULES, getExtractionResult } from './constants';
import { createResistanceDeck, createEvidenceDeck, createCrisisDeck, createBeaconDeck } from './cards';
import { rollD6, roll2D6 } from './dice';
import * as log from './logger';
import { createEvent } from './logger';

// ============================================================
// Game Initialization
// ============================================================

export function initializeGame(playerCount: number, selectedFactions: FactionId[]): GameState {
    console.log('🎮 Initializing game with', playerCount, 'players');

    // Create players
    const players: Player[] = selectedFactions.slice(0, playerCount).map((factionId, idx) => {
        const faction = FACTIONS[factionId];
        return {
            id: idx,
            faction,
            bodies: faction.startingBodies,
            evidenceHand: [],
            resistanceHand: [],
            permanentCards: [],
            actionsRemaining: RULES.actionsPerTurn,
            defenseRatings: {},
            mandateProgress: 0,
            tokenPlacement: null,
        };
    });

    // Create regions with Scenario 1 extraction tokens
    const regions = {} as Record<RegionName, Region>;
    for (const name of REGION_NAMES) {
        const data = REGION_DATA[name];
        regions[name] = {
            ...data,
            extractionTokens: SCENARIO_1.extractionTokens[name],
            bodiesPresent: {},
            defenseRating: 0,
        };
    }

    // Create domain tracks (all start at 0)
    const domainTracks = {} as Record<DomainName, number>;
    for (const domain of DOMAIN_NAMES) {
        domainTracks[domain] = 0;
    }

    // Create decks
    const resistanceDeck = createResistanceDeck();
    const evidenceDeck = createEvidenceDeck();
    const crisisDeck = createCrisisDeck();
    const beaconDeck = createBeaconDeck();

    const state: GameState = {
        round: 1,
        phase: 'setup',
        currentPlayerIndex: 0,
        turnOrder: players.map((_, i) => i),
        result: 'in_progress',
        victoryMode: 'liberation',
        players,
        regions,
        globalGaze: SCENARIO_1.globalGaze,
        northernWarMachine: SCENARIO_1.northernWarMachine,
        domainTracks,
        resistanceDeck,
        evidenceDeck,
        crisisDeck,
        beaconDeck,
        discardPiles: { resistance: [], evidence: [], crisis: [], beacon: [] },
        eventLog: [],
        gazeReached10: false,
    };

    // Draw opening hands: 3 Resistance + 2 Evidence per player
    for (const player of state.players) {
        for (let i = 0; i < 3; i++) {
            const card = drawCard(state, 'resistance');
            if (card) player.resistanceHand.push(card);
        }
        for (let i = 0; i < 2; i++) {
            const card = drawCard(state, 'evidence');
            if (card) player.evidenceHand.push(card);
        }
    }

    // Riverkeepers weakness: +1 extraction token to Mekong
    const riverkeeperPlayer = state.players.find(p => p.faction.id === 'riverkeepers');
    if (riverkeeperPlayer) {
        state.regions['The Mekong'].extractionTokens = Math.min(
            state.regions['The Mekong'].extractionTokens + 1,
            RULES.maxExtractionTokens
        );
        console.log('🌊 Riverkeepers weakness: +1 Extraction Token to The Mekong');
    }

    addEvent(state, log.logNewRound(1), 'info');

    return state;
}

// ============================================================
// Deck Management
// ============================================================

function drawCard(state: GameState, deckType: 'resistance' | 'evidence' | 'crisis'): Card | null {
    const deck = deckType === 'resistance' ? state.resistanceDeck
        : deckType === 'evidence' ? state.evidenceDeck
            : state.crisisDeck;

    if (deck.length === 0) {
        console.log(`📦 ${deckType} deck is empty!`);
        return null;
    }

    return deck.pop()!;
}

// ============================================================
// Phase 1: The System Extracts
// ============================================================

export function phaseSystemExtracts(state: GameState): GameState {
    const newState = { ...state, phase: 'system_extracts' as const };
    addEvent(newState, log.logPhaseStart('The System Extracts'), 'system');

    // Step A: Corporations Extract
    const extractionResults = {} as Record<RegionName, number>;
    for (const regionName of REGION_NAMES) {
        const roll = rollD6();
        const tokensToAdd = getExtractionResult(roll);
        extractionResults[regionName] = roll;

        if (tokensToAdd > 0) {
            newState.regions[regionName] = {
                ...newState.regions[regionName],
                extractionTokens: Math.min(
                    newState.regions[regionName].extractionTokens + tokensToAdd,
                    RULES.maxExtractionTokens
                ),
            };
        }

        addEvent(newState, log.logExtractionRoll(regionName, roll, tokensToAdd),
            tokensToAdd > 0 ? 'warning' : 'info');

        // Check immediate defeat
        if (newState.regions[regionName].extractionTokens >= RULES.maxExtractionTokens) {
            addEvent(newState, log.logRegionOverwhelmed(regionName), 'crisis');
            newState.result = 'defeat';
            newState.defeatReason = 'region_overwhelmed';
            newState.phase = 'game_over';
            return newState;
        }
    }
    newState.currentExtractionResults = extractionResults;

    // Step B: Draw Crisis Card
    const crisisCard = drawCard(newState, 'crisis');
    if (!crisisCard) {
        addEvent(newState, log.logDefeat('The Crisis Deck is empty — the System has crushed all opposition.'), 'crisis');
        newState.result = 'defeat';
        newState.defeatReason = 'crisis_exhausted';
        newState.phase = 'game_over';
        return newState;
    }

    newState.currentCrisisCard = crisisCard;
    const resolvedState = resolveCrisisCard(newState, crisisCard);
    Object.assign(newState, resolvedState);

    // Step C: Check Northern War Machine
    if (newState.northernWarMachine >= RULES.warMachineInterventionThreshold) {
        const intervention = resolveWarMachineIntervention(newState);
        newState.currentInterventionResult = intervention;
    } else {
        addEvent(newState, log.logNoIntervention(), 'info');
    }

    return newState;
}

function resolveCrisisCard(state: GameState, card: Card): Partial<GameState> {
    const updates: Partial<GameState> = {};
    let targetRegion = card.region;

    // If "any" or unspecified region, roll randomly
    if (!targetRegion || targetRegion === 'any') {
        const idx = Math.floor(Math.random() * REGION_NAMES.length);
        targetRegion = REGION_NAMES[idx];
    }

    addEvent(state, log.logCrisisCard(card.name, targetRegion), 'crisis');

    // Apply body losses
    if (card.bodiesLost && card.bodiesLost > 0) {
        const region = state.regions[targetRegion];
        let bodiesToRemove = card.bodiesLost;

        // Check if any players have bodies (distribute losses)
        const totalBodiesInRegion = Object.values(region.bodiesPresent).reduce((a, b) => a + b, 0);

        if (totalBodiesInRegion === 0) {
            // No bodies present — lose from player supplies equally
            const perPlayer = Math.ceil(bodiesToRemove / state.players.length);
            for (const player of state.players) {
                // Sumud ability: keep half in home region
                if (player.faction.id === 'the_sumud' && targetRegion === player.faction.homeRegion) {
                    const loss = Math.ceil(perPlayer / 2);
                    player.bodies = Math.max(0, player.bodies - loss);
                } else {
                    player.bodies = Math.max(0, player.bodies - perPlayer);
                }
            }
        } else {
            // Remove from region presence
            for (const player of state.players) {
                if (region.bodiesPresent[player.id] && bodiesToRemove > 0) {
                    const loss = Math.min(region.bodiesPresent[player.id], bodiesToRemove);
                    region.bodiesPresent[player.id] -= loss;
                    player.bodies = Math.max(0, player.bodies - loss);
                    bodiesToRemove -= loss;
                }
            }
        }
    }

    // Apply token additions
    if (card.tokensAdded && card.tokensAdded > 0) {
        state.regions[targetRegion].extractionTokens = Math.min(
            state.regions[targetRegion].extractionTokens + card.tokensAdded,
            RULES.maxExtractionTokens
        );
    }

    // Special card effects
    if (card.name === 'Media Blackout' || card.name === 'Greenwashing Campaign') {
        const gazeReduction = card.name === 'Greenwashing Campaign' ? 3 : 2;
        state.globalGaze = Math.max(0, state.globalGaze - gazeReduction);
        if (card.name === 'Media Blackout') {
            for (const player of state.players) {
                if (player.evidenceHand.length > 0) {
                    const discarded = player.evidenceHand.pop()!;
                    state.discardPiles.evidence.push(discarded);
                }
            }
        }
    }

    if (card.name === 'Sanctions Relief' || card.name === 'Arms Deal') {
        const increase = card.name === 'Arms Deal' ? 2 : 1;
        state.northernWarMachine = Math.min(RULES.maxWarMachine, state.northernWarMachine + increase);
    }

    if (card.name === 'Military Coup') {
        state.northernWarMachine = Math.min(RULES.maxWarMachine, state.northernWarMachine + 1);
    }

    if (card.name === 'Settlement Expansion') {
        state.globalGaze = Math.max(0, state.globalGaze - 1);
    }

    if (card.name === 'Surveillance Expansion') {
        for (const player of state.players) {
            let toDiscard = 2;
            while (toDiscard > 0 && player.evidenceHand.length > 0) {
                const discarded = player.evidenceHand.pop()!;
                state.discardPiles.evidence.push(discarded);
                toDiscard--;
            }
        }
    }

    if (card.name === 'Corporate Lawsuit') {
        // Target player with lowest bodies
        const target = [...state.players].sort((a, b) => a.bodies - b.bodies)[0];
        if (target) {
            state.discardPiles.evidence.push(...target.evidenceHand);
            target.evidenceHand = [];
        }
    }

    state.discardPiles.crisis.push(card);

    return updates;
}

function resolveWarMachineIntervention(state: GameState): InterventionResult {
    // Find region with most tokens
    let maxTokens = 0;
    let targetRegions: RegionName[] = [];

    for (const name of REGION_NAMES) {
        const tokens = state.regions[name].extractionTokens;
        if (tokens > maxTokens) {
            maxTokens = tokens;
            targetRegions = [name];
        } else if (tokens === maxTokens) {
            targetRegions.push(name);
        }
    }

    // Random among tied
    const targetRegion = targetRegions[Math.floor(Math.random() * targetRegions.length)];

    // Roll casualties
    const casualties = rollD6();
    const defense = state.regions[targetRegion].defenseRating;
    const actualCasualties = Math.max(0, casualties - defense);

    addEvent(state, log.logWarMachineIntervention(targetRegion, casualties, defense, actualCasualties), 'crisis');

    // Remove bodies
    if (actualCasualties > 0) {
        let remaining = actualCasualties;
        for (const player of state.players) {
            if (remaining <= 0) break;
            // Sumud ability
            if (player.faction.id === 'the_sumud' && targetRegion === player.faction.homeRegion) {
                const loss = Math.ceil(remaining / 2);
                player.bodies = Math.max(0, player.bodies - loss);
                remaining -= loss;
            } else {
                const loss = Math.min(player.bodies, Math.ceil(remaining / state.players.length));
                player.bodies = Math.max(0, player.bodies - loss);
                remaining -= loss;
            }
        }
    }

    return { region: targetRegion, casualties, defenseReduction: defense, actualCasualties };
}

// ============================================================
// Phase 2: Resistance Acts — Action Execution
// ============================================================

export function executeAction(state: GameState, playerId: number, action: ActionParams): GameState {
    const newState = { ...state };
    const player = newState.players[playerId];

    if (player.actionsRemaining <= 0) {
        console.log('⚠️ No actions remaining for player', playerId);
        return state;
    }

    switch (action.type) {
        case 'organize':
            return executeOrganize(newState, player, action.params.region);
        case 'investigate':
            return executeInvestigate(newState, player, action.params.region);
        case 'launch_campaign':
            return executeLaunchCampaign(newState, player, action.params);
        case 'build_solidarity':
            return executeBuildSolidarity(newState, player, action.params);
        case 'smuggle_evidence':
            return executeSmuggleEvidence(newState, player, action.params);
        case 'international_outreach':
            return executeInternationalOutreach(newState, player);
        case 'defend':
            return executeDefend(newState, player, action.params);
        case 'play_resistance_card':
            return executePlayResistanceCard(newState, player, action.params);
        default:
            return state;
    }
}

function executeOrganize(state: GameState, player: Player, region: RegionName): GameState {
    player.tokenPlacement = region;
    const roll = rollD6();
    let bodiesGained = roll;
    const hasBonus = state.regions[region].extractionTokens >= 4;
    if (hasBonus) bodiesGained += 2;

    // Youth Movement permanent card
    if (player.permanentCards.some(c => c.name === 'Youth Movement')) bodiesGained += 1;

    player.bodies += bodiesGained;
    player.actionsRemaining--;

    addEvent(state, log.logOrganize(player.faction.displayName, region, bodiesGained, hasBonus), 'success');
    return state;
}

function executeInvestigate(state: GameState, player: Player, region: RegionName): GameState {
    player.tokenPlacement = region;

    // Check Journalist Ally
    const hasJournalist = player.permanentCards.some(c => c.name === 'Journalist Ally');
    const drawCount = hasJournalist ? 3 : 2;
    const keepCount = hasJournalist ? 2 : 1;

    const drawn: Card[] = [];
    for (let i = 0; i < drawCount; i++) {
        const card = drawCard(state, 'evidence');
        if (card) drawn.push(card);
    }

    // Keep the best ones (highest campaign bonus), auto-select for simplicity
    drawn.sort((a, b) => (b.campaignBonus || 0) - (a.campaignBonus || 0));
    const kept = drawn.slice(0, keepCount);
    const discarded = drawn.slice(keepCount);

    player.evidenceHand.push(...kept);
    state.discardPiles.evidence.push(...discarded);
    player.actionsRemaining--;

    addEvent(state, log.logInvestigate(player.faction.displayName, region), 'info');
    return state;
}

function executeLaunchCampaign(
    state: GameState, player: Player,
    params: { region: RegionName; domain: DomainName; bodiesCommitted: number; evidenceCardIds: string[] }
): GameState {
    const { region, domain, bodiesCommitted, evidenceCardIds } = params;

    if (bodiesCommitted < 1 || player.bodies < bodiesCommitted) {
        console.log('⚠️ Invalid campaign: not enough bodies');
        return state;
    }

    player.tokenPlacement = region;

    // Get evidence cards being played
    const evidencePlayed: Card[] = [];
    for (const cardId of evidenceCardIds) {
        const idx = player.evidenceHand.findIndex(c => c.id === cardId);
        if (idx >= 0) {
            evidencePlayed.push(player.evidenceHand.splice(idx, 1)[0]);
        }
    }

    // Calculate modifiers
    const modifiers = calculateCampaignModifiers(state, region, bodiesCommitted, evidencePlayed);

    // Roll 2d6
    const [d1, d2] = roll2D6();
    const roll = d1 + d2;
    const totalScore = roll + modifiers.total;

    // Guardians ability: Dying Planet costs 1 less body
    let actualBodiesCommitted = bodiesCommitted;
    if (player.faction.id === 'the_guardians' && domain === 'Dying Planet') {
        actualBodiesCommitted = Math.max(1, bodiesCommitted - 1);
    }

    player.bodies -= actualBodiesCommitted;

    const success = totalScore >= RULES.campaignTargetNumber;

    if (success) {
        // Remove 1 Extraction Token
        state.regions[region].extractionTokens = Math.max(0, state.regions[region].extractionTokens - 1);
        addEvent(state, log.logTokenRemoved(region), 'success');

        // Advance domain
        state.domainTracks[domain] = Math.min(RULES.maxDomainTrack, state.domainTracks[domain] + 1);

        // Gain 1 Global Gaze
        state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 1);

        // Check Scenario 1 special rule
        if (!state.gazeReached10 && state.globalGaze >= 10) {
            state.gazeReached10 = true;
            addEvent(state, log.logGazeSpecialCrisis(), 'warning');
            const extraCrisis = drawCard(state, 'crisis');
            if (extraCrisis) resolveCrisisCard(state, extraCrisis);
        }

        // Region liberated?
        if (state.regions[region].extractionTokens === 0) {
            state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 2);
            addEvent(state, log.logRegionLiberated(region), 'success');
        }

        // Evidence cards with special on-success effects
        for (const card of evidencePlayed) {
            if (card.name === 'Arms Shipment Manifest' && domain === 'War Machine') {
                state.northernWarMachine = Math.max(0, state.northernWarMachine - 1);
            }
            if (card.name === 'NGO Report') {
                state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 1);
            }
        }

        addEvent(state, log.logCampaignSuccess(player.faction.displayName, domain, region, roll, totalScore), 'success');
    } else {
        // Failure: lose half committed bodies (round down) — already lost committed, return half
        const bodiesLost = Math.floor(actualBodiesCommitted / 2);
        const bodiesReturned = actualBodiesCommitted - bodiesLost;
        player.bodies += bodiesReturned;

        // Gain 1 Evidence from the struggle
        const evidenceCard = drawCard(state, 'evidence');
        if (evidenceCard) player.evidenceHand.push(evidenceCard);

        addEvent(state, log.logCampaignFailure(player.faction.displayName, domain, region, roll, totalScore, bodiesLost), 'failure');
    }

    // Discard played evidence
    state.discardPiles.evidence.push(...evidencePlayed);
    player.actionsRemaining--;

    return state;
}

export function calculateCampaignModifiers(
    state: GameState, region: RegionName, bodiesCommitted: number, evidencePlayed: Card[]
): CampaignModifiers {
    // Bodies bonus: +1 per 2 bodies (round down)
    const bodiesBonus = Math.floor(bodiesCommitted / RULES.bodiesPerBonus);

    // Evidence bonus: +1 per card (or use card's specific bonus)
    let evidenceBonus = 0;
    for (const card of evidencePlayed) {
        evidenceBonus += card.campaignBonus || 1;
    }

    // Global Gaze bonus
    let gazeBonus = 0;
    if (state.globalGaze >= RULES.gazeBonus.high) gazeBonus = RULES.gazeBonusValues.high;
    else if (state.globalGaze >= RULES.gazeBonus.mid) gazeBonus = RULES.gazeBonusValues.mid;
    else if (state.globalGaze >= RULES.gazeBonus.low) gazeBonus = RULES.gazeBonusValues.low;

    // Token penalty: -1 per extraction token
    const tokenPenalty = state.regions[region].extractionTokens;

    // War Machine penalty
    let warMachinePenalty = 0;
    if (state.northernWarMachine >= RULES.warMachinePenalty.high) warMachinePenalty = RULES.warMachinePenaltyValues.high;
    else if (state.northernWarMachine >= RULES.warMachinePenalty.mid) warMachinePenalty = RULES.warMachinePenaltyValues.mid;
    else if (state.northernWarMachine >= RULES.warMachinePenalty.low) warMachinePenalty = RULES.warMachinePenaltyValues.low;

    const total = bodiesBonus + evidenceBonus + gazeBonus - tokenPenalty - warMachinePenalty;

    return { bodiesBonus, evidenceBonus, gazeBonus, tokenPenalty, warMachinePenalty, total };
}

function executeBuildSolidarity(
    state: GameState, player: Player,
    params: { region: RegionName; domain: DomainName }
): GameState {
    if (player.bodies < RULES.buildSolidarityCost) {
        console.log('⚠️ Not enough bodies for Build Solidarity');
        return state;
    }

    player.tokenPlacement = params.region;

    // Guardians ability
    let cost = RULES.buildSolidarityCost;
    if (player.faction.id === 'the_guardians' && params.domain === 'Dying Planet') {
        cost = Math.max(1, cost - 1);
    }

    player.bodies -= cost;
    state.domainTracks[params.domain] = Math.min(RULES.maxDomainTrack, state.domainTracks[params.domain] + 1);
    player.actionsRemaining--;

    addEvent(state, log.logBuildSolidarity(player.faction.displayName, params.domain, params.region), 'success');
    return state;
}

function executeSmuggleEvidence(
    state: GameState, player: Player,
    params: { targetPlayerId: number; cardIds: string[] }
): GameState {
    const target = state.players[params.targetPlayerId];
    if (!target) return state;

    // Check Siege weakness for Sumud
    if (target.faction.id === 'the_sumud') {
        console.log('⚠️ The Sumud cannot receive Bodies from others (The Siege)');
        // Evidence is fine though
    }

    const cards: Card[] = [];
    for (const cardId of params.cardIds) {
        const idx = player.evidenceHand.findIndex(c => c.id === cardId);
        if (idx >= 0) cards.push(player.evidenceHand.splice(idx, 1)[0]);
    }

    // Cost: 1 body per 2 cards
    let cost = Math.ceil(cards.length / RULES.smuggleEvidenceCostRatio);

    // Encrypted Communications or Underground Railroad reduce cost
    if (player.permanentCards.some(c => c.name === 'Encrypted Communications')) cost = 0;
    if (player.permanentCards.some(c => c.name === 'Underground Railroad')) {
        const freeCards = 2;
        cost = Math.max(0, Math.ceil((cards.length - freeCards) / RULES.smuggleEvidenceCostRatio));
    }

    if (player.bodies < cost) {
        // Return cards
        player.evidenceHand.push(...cards);
        console.log('⚠️ Not enough bodies for Smuggle Evidence');
        return state;
    }

    player.bodies -= cost;
    target.evidenceHand.push(...cards);
    player.actionsRemaining--;

    addEvent(state, log.logSmuggleEvidence(player.faction.displayName, target.faction.displayName, cards.length), 'info');
    return state;
}

function executeInternationalOutreach(state: GameState, player: Player): GameState {
    // Cost: 2 Evidence cards (or 1 with Diaspora Network)
    const hasDiaspora = player.permanentCards.some(c => c.name === 'Diaspora Network');
    const cost = hasDiaspora ? 1 : RULES.internationalOutreachCost;

    if (player.evidenceHand.length < cost) {
        console.log('⚠️ Not enough Evidence cards for International Outreach');
        return state;
    }

    // Discard evidence cards
    for (let i = 0; i < cost; i++) {
        const discarded = player.evidenceHand.pop()!;
        state.discardPiles.evidence.push(discarded);
    }

    // Forest Defenders weakness: -1 if not paired
    let gazeGain = 1;
    if (player.faction.id === 'forest_defenders') {
        const hasAlly = state.players.some(p => p.id !== player.id && p.tokenPlacement === player.tokenPlacement);
        if (!hasAlly) {
            gazeGain = 0; // Global Obscurity
            console.log('🌿 Forest Defenders: Global Obscurity — no Gaze gained without ally');
        }
    }

    state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + gazeGain);

    // Scenario 1 special
    if (!state.gazeReached10 && state.globalGaze >= 10) {
        state.gazeReached10 = true;
        addEvent(state, log.logGazeSpecialCrisis(), 'warning');
        const extraCrisis = drawCard(state, 'crisis');
        if (extraCrisis) resolveCrisisCard(state, extraCrisis);
    }

    player.actionsRemaining--;
    addEvent(state, log.logInternationalOutreach(player.faction.displayName), 'success');
    return state;
}

function executeDefend(state: GameState, player: Player, params: { region: RegionName; bodiesSpent: number }): GameState {
    if (player.bodies < params.bodiesSpent) {
        console.log('⚠️ Not enough bodies for Defend');
        return state;
    }

    player.tokenPlacement = params.region;
    player.bodies -= params.bodiesSpent;
    state.regions[params.region].defenseRating += params.bodiesSpent;
    player.defenseRatings[params.region] = (player.defenseRatings[params.region] || 0) + params.bodiesSpent;
    player.actionsRemaining--;

    addEvent(state, log.logDefend(player.faction.displayName, params.region, params.bodiesSpent), 'info');
    return state;
}

function executePlayResistanceCard(
    state: GameState, player: Player,
    params: { cardId: string; targetRegion?: RegionName }
): GameState {
    const cardIdx = player.resistanceHand.findIndex(c => c.id === params.cardId);
    if (cardIdx < 0) return state;

    const card = player.resistanceHand.splice(cardIdx, 1)[0];
    addEvent(state, log.logPlayCard(player.faction.displayName, card.name), 'info');

    // Handle permanent cards
    if (card.type === 'permanent') {
        player.permanentCards.push(card);
        player.actionsRemaining--;
        return state;
    }

    // Handle specific action cards
    switch (card.name) {
        case 'General Strike': {
            const region = params.targetRegion || player.faction.homeRegion;
            state.regions[region].extractionTokens = Math.max(0, state.regions[region].extractionTokens - 1);
            player.bodies = Math.max(0, player.bodies - 3);
            addEvent(state, log.logTokenRemoved(region), 'success');
            break;
        }
        case 'International Tribunal':
            state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 2);
            state.northernWarMachine = Math.max(0, state.northernWarMachine - 1);
            break;
        case 'Community Kitchen': {
            const region = params.targetRegion || player.faction.homeRegion;
            player.bodies += 4;
            player.tokenPlacement = region;
            break;
        }
        case 'Whistle-blower':
            for (let i = 0; i < 3; i++) {
                const c = drawCard(state, 'evidence');
                if (c) player.evidenceHand.push(c);
            }
            state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 1);
            break;
        case 'Ancestral Knowledge':
            state.domainTracks['Dying Planet'] = Math.min(RULES.maxDomainTrack, state.domainTracks['Dying Planet'] + 1);
            state.domainTracks['Stolen Voice'] = Math.min(RULES.maxDomainTrack, state.domainTracks['Stolen Voice'] + 1);
            break;
        case 'Cultural Festival': {
            const region = params.targetRegion || player.faction.homeRegion;
            player.bodies += 3;
            state.domainTracks['Stolen Voice'] = Math.min(RULES.maxDomainTrack, state.domainTracks['Stolen Voice'] + 1);
            player.tokenPlacement = region;
            break;
        }
        case 'Prisoner Exchange':
            state.domainTracks['Gilded Cage'] = Math.min(RULES.maxDomainTrack, state.domainTracks['Gilded Cage'] + 1);
            player.bodies += 2;
            state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 1);
            break;
        case 'Sabotage': {
            const region = params.targetRegion || player.faction.homeRegion;
            const sabotageRoll = rollD6();
            if (sabotageRoll >= 4) {
                state.regions[region].extractionTokens = Math.max(0, state.regions[region].extractionTokens - 1);
                addEvent(state, log.logTokenRemoved(region), 'success');
            } else {
                player.bodies = Math.max(0, player.bodies - 2);
            }
            break;
        }
        case 'Documentary Film':
            state.globalGaze = Math.min(RULES.maxGlobalGaze, state.globalGaze + 3);
            const crisis = drawCard(state, 'crisis');
            if (crisis) resolveCrisisCard(state, crisis);
            break;
        default:
            // Generic action card — discard
            break;
    }

    state.discardPiles.resistance.push(card);
    player.actionsRemaining--;

    // Check gaze special
    if (!state.gazeReached10 && state.globalGaze >= 10) {
        state.gazeReached10 = true;
        addEvent(state, log.logGazeSpecialCrisis(), 'warning');
        const extraCrisis = drawCard(state, 'crisis');
        if (extraCrisis) resolveCrisisCard(state, extraCrisis);
    }

    return state;
}

// ============================================================
// Phase 3: The World Watches
// ============================================================

export function phaseWorldWatches(state: GameState): GameState {
    const newState = { ...state, phase: 'world_watches' as const };
    addEvent(newState, log.logPhaseStart('The World Watches'), 'system');

    // Step A: Solidarity Check
    if (newState.globalGaze >= RULES.solidarityGazeThreshold) {
        const roll = rollD6();
        if (roll >= 5) {
            // Solidarity activated — give bodies by default
            const bodiesGained = rollD6();
            const perPlayer = Math.ceil(bodiesGained / newState.players.length);
            for (const player of newState.players) {
                player.bodies += perPlayer;
            }
            addEvent(newState, log.logSolidarityActivated(`+${bodiesGained} Bodies distributed`), 'success');
        } else {
            addEvent(newState, log.logSolidarityFailed(), 'info');
        }
    }

    // Step B: Escalation Check
    if (newState.northernWarMachine >= RULES.escalationWarMachineThreshold) {
        const roll = rollD6();
        if (roll >= 4) {
            const idx = Math.floor(Math.random() * REGION_NAMES.length);
            const region = REGION_NAMES[idx];
            newState.regions[region].extractionTokens = Math.min(
                RULES.maxExtractionTokens,
                newState.regions[region].extractionTokens + 1
            );
            addEvent(newState, log.logEscalation(region), 'warning');

            // Check defeat
            if (newState.regions[region].extractionTokens >= RULES.maxExtractionTokens) {
                addEvent(newState, log.logRegionOverwhelmed(region), 'crisis');
                newState.result = 'defeat';
                newState.defeatReason = 'region_overwhelmed';
                newState.phase = 'game_over';
                return newState;
            }
        } else {
            addEvent(newState, log.logNoEscalation(), 'info');
        }
    }

    // Step C: Check Victory/Defeat
    if (checkVictory(newState)) {
        addEvent(newState, log.logVictory(), 'success');
        newState.result = 'victory';
        newState.phase = 'game_over';
        return newState;
    }

    // Check defeat: 0 bodies
    for (const player of newState.players) {
        if (player.bodies <= 0) {
            addEvent(newState, log.logDefeat(`${player.faction.displayName} has no Bodies remaining — the movement is crushed.`), 'crisis');
            newState.result = 'defeat';
            newState.defeatReason = 'movement_crushed';
            newState.phase = 'game_over';
            return newState;
        }
    }

    // Step D: Discard and Draw
    for (const player of newState.players) {
        // Discard excess evidence
        while (player.evidenceHand.length > RULES.maxEvidenceHandSize) {
            const discarded = player.evidenceHand.pop()!;
            newState.discardPiles.evidence.push(discarded);
        }

        // Draw 1 Resistance + 1 Evidence
        const resCard = drawCard(newState, 'resistance');
        if (resCard) player.resistanceHand.push(resCard);
        const eviCard = drawCard(newState, 'evidence');
        if (eviCard) player.evidenceHand.push(eviCard);
    }

    // Step E: Prepare new round
    newState.round++;
    for (const player of newState.players) {
        player.actionsRemaining = RULES.actionsPerTurn;
        player.tokenPlacement = null;
        player.defenseRatings = {};
    }
    // Reset region defense ratings
    for (const region of REGION_NAMES) {
        newState.regions[region].defenseRating = 0;
    }

    // Clear phase-specific UI data
    newState.currentExtractionResults = undefined;
    newState.currentCrisisCard = undefined;
    newState.currentInterventionResult = undefined;

    addEvent(newState, log.logNewRound(newState.round), 'system');
    newState.phase = 'system_extracts';

    return newState;
}

// ============================================================
// Victory & Defeat Checks
// ============================================================

export function checkVictory(state: GameState): boolean {
    if (state.victoryMode === 'liberation') {
        // Condition 1: 4+ regions with ≤2 tokens
        const liberatedRegions = REGION_NAMES.filter(r => state.regions[r].extractionTokens <= RULES.victoryMaxTokensPerRegion);
        const condition1 = liberatedRegions.length >= RULES.victoryRegionsNeeded;

        // Condition 2: War Machine ≤4
        const condition2 = state.northernWarMachine <= RULES.victoryMaxWarMachine;

        // Condition 3: Global Gaze ≥12
        const condition3 = state.globalGaze >= RULES.victoryMinGaze;

        return condition1 && condition2 && condition3;
    }
    return false;
}

export function checkDefeat(state: GameState): boolean {
    // Region overwhelmed
    for (const region of REGION_NAMES) {
        if (state.regions[region].extractionTokens >= RULES.maxExtractionTokens) return true;
    }
    // Player crushed
    for (const player of state.players) {
        if (player.bodies <= 0) return true;
    }
    // Crisis deck empty
    if (state.crisisDeck.length === 0) return true;
    return false;
}

// ============================================================
// Turn Management
// ============================================================

export function advanceToNextPlayer(state: GameState): GameState {
    const newState = { ...state };
    const nextIdx = (newState.currentPlayerIndex + 1) % newState.players.length;

    if (nextIdx === 0) {
        // All players have acted — move to Phase 3
        return phaseWorldWatches(newState);
    }

    newState.currentPlayerIndex = nextIdx;
    return newState;
}

export function startResistancePhase(state: GameState): GameState {
    const newState = { ...state, phase: 'resistance_acts' as const, currentPlayerIndex: 0 };
    addEvent(newState, log.logPhaseStart('The Resistance Acts'), 'system');

    for (const player of newState.players) {
        player.actionsRemaining = RULES.actionsPerTurn;
    }

    return newState;
}

// ============================================================
// Helpers
// ============================================================

function addEvent(state: GameState, message: string, type: GameEvent['type']): void {
    state.eventLog.push(createEvent(state.round, state.phase, message, type));
}

export function getActivePlayer(state: GameState): Player {
    return state.players[state.currentPlayerIndex];
}

export function canPlayerAct(state: GameState, playerId: number): boolean {
    return state.phase === 'resistance_acts' && state.players[playerId].actionsRemaining > 0;
}
