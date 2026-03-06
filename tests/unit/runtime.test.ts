import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntimeLocation, getRuntimeOptions, parseRuntimeRoute } from '../../src/app/router/runtime.ts';

test('pages runtime defaults the root entry to offline mode', () => {
  const runtime = getRuntimeOptions();
  const pagesRuntime = { ...runtime, defaultPage: 'offline' as const, forceOfflineOnly: true, useHashRouting: true };
  const route = parseRuntimeRoute('/', '', 'stones_cry_out', pagesRuntime);

  assert.equal(route.page, 'offline');
  assert.equal(route.rulesetId, 'stones_cry_out');
});

test('pages runtime resolves hash routes for offline-safe navigation', () => {
  const runtime = getRuntimeOptions();
  const pagesRuntime = { ...runtime, defaultPage: 'offline' as const, forceOfflineOnly: true, useHashRouting: true };
  const route = parseRuntimeRoute('/ignored', '#/guidelines', 'stones_cry_out', pagesRuntime);

  assert.equal(route.page, 'guidelines');
  assert.equal(route.rulesetId, 'stones_cry_out');
});

test('pages runtime keeps board tour route available offline', () => {
  const runtime = getRuntimeOptions();
  const pagesRuntime = { ...runtime, defaultPage: 'offline' as const, forceOfflineOnly: true, useHashRouting: true };
  const route = parseRuntimeRoute('/ignored', '#/board-tour', 'stones_cry_out', pagesRuntime);

  assert.equal(route.page, 'board-tour');
  assert.equal(route.rulesetId, 'stones_cry_out');
});

test('pages runtime coerces room URLs back to offline routes', () => {
  const runtime = getRuntimeOptions();
  const pagesRuntime = { ...runtime, defaultPage: 'offline' as const, forceOfflineOnly: true, useHashRouting: true };
  const href = buildRuntimeLocation({ page: 'room', rulesetId: 'stones_cry_out', roomId: 'room-7' }, pagesRuntime);

  assert.equal(href, '#/offline');
});

test('standard runtime keeps pathname routing untouched', () => {
  const runtime = { ...getRuntimeOptions(), defaultPage: 'home' as const, forceOfflineOnly: false, useHashRouting: false };
  const href = buildRuntimeLocation({ page: 'guidelines', rulesetId: 'stones_cry_out', roomId: null }, runtime);

  assert.equal(href, '/guidelines');
});
