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
import type { CompiledContent, EngineCommand, EngineState, SerializedGame } from '../engine/index.ts';

interface RoomRecord {
  content: CompiledContent;
  state: EngineState;
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

function getPathSegments(request: IncomingMessage) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.pathname.split('/').filter(Boolean);
}

function buildRoomSnapshot(roomId: string, room: RoomRecord) {
  return {
    roomId,
    latestEventSeq: room.state.eventLog.at(-1)?.seq ?? 0,
    state: room.state,
  };
}

export function createRoomController() {
  const rooms = new Map<string, RoomRecord>();

  return {
    createRoom(startCommand: Extract<EngineCommand, { type: 'StartGame' }>) {
      const content = compileContent(startCommand.scenarioId, startCommand.expansionIds ?? []);
      const state = initializeGame(startCommand);
      let roomId = createRoomKey();
      while (rooms.has(roomId)) {
        roomId = createRoomKey();
      }
      const room = { content, state };
      rooms.set(roomId, room);
      return buildRoomSnapshot(roomId, room);
    },
    getRoom(roomId: string) {
      const room = rooms.get(roomId);
      return room ? buildRoomSnapshot(roomId, room) : null;
    },
    applyCommands(roomId: string, commands: EngineCommand[]) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      for (const command of commands) {
        room.state = dispatchCommand(room.state, command, room.content);
      }
      return buildRoomSnapshot(roomId, room);
    },
    loadSnapshot(roomId: string, snapshot: SerializedGame) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      room.content = compileContent(snapshot.scenarioId);
      room.state = normalizeEngineState(snapshot.snapshot);
      return buildRoomSnapshot(roomId, room);
    },
    replay(roomId: string) {
      const room = rooms.get(roomId);
      if (!room) {
        return null;
      }
      return {
        roomId,
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

    const segments = getPathSegments(request);
    const [api, roomsSegment, roomId, tail] = segments;

    if (request.method === 'GET' && api === 'api' && roomsSegment === 'health') {
      sendJson(response, 200, { status: 'ok', service: 'dignity-rising-room-service' });
      return;
    }

    if (request.method === 'POST' && api === 'api' && roomsSegment === 'rooms' && !roomId) {
      const payload = await readJson<Extract<EngineCommand, { type: 'StartGame' }>>(request);
      const snapshot = controller.createRoom({
        type: 'StartGame',
        scenarioId: payload.scenarioId,
        mode: payload.mode,
        playerCount: payload.playerCount,
        roleIds: payload.roleIds,
        seed: payload.seed,
        expansionIds: payload.expansionIds ?? [],
      });
      sendJson(response, 201, snapshot);
      return;
    }

    if (api !== 'api' || roomsSegment !== 'rooms' || !roomId) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    const room = controller.getRoom(roomId);
    if (!room) {
      sendJson(response, 404, { error: 'Room not found' });
      return;
    }

    if (request.method === 'GET' && !tail) {
      sendJson(response, 200, room);
      return;
    }

    if (request.method === 'DELETE' && !tail) {
      controller.deleteRoom(roomId);
      sendJson(response, 200, { roomId, deleted: true });
      return;
    }

    if (request.method === 'GET' && tail === 'replay') {
      sendJson(response, 200, controller.replay(roomId));
      return;
    }

    if (request.method === 'POST' && tail === 'commands') {
      const payload = await readJson<{ commands: EngineCommand[] }>(request);
      sendJson(response, 200, controller.applyCommands(roomId, payload.commands ?? []));
      return;
    }

    if (request.method === 'POST' && tail === 'load') {
      const payload = await readJson<{ serialized?: string; snapshot?: SerializedGame }>(request);
      const snapshot = payload.snapshot ?? (payload.serialized ? deserializeGame(payload.serialized) : null);
      if (!snapshot) {
        sendJson(response, 400, { error: 'Missing serialized payload' });
        return;
      }
      sendJson(response, 200, controller.loadSnapshot(roomId, snapshot));
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
  });
}

export function startRoomService(port = Number(process.env.PORT ?? 3010)) {
  const server = createRoomService();
  server.listen(port, () => {
    console.log(`Dignity Rising room service listening on http://localhost:${port}`);
  });
  return server;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  startRoomService();
}
