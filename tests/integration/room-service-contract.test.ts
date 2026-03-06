import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoomResponseSchema,
  joinRoomResponseSchema,
  parseRoomSnapshot,
  roomLobbySnapshotSchema,
} from '../../src/features/room-session/api/schemas.ts';
import { requestJson, roomStartCommand, withRoomService } from './room-service-test-utils.ts';

test('room service health and create-room responses match the public contract', async () => {
  await withRoomService(async (baseUrl) => {
    const health = await requestJson<{ status: string; service: string }>(baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.payload, {
      status: 'ok',
      service: 'stones-cutover-room-service',
    });

    const created = await requestJson(baseUrl, '/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomStartCommand),
    });

    assert.equal(created.status, 201);
    const snapshot = createRoomResponseSchema.parse(created.payload);
    assert.equal(snapshot.phase, 'LOBBY');
    assert.equal(snapshot.config.secretMandates, 'enabled');
    assert.equal(snapshot.hostCredential.ownerId, snapshot.hostOwnerId);
    assert.match(snapshot.roomId, /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
  });
});

test('join, start, and snapshot wire payloads stay schema-safe and preserve seat redaction', async () => {
  await withRoomService(async (baseUrl) => {
    const created = createRoomResponseSchema.parse((await requestJson(baseUrl, '/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomStartCommand),
    })).payload);

    const joined = await requestJson(baseUrl, `/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ ownerId: 1 }),
    });
    assert.equal(joined.status, 200);
    const joinSnapshot = joinRoomResponseSchema.parse(joined.payload);
    assert.equal(joinSnapshot.ownerCredential.ownerId, 1);
    assert.equal(joinSnapshot.viewerOwnerId, 1);

    const started = await requestJson(baseUrl, `/api/rooms/${created.roomId}/start`, {
      method: 'POST',
      body: JSON.stringify({ ownerToken: created.hostCredential.ownerToken }),
    });
    assert.equal(started.status, 200);
    const activeSnapshot = parseRoomSnapshot(started.payload);
    assert.equal(activeSnapshot.phase, 'ACTIVE');
    assert.equal(activeSnapshot.ownerId, 0);

    const commandResponse = await requestJson(baseUrl, `/api/rooms/${created.roomId}/commands`, {
      method: 'POST',
      body: JSON.stringify({
        ownerToken: created.hostCredential.ownerToken,
        commands: [
          { type: 'ResolveSystemPhase' },
          { type: 'QueueIntent', seat: 1, action: { actionId: 'defend', regionId: 'Levant', comradesCommitted: 1 } },
        ],
      }),
    });
    assert.equal(commandResponse.status, 200);

    const remoteViewer = await requestJson(baseUrl, `/api/rooms/${created.roomId}?ownerToken=${joinSnapshot.ownerCredential.ownerToken}`);
    assert.equal(remoteViewer.status, 200);
    const redactedSnapshot = parseRoomSnapshot(remoteViewer.payload);
    assert.equal(redactedSnapshot.phase, 'ACTIVE');
    assert.equal(redactedSnapshot.state.players[1]?.queuedIntents[0]?.actionId, 'defend');
    assert.equal(redactedSnapshot.state.players[1]?.queuedIntents[0]?.comradesCommitted, undefined);
    assert.equal(redactedSnapshot.state.players[1]?.mandateId, '');
  });
});

test('invalid room-service payloads return stable HTTP status codes and error shapes', async () => {
  await withRoomService(async (baseUrl) => {
    const created = createRoomResponseSchema.parse((await requestJson(baseUrl, '/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomStartCommand),
    })).payload);

    const invalidJoin = await requestJson<{ error: string }>(baseUrl, `/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ ownerId: 9 }),
    });
    assert.equal(invalidJoin.status, 400);
    assert.deepEqual(invalidJoin.payload, { error: 'Unknown owner slot' });

    const startWithoutClaims = await requestJson<{ error: string }>(baseUrl, `/api/rooms/${created.roomId}/start`, {
      method: 'POST',
      body: JSON.stringify({ ownerToken: created.hostCredential.ownerToken }),
    });
    assert.equal(startWithoutClaims.status, 409);
    assert.deepEqual(startWithoutClaims.payload, { error: 'Every player slot must be claimed before the room can start' });

    const roomWithoutToken = await requestJson(baseUrl, `/api/rooms/${created.roomId}`);
    assert.equal(roomWithoutToken.status, 200);
    roomLobbySnapshotSchema.parse(roomWithoutToken.payload);

    const malformedCreate = await requestJson<{ error: string }>(baseUrl, '/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ ...roomStartCommand, seatFactionIds: [] }),
    });
    assert.equal(malformedCreate.status, 400);
    assert.ok((malformedCreate.payload?.error ?? '').length > 0);
  });
});
