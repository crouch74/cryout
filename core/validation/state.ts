import type { CoreGameState, CorePlayerState, CoreDeckState, ScenarioCard, CreateGamePlayerInput } from '../types.ts';
import { CORE_VERSION } from '../version.ts';
import { createRng } from '../rng.ts';

export function cloneCoreState<T>(value: T): T {
  return structuredClone(value);
}

export function createDefaultPlayer(input: CreateGamePlayerInput): CorePlayerState {
  return {
    id: input.id,
    seat: input.seat,
    ownerId: input.ownerId ?? null,
    ready: false,
    queuedActions: [],
    resources: { ...(input.resources ?? {}) },
    tags: [...(input.tags ?? [])],
    data: { ...(input.data ?? {}) },
  };
}

export function createDefaultDeck(deckId: string, cards: ScenarioCard[]): CoreDeckState {
  return {
    id: deckId,
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    drawPile: cards.map((card) => card.id),
    discardPile: [],
    active: [],
    metadata: {},
  };
}

export function createBaseState(partial: Partial<CoreGameState> = {}): CoreGameState {
  const seed = partial.seed ?? 1;
  return {
    coreVersion: partial.coreVersion ?? CORE_VERSION,
    scenarioId: partial.scenarioId ?? 'unknown',
    scenarioVersion: partial.scenarioVersion ?? '0.0.0',
    seed,
    rng: partial.rng ?? createRng(seed),
    round: partial.round ?? 1,
    turn: partial.turn ?? 1,
    phase: partial.phase ?? { id: 'setup', index: 0 },
    status: partial.status ?? 'setup',
    players: partial.players ?? {},
    tracks: partial.tracks ?? {},
    resources: partial.resources ?? {},
    zones: partial.zones ?? {},
    entities: partial.entities ?? {},
    decks: partial.decks ?? {},
    flags: partial.flags ?? {},
    counters: partial.counters ?? {},
    log: partial.log ?? [],
    commandLog: partial.commandLog ?? [],
    scenarioState: partial.scenarioState ?? {},
  };
}
