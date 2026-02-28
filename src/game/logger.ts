// ============================================================
// Game Event Logger — "Where the Stones Cry Out"
// ============================================================

import type { GameEvent, GamePhase } from './types';

let eventCounter = 0;

/** Create a game event with an emoji-prefixed message */
export function createEvent(
    round: number,
    phase: GamePhase,
    message: string,
    type: GameEvent['type'] = 'info'
): GameEvent {
    return {
        id: `evt_${++eventCounter}`,
        round,
        phase,
        message,
        timestamp: Date.now(),
        type,
    };
}

// ============================================================
// Phase 1: System Extracts
// ============================================================

export function logExtractionRoll(region: string, roll: number, tokensAdded: number): string {
    if (tokensAdded === 0) return `🏭 ${region}: Extraction roll ${roll} — No new tokens`;
    if (tokensAdded === 1) return `🏭 ${region}: Extraction roll ${roll} — +1 Extraction Token`;
    return `🏭 ${region}: Extraction roll ${roll} — +${tokensAdded} Extraction Tokens!`;
}

export function logCrisisCard(cardName: string, region: string): string {
    return `⚡ Crisis: "${cardName}" strikes ${region}`;
}

export function logWarMachineIntervention(region: string, casualties: number, defense: number, actual: number): string {
    if (defense > 0) {
        return `💣 Military intervention in ${region}: ${casualties} casualties - ${defense} defense = ${actual} bodies lost`;
    }
    return `💣 Military intervention in ${region}: ${actual} bodies lost`;
}

export function logNoIntervention(): string {
    return `🛡️ Northern War Machine below threshold — no intervention this round`;
}

// ============================================================
// Phase 2: Resistance Acts
// ============================================================

export function logOrganize(player: string, region: string, bodiesGained: number, bonus: boolean): string {
    const bonusTxt = bonus ? ' (+2 repression bonus)' : '';
    return `✊ ${player} organizes in ${region}: +${bodiesGained} Bodies${bonusTxt}`;
}

export function logInvestigate(player: string, region: string): string {
    return `🔍 ${player} investigates in ${region}: Evidence gathered`;
}

export function logCampaignSuccess(player: string, domain: string, region: string, roll: number, total: number): string {
    return `🏆 ${player} launches campaign for ${domain} in ${region}: Roll ${roll}, Total ${total} — SUCCESS!`;
}

export function logCampaignFailure(player: string, domain: string, region: string, roll: number, total: number, bodiesLost: number): string {
    return `💔 ${player} launches campaign for ${domain} in ${region}: Roll ${roll}, Total ${total} — FAILURE. ${bodiesLost} bodies lost`;
}

export function logBuildSolidarity(player: string, domain: string, region: string): string {
    return `🤝 ${player} builds solidarity in ${region}: ${domain} advances`;
}

export function logSmuggleEvidence(from: string, to: string, count: number): string {
    return `📨 ${from} smuggles ${count} Evidence to ${to}`;
}

export function logInternationalOutreach(player: string): string {
    return `📡 ${player} raises international awareness: +1 Global Gaze`;
}

export function logDefend(player: string, region: string, rating: number): string {
    return `🛡️ ${player} defends ${region} with rating ${rating}`;
}

export function logPlayCard(player: string, cardName: string): string {
    return `🃏 ${player} plays "${cardName}"`;
}

// ============================================================
// Phase 3: World Watches
// ============================================================

export function logSolidarityActivated(choice: string): string {
    return `🌍 Northern solidarity activated! ${choice}`;
}

export function logSolidarityFailed(): string {
    return `🌍 Solidarity check: The world watches but does not act`;
}

export function logEscalation(region: string): string {
    return `🏗️ Escalation: New military base in ${region} — +1 Extraction Token`;
}

export function logNoEscalation(): string {
    return `🏗️ Escalation check: No new bases this round`;
}

// ============================================================
// Victory & Defeat
// ============================================================

export function logVictory(): string {
    return `🕊️ VICTORY! The resistance has prevailed. The stones have spoken.`;
}

export function logDefeat(reason: string): string {
    return `💀 DEFEAT: ${reason}`;
}

export function logRegionOverwhelmed(region: string): string {
    return `🚨 ${region} has reached maximum extraction — total corporate/military control!`;
}

export function logGazeSpecialCrisis(): string {
    return `👁️ Global Gaze reached 10 — The System cracks down harder! Drawing additional Crisis card.`;
}

// ============================================================
// Round Management
// ============================================================

export function logNewRound(round: number): string {
    return `📅 ═══════ Round ${round} begins ═══════`;
}

export function logPhaseStart(phase: string): string {
    return `⏱️ Phase: ${phase}`;
}

export function logTokenRemoved(region: string): string {
    return `✨ Extraction token removed from ${region}!`;
}

export function logRegionLiberated(region: string): string {
    return `🎉 ${region} is LIBERATED — all extraction tokens removed!`;
}
