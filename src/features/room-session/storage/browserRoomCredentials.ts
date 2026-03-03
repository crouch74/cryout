import { parseRoomCredential, roomCredentialSchema, type RoomCredential } from '../api/schemas.ts';

export const ROOM_CREDENTIAL_KEY_PREFIX = 'stones-room-credential:';

function buildRoomCredentialKey(roomId: string) {
  return `${ROOM_CREDENTIAL_KEY_PREFIX}${roomId}`;
}

export function readRoomCredential(roomId: string) {
  return parseRoomCredential(window.localStorage.getItem(buildRoomCredentialKey(roomId)));
}

export function writeRoomCredential(roomId: string, credential: RoomCredential) {
  const parsedCredential = roomCredentialSchema.parse(credential);
  window.localStorage.setItem(buildRoomCredentialKey(roomId), JSON.stringify(parsedCredential));
}
