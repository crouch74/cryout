// src/engine/dsl.ts
import type { GameState, Effect, EffectTrace } from './types';

export function resolveCondition(state: GameState, conditionStr: string): boolean {
    // A simple parsing for MVP
    // e.g. "global.resources.evidence >= 3"
    // e.g. "fronts.WAR.pressure >= 8"

    try {
        const parts = conditionStr.split(' ');
        const [path, operator, valueStr] = parts;

        // Resolve path
        const pathKeys = path.split('.');
        let currentVal: any = state;
        for (const key of pathKeys) {
            if (currentVal[key] !== undefined) {
                currentVal = currentVal[key];
            } else {
                return false;
            }
        }

        const value = parseFloat(valueStr);

        switch (operator) {
            case '>=': return currentVal >= value;
            case '<=': return currentVal <= value;
            case '>': return currentVal > value;
            case '<': return currentVal < value;
            case '==': return currentVal == value;
            case '!=': return currentVal != value;
            default: return false;
        }
    } catch (e) {
        console.error("Failed to parse condition:", conditionStr, e);
        return false;
    }
}

export function evaluateEffects(state: GameState, effects: Effect[], contextLog?: { emoji: string, message: string }): GameState {
    let newState = JSON.parse(JSON.stringify(state)) as GameState; // Deep copy for immutability
    const traces: EffectTrace[] = [];

    for (const effect of effects) {
        let status: 'executed' | 'failed' | 'skipped' = 'executed';
        let reason: string | undefined;

        try {
            if (effect.log) {
                newState.logs.push({
                    emoji: effect.log.emoji,
                    message: effect.log.message,
                    timestamp: Date.now()
                });
            }

            if (effect.modify_track) {
                const { target, delta, clamp } = effect.modify_track;
                const pathKeys = target.split('.');
                let ptr: any = newState;
                for (let i = 0; i < pathKeys.length - 1; i++) {
                    ptr = ptr[pathKeys[i]];
                }
                const finalKey = pathKeys[pathKeys.length - 1];

                let val = ptr[finalKey] + delta;
                if (clamp) {
                    val = Math.max(clamp.min, Math.min(clamp.max, val));
                }
                ptr[finalKey] = val;
            }

            if (effect.add_token) {
                const { region, target, token_type, count } = effect.add_token;
                if (region && region !== "ANY") {
                    const reg = newState.regions[region];
                    reg.tokens[token_type] = (reg.tokens[token_type] || 0) + count;
                } else if (target === "global") {
                    newState.globalTokens[token_type] = (newState.globalTokens[token_type] || 0) + count;
                }
            }

            if (effect.remove_token) {
                const { region, target, token_type, count } = effect.remove_token;
                if (region && region !== "ANY") {
                    const reg = newState.regions[region];
                    reg.tokens[token_type] = Math.max(0, (reg.tokens[token_type] || 0) - count);
                } else if (target === "global") {
                    newState.globalTokens[token_type] = Math.max(0, (newState.globalTokens[token_type] || 0) - count);
                }
            }

            if (effect.add_lock) {
                const { region, lock_type } = effect.add_lock;
                if (region && region !== "ANY") {
                    const reg = newState.regions[region];
                    if (!reg.locks.includes(lock_type)) {
                        reg.locks.push(lock_type);
                    }
                }
            }

            if (effect.remove_lock) {
                const { region, lock_type } = effect.remove_lock;
                if (region) {
                    if (region === "ANY") {
                        Object.values(newState.regions).forEach(reg => {
                            reg.locks = reg.locks.filter(l => l !== lock_type);
                        });
                    } else {
                        const reg = newState.regions[region];
                        reg.locks = reg.locks.filter(l => l !== lock_type);
                    }
                }
            }
        } catch (e) {
            status = 'failed';
            reason = String(e);
        }

        traces.push({ effect, status, reason });
    }

    if (contextLog) {
        newState.logs.push({
            ...contextLog,
            timestamp: Date.now(),
            traces
        });
    }

    return newState;
}
