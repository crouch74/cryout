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

export const roomPhaseSchema = z.enum(['LOBBY', 'ACTIVE']);
export type RoomPhase = z.infer<typeof roomPhaseSchema>;

export const roomCredentialSchema = z.object({
  ownerId: z.number().int().nonnegative(),
  ownerToken: z.string().min(1),
});

export type RoomCredential = z.infer<typeof roomCredentialSchema>;

export const roomConfigSchema = z.object({
  rulesetId: z.string().min(1),
  mode: z.enum(['LIBERATION', 'SYMBOLIC']),
  humanPlayerCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  seatFactionIds: z.array(z.string().min(1)).min(2),
  seatOwnerIds: z.array(z.number().int().nonnegative()).min(2),
  playerCount: z.number().int().positive().optional(),
  factionIds: z.array(z.string().min(1)).optional(),
  seed: z.number().int().nonnegative(),
  secretMandates: z.enum(['enabled', 'disabled']).optional(),
}).transform((value) => ({
  type: 'StartGame',
  ...value,
  seatFactionIds: value.seatFactionIds as StartGameCommand['seatFactionIds'],
  playerCount: value.playerCount as StartGameCommand['playerCount'],
  factionIds: value.factionIds as StartGameCommand['factionIds'],
}) satisfies StartGameCommand);

export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const createRoomRequestSchema = roomConfigSchema;

export const roomOwnerSummarySchema = z.object({
  ownerId: z.number().int().nonnegative(),
  displayLabel: z.string().min(1),
  claimed: z.boolean(),
});

export type RoomOwnerSummary = z.infer<typeof roomOwnerSummarySchema>;

export const roomLobbySnapshotSchema = z.object({
  phase: z.literal('LOBBY'),
  roomId: z.string().min(1),
  hostOwnerId: z.number().int().nonnegative(),
  viewerOwnerId: z.number().int().nonnegative().nullable(),
  config: roomConfigSchema,
  owners: z.array(roomOwnerSummarySchema).min(1),
});

export type RoomLobbySnapshot = z.infer<typeof roomLobbySnapshotSchema>;

export const roomActiveSnapshotSchema = z.object({
  phase: z.literal('ACTIVE'),
  roomId: z.string().min(1),
  ownerId: z.number().int().nonnegative(),
  ownedSeats: z.array(z.number().int().nonnegative()),
  latestEventSeq: z.number().int().nonnegative(),
  state: engineStateSchema,
});

export type RoomActiveSnapshot = z.infer<typeof roomActiveSnapshotSchema>;

export const roomSnapshotSchema = z.discriminatedUnion('phase', [
  roomLobbySnapshotSchema,
  roomActiveSnapshotSchema,
]);

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

export const createRoomResponseSchema = roomLobbySnapshotSchema.extend({
  hostCredential: roomCredentialSchema,
});

export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const joinRoomRequestSchema = z.object({
  ownerId: z.number().int().nonnegative(),
});

export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

export const joinRoomResponseSchema = roomLobbySnapshotSchema.extend({
  ownerCredential: roomCredentialSchema,
});

export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

export const startRoomRequestSchema = z.object({
  ownerToken: z.string().min(1).optional(),
});

export type StartRoomRequest = z.infer<typeof startRoomRequestSchema>;

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

export function parseJoinRoomResponse(payload: unknown) {
  return joinRoomResponseSchema.parse(payload);
}
