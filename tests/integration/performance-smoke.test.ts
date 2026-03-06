import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  buildBalancedSeatOwners,
  compileContent,
  initializeGame,
  listRulesets,
} from '../../src/engine/index.ts';
import { requestJson, roomStartCommand, withRoomService } from './room-service-test-utils.ts';

test('scenario boot pipeline stays within smoke-performance budgets', () => {
  const budgets = {
    compileAndInitMs: 250,
    totalAcrossRulesetsMs: 700,
  };
  const rulesets = listRulesets();
  const totalStart = performance.now();

  for (const ruleset of rulesets) {
    const seatFactionIds = ruleset.factions.map((faction) => faction.id);
    const humanPlayerCount = Math.min(4, seatFactionIds.length) as 2 | 3 | 4;
    const seatOwnerIds = buildBalancedSeatOwners(humanPlayerCount, seatFactionIds);
    const start = performance.now();

    const content = compileContent(ruleset.id);
    const state = initializeGame({
      type: 'StartGame',
      rulesetId: ruleset.id,
      mode: 'LIBERATION',
      humanPlayerCount,
      seatFactionIds,
      seatOwnerIds,
      seed: 7070,
      secretMandates: 'enabled',
    });

    const elapsed = performance.now() - start;
    assert.equal(state.rulesetId, ruleset.id);
    assert.equal(content.ruleset.id, ruleset.id);
    assert.ok(elapsed < budgets.compileAndInitMs, `${ruleset.id} compile+init exceeded smoke budget: ${elapsed.toFixed(1)}ms`);
  }

  const totalElapsed = performance.now() - totalStart;
  assert.ok(totalElapsed < budgets.totalAcrossRulesetsMs, `all ruleset bootstraps exceeded smoke budget: ${totalElapsed.toFixed(1)}ms`);
});

test('room-service local round trip remains responsive for a create-join-start-command flow', async () => {
  await withRoomService(async (baseUrl) => {
    const startedAt = performance.now();

    const created = await requestJson(baseUrl, '/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomStartCommand),
    });
    assert.equal(created.response.status, 201);
    const roomId = String((created.payload as { roomId: string }).roomId);
    const hostToken = String((created.payload as { hostCredential: { ownerToken: string } }).hostCredential.ownerToken);

    const joined = await requestJson(baseUrl, `/api/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ ownerId: 1 }),
    });
    assert.equal(joined.response.status, 200);

    const started = await requestJson(baseUrl, `/api/rooms/${roomId}/start`, {
      method: 'POST',
      body: JSON.stringify({ ownerToken: hostToken }),
    });
    assert.equal(started.response.status, 200);

    const commands = await requestJson(baseUrl, `/api/rooms/${roomId}/commands`, {
      method: 'POST',
      body: JSON.stringify({
        ownerToken: hostToken,
        commands: [{ type: 'ResolveSystemPhase' }],
      }),
    });
    assert.equal(commands.response.status, 200);

    const elapsed = performance.now() - startedAt;
    assert.ok(elapsed < 1000, `room-service smoke flow exceeded responsiveness budget: ${elapsed.toFixed(1)}ms`);
  });
});
