import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimeLocation, parseRuntimeRoute, type RuntimeOptions } from '../src/mvp/runtime.ts';

const standardRuntime: RuntimeOptions = {
  defaultPage: 'home',
  forceOfflineOnly: false,
  useHashRouting: false,
  devMode: false,
};

const pagesRuntime: RuntimeOptions = {
  defaultPage: 'offline',
  forceOfflineOnly: true,
  useHashRouting: true,
  devMode: false,
};

test('pages runtime defaults the root entry to offline mode', () => {
  const route = parseRuntimeRoute('/', '', 'witness_dignity', pagesRuntime);

  assert.equal(route.page, 'offline');
  assert.equal(route.roomId, null);
});

test('pages runtime resolves hash routes for offline-safe navigation', () => {
  const route = parseRuntimeRoute('/', '#/guidelines/green_resistance', 'witness_dignity', pagesRuntime);

  assert.equal(route.page, 'guidelines');
  assert.equal(route.scenarioId, 'green_resistance');
});

test('pages runtime coerces room URLs back to offline routes', () => {
  const href = buildRuntimeLocation({ page: 'room', scenarioId: 'witness_dignity', roomId: 'room-7' }, pagesRuntime);

  assert.equal(href, '#/offline');
});

test('standard runtime keeps pathname routing untouched', () => {
  const route = parseRuntimeRoute('/rooms/room-7', '', 'witness_dignity', standardRuntime);

  assert.equal(route.page, 'room');
  assert.equal(route.roomId, 'room-7');
  assert.equal(buildRuntimeLocation(route, standardRuntime), '/rooms/room-7');
});
