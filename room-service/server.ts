import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  normalizeEngineState,
  serializeGame,
} from '../engine/index.ts';
import type {
  CompiledContent,
  EngineCommand,
  EngineState,
  QueuedIntent,
  SerializedGame,
  StartGameCommand,
} from '../engine/index.ts';

interface RoomCredential {
  seat: number;
  seatToken: string;
}

interface RoomRecord {
  content: CompiledContent;
  state: EngineState;
  seatTokens: RoomCredential[];
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

function createRoomKeySegment() {
  const letters = new Uint8Array(3);
  crypto.getRandomValues(letters);
  return Array.from(letters, (value) => ROOM_KEY_ALPHABET[value % ROOM_KEY_ALPHABET.length]).join('');
}

function createRoomKey() {
  return `${createRoomKeySegment()}-${createRoomKeySegment()}-${createRoomKeySegment()}`;
}

function createSeatToken() {
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

function redactStateForSeat(state: EngineState, seat: number): EngineState {
  const snapshot = normalizeEngineState(state);
  snapshot.players = snapshot.players.map((player) =>
    player.seat === seat
      ? player
      : {
          ...player,
          resistanceHand: [],
          mandateRevealed: player.mandateRevealed,
          queuedIntents: redactQueuedIntents(player.queuedIntents) as typeof player.queuedIntents,
        },
  );
  return snapshot;
}

function buildRoomSnapshot(roomId: string, room: RoomRecord, seat: number) {
  return {
    roomId,
    seat,
    latestEventSeq: room.state.eventLog.at(-1)?.seq ?? 0,
    state: redactStateForSeat(room.state, seat),
  };
}

function resolveSeatFromToken(room: RoomRecord, seatToken: string | undefined | null) {
  return room.seatTokens.find((credential) => credential.seatToken === seatToken)?.seat ?? null;
}

export function createRoomController() {
  const rooms = new Map<string, RoomRecord>();

  return {
    createRoom(startCommand: StartGameCommand) {
      const content = compileContent(startCommand.rulesetId);
      const state = initializeGame(startCommand);
      let roomId = createRoomKey();
      while (rooms.has(roomId)) {
        roomId = createRoomKey();
      }
      const seatTokens = state.players.map((player) => ({ seat: player.seat, seatToken: createSeatToken() }));
      const room = { content, state, seatTokens };
      rooms.set(roomId, room);
      return { ...buildRoomSnapshot(roomId, room, 0), seatTokens };
    },
    getRoom(roomId: string, seatToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      const seat = resolveSeatFromToken(room, seatToken);
      if (seat === null) {
        return { unauthorized: true };
      }
      return buildRoomSnapshot(roomId, room, seat);
    },
    applyCommands(roomId: string, seatToken: string | null, commands: EngineCommand[]) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      const seat = resolveSeatFromToken(room, seatToken);
      if (seat === null) {
        return { unauthorized: true };
      }
      for (const command of commands) {
        room.state = dispatchCommand(room.state, command, room.content);
      }
      return buildRoomSnapshot(roomId, room, seat);
    },
    loadSnapshot(roomId: string, seatToken: string | null, snapshot: SerializedGame) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      const seat = resolveSeatFromToken(room, seatToken);
      if (seat === null) {
        return { unauthorized: true };
      }
      room.content = compileContent(snapshot.rulesetId);
      room.state = normalizeEngineState(snapshot.snapshot);
      return buildRoomSnapshot(roomId, room, seat);
    },
    replay(roomId: string, seatToken: string | null) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      const seat = resolveSeatFromToken(room, seatToken);
      if (seat === null) {
        return { unauthorized: true };
      }
      return {
        roomId,
        seat,
        serialized: serializeGame(room.state),
        commandLog: room.state.commandLog,
      };
    },
    deleteRoom(roomId: string) {
      return rooms.delete(roomId);
    },
  };
}

export function createRoomService() {
  const controller = createRoomController();

  return createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {});
      return;
    }

    const url = getUrl(request);
    const seatToken = url.searchParams.get('seatToken');
    const segments = getPathSegments(request);
    const [api, roomsSegment, roomId, tail] = segments;

    if (request.method === 'GET' && api === 'api' && roomsSegment === 'health') {
      sendJson(response, 200, { status: 'ok', service: 'stones-cutover-room-service' });
      return;
    }

    if (request.method === 'POST' && api === 'api' && roomsSegment === 'rooms' && !roomId) {
      const payload = await readJson<StartGameCommand>(request);
      const snapshot = controller.createRoom({
        type: 'StartGame',
        rulesetId: payload.rulesetId,
        mode: payload.mode,
        playerCount: payload.playerCount,
        factionIds: payload.factionIds,
        seed: payload.seed,
      });
      sendJson(response, 201, snapshot);
      return;
    }

    if (api !== 'api' || roomsSegment !== 'rooms' || !roomId) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (request.method === 'GET' && !tail) {
      const room = controller.getRoom(roomId, seatToken);
      if (!room) {
        sendJson(response, 404, { error: 'Room not found' });
        return;
      }
      if ('unauthorized' in room) {
        sendJson(response, 401, { error: 'Seat token required' });
        return;
      }
      sendJson(response, 200, room);
      return;
    }

    if (request.method === 'DELETE' && !tail) {
      controller.deleteRoom(roomId);
      sendJson(response, 200, { roomId, deleted: true });
      return;
    }

    if (request.method === 'GET' && tail === 'replay') {
      const replay = controller.replay(roomId, seatToken);
      if (!replay) {
        sendJson(response, 404, { error: 'Room not found' });
        return;
      }
      if ('unauthorized' in replay) {
        sendJson(response, 401, { error: 'Seat token required' });
        return;
      }
      sendJson(response, 200, replay);
      return;
    }

    if (request.method === 'POST' && tail === 'commands') {
      const payload = await readJson<{ seatToken?: string; commands: EngineCommand[] }>(request);
      const room = controller.applyCommands(roomId, payload.seatToken ?? seatToken, payload.commands ?? []);
      if (!room) {
        sendJson(response, 404, { error: 'Room not found' });
        return;
      }
      if ('unauthorized' in room) {
        sendJson(response, 401, { error: 'Seat token required' });
        return;
      }
      sendJson(response, 200, room);
      return;
    }

    if (request.method === 'POST' && tail === 'load') {
      const payload = await readJson<{ seatToken?: string; serialized?: string; snapshot?: SerializedGame }>(request);
      const snapshot = payload.snapshot ?? (payload.serialized ? deserializeGame(payload.serialized) : null);
      if (!snapshot) {
        sendJson(response, 400, { error: 'Missing serialized payload' });
        return;
      }
      const room = controller.loadSnapshot(roomId, payload.seatToken ?? seatToken, snapshot);
      if (!room) {
        sendJson(response, 404, { error: 'Room not found' });
        return;
      }
      if ('unauthorized' in room) {
        sendJson(response, 401, { error: 'Seat token required' });
        return;
      }
      sendJson(response, 200, room);
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
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
