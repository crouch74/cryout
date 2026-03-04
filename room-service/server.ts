import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  normalizeEngineState,
  serializeGame,
} from '../src/engine/index.ts';
import type {
  CompiledContent,
  EngineCommand,
  EngineState,
  QueuedIntent,
  SerializedGame,
  StartGameCommand,
} from '../src/engine/index.ts';
import {
  commandBatchRequestSchema,
  createRoomResponseSchema,
  joinRoomRequestSchema,
  joinRoomResponseSchema,
  roomLoadRequestSchema,
  startRoomRequestSchema,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type RoomActiveSnapshot,
  type RoomConfig,
  type RoomLobbySnapshot,
} from '../src/features/room-session/api/schemas.ts';
import { createRoomRequestSchema } from '../src/features/room-session/api/schemas.ts';
import { ZodError } from 'zod';

interface RoomCredential {
  ownerId: number;
  ownerToken: string | null;
  displayLabel: string;
}

interface RoomRecord {
  roomId: string;
  phase: 'LOBBY' | 'ACTIVE';
  config: RoomConfig;
  owners: RoomCredential[];
  hostOwnerId: number;
  content: CompiledContent | null;
  state: EngineState | null;
}

const ROOM_KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? (JSON.parse(body) as T) : ({} as T);
}

function sendBadRequest(response: ServerResponse, error: string) {
  sendJson(response, 400, { error });
}

function createRoomKeySegment() {
  const letters = new Uint8Array(3);
  crypto.getRandomValues(letters);
  return Array.from(letters, (value) => ROOM_KEY_ALPHABET[value % ROOM_KEY_ALPHABET.length]).join('');
}

function createRoomKey() {
  return `${createRoomKeySegment()}-${createRoomKeySegment()}-${createRoomKeySegment()}`;
}

function createOwnerToken() {
  return `${crypto.randomUUID()}-${createRoomKeySegment()}`;
}

function getUrl(request: IncomingMessage) {
  return new URL(request.url ?? '/', 'http://localhost');
}

function getPathSegments(request: IncomingMessage) {
  return getUrl(request).pathname.split('/').filter(Boolean);
}

function redactQueuedIntents(intents: QueuedIntent[]) {
  return intents.map((intent) => ({
    slot: intent.slot,
    actionId: intent.actionId,
    regionId: intent.regionId,
    domainId: intent.domainId,
  }));
}

function redactStateForOwner(state: EngineState, ownerId: number): EngineState {
  const snapshot = normalizeEngineState(state);
  snapshot.players = snapshot.players.map((player) =>
    player.ownerId === ownerId
      ? player
      : {
          ...player,
          mandateId: player.mandateRevealed ? player.mandateId : '',
          resistanceHand: [],
          mandateRevealed: player.mandateRevealed,
          queuedIntents: redactQueuedIntents(player.queuedIntents) as typeof player.queuedIntents,
        },
  );
  return snapshot;
}

function resolveOwnerFromToken(room: RoomRecord, ownerToken: string | undefined | null) {
  if (!ownerToken) {
    return null;
  }
  return room.owners.find((owner) => owner.ownerToken === ownerToken)?.ownerId ?? null;
}

function commandSeatBelongsToOwner(state: EngineState, command: EngineCommand, ownerId: number) {
  if (!('seat' in command)) {
    return true;
  }
  return state.players[command.seat]?.ownerId === ownerId;
}

function buildLobbySnapshot(room: RoomRecord, ownerToken: string | null = null): RoomLobbySnapshot {
  return {
    phase: 'LOBBY',
    roomId: room.roomId,
    hostOwnerId: room.hostOwnerId,
    viewerOwnerId: resolveOwnerFromToken(room, ownerToken),
    config: room.config,
    owners: room.owners.map((owner) => ({
      ownerId: owner.ownerId,
      displayLabel: owner.displayLabel,
      claimed: Boolean(owner.ownerToken),
    })),
  };
}

function buildActiveSnapshot(room: RoomRecord, ownerId: number): RoomActiveSnapshot {
  const state = room.state ? redactStateForOwner(room.state, ownerId) : null;
  if (!state) {
    throw new Error(`Room ${room.roomId} is active without state.`);
  }

  return {
    phase: 'ACTIVE',
    roomId: room.roomId,
    ownerId,
    ownedSeats: state.players.filter((player) => player.ownerId === ownerId).map((player) => player.seat),
    latestEventSeq: state.eventLog.at(-1)?.seq ?? 0,
    state,
  };
}

function createOwners(config: RoomConfig): RoomCredential[] {
  const ownerIds = [...new Set(config.seatOwnerIds ?? [])].sort((left, right) => left - right);
  return ownerIds.map((ownerId) => ({
    ownerId,
    ownerToken: null,
    displayLabel: `Player ${ownerId + 1}`,
  }));
}

function ensureRoomModeConfig(config: StartGameCommand): RoomConfig {
  return createRoomRequestSchema.parse({
    ...config,
    secretMandates: 'enabled',
  });
}

export function createRoomController() {
  const rooms = new Map<string, RoomRecord>();

  return {
    createRoom(startCommand: StartGameCommand): CreateRoomResponse {
      const config = ensureRoomModeConfig(startCommand);
      let roomId = createRoomKey();
      while (rooms.has(roomId)) {
        roomId = createRoomKey();
      }

      const owners = createOwners(config);
      const hostOwnerId = owners[0]?.ownerId ?? 0;
      const hostOwner = owners.find((owner) => owner.ownerId === hostOwnerId);
      if (!hostOwner) {
        throw new Error('Room creation requires at least one owner slot.');
      }
      hostOwner.ownerToken = createOwnerToken();

      const room: RoomRecord = {
        roomId,
        phase: 'LOBBY',
        config,
        owners,
        hostOwnerId,
        content: null,
        state: null,
      };
      rooms.set(roomId, room);

      console.log(`🏠 [RoomService] Created lobby ${roomId} for ${config.rulesetId}.`);
      return createRoomResponseSchema.parse({
        ...buildLobbySnapshot(room, hostOwner.ownerToken),
        hostCredential: {
          ownerId: hostOwner.ownerId,
          ownerToken: hostOwner.ownerToken,
        },
      });
    },
    getRoom(roomId: string, ownerToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }

      if (room.phase === 'LOBBY') {
        return buildLobbySnapshot(room, ownerToken);
      }

      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId === null) {
        return { unauthorized: true };
      }
      return buildActiveSnapshot(room, ownerId);
    },
    claimOwner(roomId: string, ownerId: number) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      if (room.phase !== 'LOBBY') {
        return { forbidden: true };
      }

      const owner = room.owners.find((entry) => entry.ownerId === ownerId);
      if (!owner) {
        return { invalidOwner: true };
      }
      if (owner.ownerToken) {
        return { conflict: true };
      }

      owner.ownerToken = createOwnerToken();
      console.log(`🫱🏽‍🫲🏾 [RoomService] Owner slot ${ownerId} claimed in room ${roomId}.`);

      return joinRoomResponseSchema.parse({
        ...buildLobbySnapshot(room, owner.ownerToken),
        ownerCredential: {
          ownerId: owner.ownerId,
          ownerToken: owner.ownerToken,
        },
      } satisfies JoinRoomResponse);
    },
    startRoom(roomId: string, ownerToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      if (room.phase !== 'LOBBY') {
        return { alreadyActive: true };
      }

      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId === null) {
        return { unauthorized: true };
      }
      if (ownerId !== room.hostOwnerId) {
        return { forbidden: true };
      }
      if (room.owners.some((owner) => !owner.ownerToken)) {
        return { unclaimedOwners: true };
      }

      room.content = compileContent(room.config.rulesetId);
      room.state = initializeGame(room.config);
      room.phase = 'ACTIVE';
      console.log(`🎲 [RoomService] Room match started for ${roomId}.`);
      return buildActiveSnapshot(room, ownerId);
    },
    applyCommands(roomId: string, ownerToken: string | null, commands: EngineCommand[]) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      if (room.phase !== 'ACTIVE' || !room.state || !room.content) {
        return { inactive: true };
      }

      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId === null) {
        return { unauthorized: true };
      }

      for (const command of commands) {
        if (!commandSeatBelongsToOwner(room.state, command, ownerId)) {
          return { forbidden: true };
        }
        room.state = dispatchCommand(room.state, command, room.content);
      }

      return buildActiveSnapshot(room, ownerId);
    },
    loadSnapshot(roomId: string, ownerToken: string | null, snapshot: SerializedGame) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      if (room.phase !== 'ACTIVE') {
        return { inactive: true };
      }

      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId === null) {
        return { unauthorized: true };
      }

      room.content = compileContent(snapshot.rulesetId);
      room.state = normalizeEngineState(snapshot.snapshot);
      return buildActiveSnapshot(room, ownerId);
    },
    replay(roomId: string, ownerToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      if (room.phase !== 'ACTIVE' || !room.state) {
        return { inactive: true };
      }

      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId === null) {
        return { unauthorized: true };
      }

      return {
        roomId,
        ownerId,
        serialized: serializeGame(room.state),
        commandLog: room.state.commandLog,
      };
    },
    deleteRoom(roomId: string, ownerToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      const ownerId = resolveOwnerFromToken(room, ownerToken);
      if (ownerId !== room.hostOwnerId) {
        return { forbidden: true };
      }
      return rooms.delete(roomId);
    },
  };
}

export function createRoomService() {
  const controller = createRoomController();

  return createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        sendJson(response, 204, {});
        return;
      }

      const url = getUrl(request);
      const ownerToken = url.searchParams.get('ownerToken');
      const segments = getPathSegments(request);
      const [api, roomsSegment, roomId, tail] = segments;

      if (request.method === 'GET' && api === 'api' && roomsSegment === 'health') {
        sendJson(response, 200, { status: 'ok', service: 'stones-cutover-room-service' });
        return;
      }

      if (request.method === 'POST' && api === 'api' && roomsSegment === 'rooms' && !roomId) {
        const payload = createRoomRequestSchema.parse(await readJson<StartGameCommand>(request));
        const snapshot = controller.createRoom(payload);
        sendJson(response, 201, snapshot);
        return;
      }

      if (api !== 'api' || roomsSegment !== 'rooms' || !roomId) {
        sendJson(response, 404, { error: 'Not found' });
        return;
      }

      if (request.method === 'GET' && !tail) {
        const room = controller.getRoom(roomId, ownerToken);
        if (!room) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('unauthorized' in room) {
          sendJson(response, 401, { error: 'Owner token required' });
          return;
        }
        sendJson(response, 200, room);
        return;
      }

      if (request.method === 'DELETE' && !tail) {
        const deleted = controller.deleteRoom(roomId, ownerToken);
        if (deleted === null) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if (typeof deleted === 'object' && 'forbidden' in deleted) {
          sendJson(response, 403, { error: 'Only the host can delete the room' });
          return;
        }
        sendJson(response, 200, { roomId, deleted: true });
        return;
      }

      if (request.method === 'POST' && tail === 'join') {
        const payload = joinRoomRequestSchema.parse(await readJson(request));
        const join = controller.claimOwner(roomId, payload.ownerId);
        if (!join) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('forbidden' in join) {
          sendJson(response, 403, { error: 'Room is no longer accepting seat claims' });
          return;
        }
        if ('invalidOwner' in join) {
          sendJson(response, 400, { error: 'Unknown owner slot' });
          return;
        }
        if ('conflict' in join) {
          sendJson(response, 409, { error: 'Owner slot already claimed' });
          return;
        }
        sendJson(response, 200, join);
        return;
      }

      if (request.method === 'POST' && tail === 'start') {
        const payload = startRoomRequestSchema.parse(await readJson(request));
        const room = controller.startRoom(roomId, payload.ownerToken ?? ownerToken);
        if (!room) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('unauthorized' in room) {
          sendJson(response, 401, { error: 'Owner token required' });
          return;
        }
        if ('forbidden' in room) {
          sendJson(response, 403, { error: 'Only the host can start the room' });
          return;
        }
        if ('unclaimedOwners' in room) {
          sendJson(response, 409, { error: 'Every player slot must be claimed before the room can start' });
          return;
        }
        if ('alreadyActive' in room) {
          sendJson(response, 409, { error: 'Room already active' });
          return;
        }
        sendJson(response, 200, room);
        return;
      }

      if (request.method === 'GET' && tail === 'replay') {
        const replay = controller.replay(roomId, ownerToken);
        if (!replay) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('inactive' in replay) {
          sendJson(response, 409, { error: 'Room has not started yet' });
          return;
        }
        if ('unauthorized' in replay) {
          sendJson(response, 401, { error: 'Owner token required' });
          return;
        }
        sendJson(response, 200, replay);
        return;
      }

      if (request.method === 'POST' && tail === 'commands') {
        const payload = commandBatchRequestSchema.parse(await readJson<{ ownerToken?: string; commands: EngineCommand[] }>(request));
        const room = controller.applyCommands(roomId, payload.ownerToken ?? ownerToken, payload.commands);
        if (!room) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('inactive' in room) {
          sendJson(response, 409, { error: 'Room has not started yet' });
          return;
        }
        if ('unauthorized' in room) {
          sendJson(response, 401, { error: 'Owner token required' });
          return;
        }
        if ('forbidden' in room) {
          sendJson(response, 403, { error: 'Owner does not control that seat' });
          return;
        }
        sendJson(response, 200, room);
        return;
      }

      if (request.method === 'POST' && tail === 'load') {
        const payload = roomLoadRequestSchema.parse(
          await readJson<{ ownerToken?: string; serialized?: string; snapshot?: SerializedGame }>(request),
        );
        const snapshot = payload.snapshot ?? (payload.serialized ? deserializeGame(payload.serialized) : null);
        if (!snapshot) {
          sendBadRequest(response, 'Missing serialized payload');
          return;
        }
        const room = controller.loadSnapshot(roomId, payload.ownerToken ?? ownerToken, snapshot);
        if (!room) {
          sendJson(response, 404, { error: 'Room not found' });
          return;
        }
        if ('inactive' in room) {
          sendJson(response, 409, { error: 'Room has not started yet' });
          return;
        }
        if ('unauthorized' in room) {
          sendJson(response, 401, { error: 'Owner token required' });
          return;
        }
        sendJson(response, 200, room);
        return;
      }

      sendJson(response, 404, { error: 'Route not found' });
    } catch (error) {
      if (error instanceof ZodError) {
        sendBadRequest(response, error.issues[0]?.message ?? 'Invalid request payload');
        return;
      }

      console.error('🚨 [RoomService] Request handling failed.', error);
      sendJson(response, 500, { error: 'Internal server error' });
    }
  });
}

export function startRoomService(port = Number(process.env.PORT ?? 3010)) {
  const server = createRoomService();
  server.listen(port, () => {
    console.log(`Where the Stones Cry Out room service listening on http://localhost:${port}`);
  });
  return server;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  startRoomService();
}
