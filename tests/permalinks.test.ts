import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppPath, parseAppRoute } from '../src/mvp/urlState.ts';

test('home route stays at the root path', () => {
  const route = parseAppRoute('/', 'witness_dignity');

  assert.equal(route.page, 'home');
  assert.equal(route.scenarioId, 'witness_dignity');
  assert.equal(buildAppPath(route), '/');
});

test('guidelines routes carry only the selected scenario', () => {
  const route = parseAppRoute('/guidelines/green_resistance', 'witness_dignity');

  assert.equal(route.page, 'guidelines');
  assert.equal(route.scenarioId, 'green_resistance');
  assert.equal(buildAppPath(route), '/guidelines/green_resistance');
});

test('offline route is a single stable path', () => {
  const route = parseAppRoute('/offline', 'witness_dignity');

  assert.equal(route.page, 'offline');
  assert.equal(route.roomId, null);
  assert.equal(buildAppPath(route), '/offline');
});

test('room routes only preserve the room id', () => {
  const route = parseAppRoute('/rooms/room-7', 'witness_dignity');

  assert.equal(route.page, 'room');
  assert.equal(route.roomId, 'room-7');
  assert.equal(buildAppPath(route), '/rooms/room-7');
});
