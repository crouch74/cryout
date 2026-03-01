import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEffectPreview,
  compileContent,
  getScenarioRuleStatus,
  getSeatDisabledReason,
  getTemperatureBand,
  initializeGame,
  type EngineCommand,
} from '../engine/index.ts';
import { GAME_A11Y_LABELS, getPhaseProgressSteps, getToastRole } from '../src/mvp/gameUiHelpers.ts';
import { DEFAULT_GAME_VIEW_STATE } from '../src/mvp/urlState.ts';

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
  const state = initializeGame(startCommand);

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

  state.regions.MENA.locks.push('AidAccess');
  const aidCorridorStatus = getScenarioRuleStatus(state, 'aid_corridor');
  assert.equal(aidCorridorStatus.value, 'Locked in West Asia & North Africa');

  const preview = buildEffectPreview(content.actions.community_mobilization);
  assert.match(preview, /solidarity/i);
});

test('phase progress helper marks the active step and exposes step semantics', () => {
  const steps = getPhaseProgressSteps('COALITION');

  assert.equal(steps.length, 4);
  assert.equal(steps[1]?.step, 'COALITION');
  assert.equal(steps[1]?.state, 'active');
  assert.equal(steps[1]?.current, 'step');
  assert.equal(steps[0]?.state, 'complete');
  assert.equal(steps[2]?.state, 'upcoming');
});

test('game screen source includes landmark and labelled tray markup', () => {
  const source = readFileSync(new URL('../src/mvp/GameScreen.tsx', import.meta.url), 'utf8');

  assert.match(source, /<header/);
  assert.match(source, /<main/);
  assert.match(source, /<aside/);
  assert.match(source, /aria-label=\{getOpenTrayTitle\(viewState\)\}/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-describedby=/);
  assert.match(source, /dev-panel-toggle/);
  assert.match(source, /devMode && viewState\.showDebug/);
});

test('default game view state uses the tray-driven model', () => {
  assert.equal(DEFAULT_GAME_VIEW_STATE.openTray, 'actions');
  assert.equal(DEFAULT_GAME_VIEW_STATE.scenarioSection, 'fronts');
  assert.equal('mobileTray' in DEFAULT_GAME_VIEW_STATE, false);
  assert.equal('folioSection' in DEFAULT_GAME_VIEW_STATE, false);
  assert.equal('playAreaSection' in DEFAULT_GAME_VIEW_STATE, false);
});

test('route screens keep the new board-first shells', () => {
  const home = readFileSync(new URL('../src/mvp/HomeScreen.tsx', import.meta.url), 'utf8');
  const guidelines = readFileSync(new URL('../src/mvp/GuidelinesScreen.tsx', import.meta.url), 'utf8');
  const playerGuide = readFileSync(new URL('../src/mvp/PlayerGuideScreen.tsx', import.meta.url), 'utf8');

  assert.match(home, /setup-feature-board/);
  assert.match(guidelines, /dossier-spread/);
  assert.match(playerGuide, /guide-tab-rail/);
});

test('disabled reason explains phase gating and helper text is expected inline', () => {
  const content = compileContent(startCommand.scenarioId);
  const state = initializeGame(startCommand);
  const disabled = getSeatDisabledReason(state, content, 0, 'community_mobilization', { kind: 'NONE' });

  assert.equal(disabled.reason, 'Phase locked');
  assert.equal(disabled.disabled, true);
});

test('toast helpers expose polite live-region metadata and status roles', () => {
  assert.equal(GAME_A11Y_LABELS.liveUpdates, 'Live game updates');
  assert.equal(getToastRole('success'), 'status');
  assert.equal(getToastRole('error'), 'alert');
});
