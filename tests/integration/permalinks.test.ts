import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppPath, parseAppRoute } from '../../src/app/router/pathState.ts';

test('home route stays at the root path', () => {
  const route = parseAppRoute('/', 'stones_cry_out');

  assert.equal(route.page, 'home');
  assert.equal(route.rulesetId, 'stones_cry_out');
  assert.equal(buildAppPath(route), '/');
});

test('guidelines route no longer carries scenario identifiers', () => {
  const route = parseAppRoute('/guidelines', 'stones_cry_out');

  assert.equal(route.page, 'guidelines');
  assert.equal(route.rulesetId, 'stones_cry_out');
  assert.equal(buildAppPath(route), '/guidelines');
});

test('offline route is a single stable path', () => {
  const route = parseAppRoute('/offline', 'stones_cry_out');

  assert.equal(route.page, 'offline');
  assert.equal(buildAppPath(route), '/offline');
});

test('board tour route is a single stable path', () => {
  const route = parseAppRoute('/board-tour', 'stones_cry_out');

  assert.equal(route.page, 'board-tour');
  assert.equal(buildAppPath(route), '/board-tour');
});

test('room routes only preserve the room id', () => {
  const route = parseAppRoute('/rooms/abc-def-ghi', 'stones_cry_out');

  assert.equal(route.page, 'room');
  assert.equal(route.roomId, 'abc-def-ghi');
  assert.equal(buildAppPath(route), '/rooms/abc-def-ghi');
});
