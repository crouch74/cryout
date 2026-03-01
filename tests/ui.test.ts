import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffectPreview,
  compileContent,
  getScenarioRuleStatus,
  getSeatDisabledReason,
  getTemperatureBand,
  initializeGame,
  type EngineCommand,
} from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  scenarioId: 'witness_dignity',
  mode: 'CORE',
  playerCount: 2,
  roleIds: ['organizer', 'investigative_journalist'],
  seed: 8080,
  expansionIds: [],
};

test('temperature selector reports the expected crisis banding', () => {
  assert.deepEqual(getTemperatureBand(2), { band: 0, crisisCount: 1, couplingMultiplier: 1 });
  assert.deepEqual(getTemperatureBand(6), { band: 2, crisisCount: 2, couplingMultiplier: 2 });
  assert.deepEqual(getTemperatureBand(10), { band: 4, crisisCount: 3, couplingMultiplier: 2 });
});

test('disabled reason explains phase gating and target gating', () => {
  const content = compileContent(startCommand.scenarioId);
  let state = initializeGame(startCommand);

  const worldReason = getSeatDisabledReason(state, content, 0, 'community_mobilization', { kind: 'NONE' });
  assert.equal(worldReason.disabled, true);
  assert.equal(worldReason.reason, 'Phase locked');

  state.phase = 'COALITION';
  state.regions.MENA.locks.push('Censorship');
  const censorshipReason = getSeatDisabledReason(state, content, 1, 'counter_disinfo', { kind: 'REGION', regionId: 'MENA' });
  assert.equal(censorshipReason.disabled, true);
  assert.equal(censorshipReason.reason, 'Censorship active');
});

test('scenario chip selectors and effect previews expose useful UI text', () => {
  const content = compileContent(startCommand.scenarioId);
  const state = initializeGame(startCommand);

  const witnessStatus = getScenarioRuleStatus(state, 'witness_window');
  assert.equal(witnessStatus.value, 'Spent / inactive');

  const preview = buildEffectPreview(content.actions.community_mobilization);
  assert.match(preview, /solidarity/i);
});
