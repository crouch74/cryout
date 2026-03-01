import type { RngState } from './types.ts';

export function createRng(seed: number): RngState {
  const normalized = seed >>> 0;
  return {
    seed: normalized,
    state: normalized || 1,
    calls: 0,
  };
}

export function nextRandom(rng: RngState): [RngState, number] {
  const state = (Math.imul(rng.state, 1664525) + 1013904223) >>> 0;
  const value = state / 0x100000000;
  return [
    {
      ...rng,
      state,
      calls: rng.calls + 1,
    },
    value,
  ];
}

export function nextInt(rng: RngState, maxExclusive: number): [RngState, number] {
  const [next, value] = nextRandom(rng);
  return [next, Math.floor(value * maxExclusive)];
}

export function shuffle<T>(rng: RngState, items: T[]): [RngState, T[]] {
  let next = rng;
  const output = items.slice();

  for (let index = output.length - 1; index > 0; index -= 1) {
    const [updated, randomIndex] = nextInt(next, index + 1);
    next = updated;
    const swap = output[index];
    output[index] = output[randomIndex];
    output[randomIndex] = swap;
  }

  return [next, output];
}
