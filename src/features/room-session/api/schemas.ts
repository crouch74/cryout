import { z } from 'zod';
import type { EngineCommand, EngineState, SerializedGame, StartGameCommand } from '../../../engine/index.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const engineCommandSchema = z.custom<EngineCommand>(
  (value) => isRecord(value) && typeof value.type === 'string',
  'EngineCommand',
);

const engineStateSchema = z.custom<EngineState>(
  (value) => isRecord(value)
    && typeof value.rulesetId === 'string'
    && Array.isArray(value.players)
    && Array.isArray(value.eventLog),
  'EngineState',
);

const serializedGameSchema = z.custom<SerializedGame>(
  (value) => isRecord(value)
    && typeof value.rulesetId === 'string'
    && isRecord(value.snapshot),
  'SerializedGame',
);

export const roomCredentialSchema = z.object({
  ownerId: z.number().int().nonnegative(),
  ownerToken: z.string().min(1),
});

export type RoomCredential = z.infer<typeof roomCredentialSchema>;

export const roomSnapshotSchema = z.object({
  roomId: z.string().min(1),
  ownerId: z.number().int().nonnegative(),
  ownedSeats: z.array(z.number().int().nonnegative()),
  latestEventSeq: z.number().int().nonnegative(),
  state: engineStateSchema,
});

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

export const createRoomRequestSchema = z.object({
  rulesetId: z.string().min(1),
  mode: z.enum(['LIBERATION', 'SYMBOLIC']),
  humanPlayerCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  seatFactionIds: z.array(z.string().min(1)).min(2),
  seatOwnerIds: z.array(z.number().int().nonnegative()).min(2),
  playerCount: z.number().int().positive().optional(),
  factionIds: z.array(z.string().min(1)).optional(),
  seed: z.number().int().nonnegative(),
}).transform((value) => ({
  type: 'StartGame',
  ...value,
  seatFactionIds: value.seatFactionIds as StartGameCommand['seatFactionIds'],
  playerCount: value.playerCount as StartGameCommand['playerCount'],
  factionIds: value.factionIds as StartGameCommand['factionIds'],
}) satisfies StartGameCommand);

export const createRoomResponseSchema = roomSnapshotSchema.extend({
  ownerTokens: z.array(roomCredentialSchema).min(1),
});

export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const commandBatchRequestSchema = z.object({
  ownerToken: z.string().min(1).optional(),
  commands: z.array(engineCommandSchema).default([]),
});

export type CommandBatchRequest = z.infer<typeof commandBatchRequestSchema>;

export const roomLoadRequestSchema = z.object({
  ownerToken: z.string().min(1).optional(),
  serialized: z.string().min(1).optional(),
  snapshot: serializedGameSchema.optional(),
}).refine((value) => Boolean(value.serialized || value.snapshot), {
  message: 'Missing serialized payload',
});

export type RoomLoadRequest = z.infer<typeof roomLoadRequestSchema>;

export function parseRoomCredential(rawValue: string | null): RoomCredential | null {
  if (!rawValue) {
    return null;
  }

  try {
    return roomCredentialSchema.parse(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function parseRoomSnapshot(payload: unknown) {
  return roomSnapshotSchema.parse(payload);
}

export function parseCreateRoomResponse(payload: unknown) {
  return createRoomResponseSchema.parse(payload);
}
