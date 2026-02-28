// ============================================================
// Dice Rolling Utilities — "Where the Stones Cry Out"
// ============================================================

/** 🎲 Roll a single six-sided die (1-6) */
export function rollD6(): number {
    return Math.floor(Math.random() * 6) + 1;
}

/** 🎲 Roll two six-sided dice and return their sum (2-12) */
export function roll2D6(): [number, number] {
    return [rollD6(), rollD6()];
}

/** 🎲 Roll a ten-sided die (1-10) */
export function rollD10(): number {
    return Math.floor(Math.random() * 10) + 1;
}

/** 🎲 Roll 1d6 and return individual result for each region */
export function rollExtractionDice(regionCount: number): number[] {
    return Array.from({ length: regionCount }, () => rollD6());
}
