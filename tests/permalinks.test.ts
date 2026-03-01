import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppPath, parseAppRoute } from '../src/mvp/urlState.ts';

test('home route stays at the root path', () => {
  const route = parseAppRoute('/', 'base_design');

  assert.equal(route.page, 'home');
  assert.equal(route.rulesetId, 'base_design');
  assert.equal(buildAppPath(route), '/');
});

test('guidelines route no longer carries scenario identifiers', () => {
  const route = parseAppRoute('/guidelines', 'base_design');

  assert.equal(route.page, 'guidelines');
  assert.equal(route.rulesetId, 'base_design');
  assert.equal(buildAppPath(route), '/guidelines');
});

test('offline route is a single stable path', () => {
  const route = parseAppRoute('/offline', 'base_design');

  assert.equal(route.page, 'offline');
  assert.equal(buildAppPath(route), '/offline');
});

test('room routes only preserve the room id', () => {
  const route = parseAppRoute('/rooms/abc-def-ghi', 'base_design');

  assert.equal(route.page, 'room');
  assert.equal(route.roomId, 'abc-def-ghi');
  assert.equal(buildAppPath(route), '/rooms/abc-def-ghi');
});
