import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createRoomService } from '../../room-service/server.ts';
import type { StartGameCommand } from '../../src/engine/index.ts';

export const roomStartCommand: StartGameCommand = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 7070,
};

export async function withRoomService<T>(run: (baseUrl: string) => Promise<T>) {
  const server = createRoomService();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Expected room service to expose a bound address.');
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

export async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let payload: T | { error: string } | null = null;
  const text = await response.text();
  if (text) {
    payload = JSON.parse(text) as T | { error: string };
  }

  return { response, payload };
}
