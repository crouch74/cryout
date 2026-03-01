import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEffectPreview,
  compileContent,
  getPlayerBodyTotal,
  getSeatDisabledReason,
  getVictoryModeSummary,
  initializeGame,
  type EngineCommand,
} from '../engine/index.ts';
import { GAME_A11Y_LABELS, getActiveCoalitionSeat, getPhaseProgressSteps, getToastRole } from '../src/mvp/gameUiHelpers.ts';
import { DEFAULT_GAME_VIEW_STATE } from '../src/mvp/urlState.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  playerCount: 2,
  factionIds: ['congo_basin_collective', 'levant_sumud'],
  seed: 8080,
};

test('disabled reason explains phase gating and body requirements', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);

  const systemReason = getSeatDisabledReason(state, content, 0, { actionId: 'organize', regionId: 'Congo' });
  assert.equal(systemReason.disabled, true);
  assert.equal(systemReason.reason, 'Phase locked');

  state.phase = 'COALITION';
  state.regions.Congo.bodiesPresent[0] = 0;
  const solidarityReason = getSeatDisabledReason(state, content, 0, { actionId: 'build_solidarity', regionId: 'Congo', domainId: 'DyingPlanet' });
  assert.equal(solidarityReason.disabled, true);
  assert.equal(solidarityReason.reason, 'Need 3 Bodies in region');
});

test('selectors expose useful copy for the new ruleset', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);

  assert.match(getVictoryModeSummary('LIBERATION'), /Extraction Token/i);
  assert.equal(getPlayerBodyTotal(state, 0) > 0, true);
  assert.match(buildEffectPreview(content.actions.launch_campaign), /2d6 campaign/i);
});

test('phase progress helper marks the active step for the cutover loop', () => {
  const steps = getPhaseProgressSteps('COALITION');

  assert.equal(steps.length, 3);
  assert.equal(steps[1]?.step, 'COALITION');
  assert.equal(steps[1]?.state, 'active');
  assert.equal(steps[0]?.state, 'complete');
});

test('active coalition seat advances to the first seat that still has work', () => {
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';

  assert.equal(getActiveCoalitionSeat(state.players), 0);
  state.players[0].ready = true;
  state.players[0].actionsRemaining = 0;
  assert.equal(getActiveCoalitionSeat(state.players), 1);
});

test('game screen source keeps a landmark-based operator layout', () => {
  const source = readFileSync(new URL('../src/mvp/GameScreen.tsx', import.meta.url), 'utf8');

  assert.match(source, /<header/);
  assert.match(source, /<main/);
  assert.match(source, /<aside/);
  assert.match(source, /Resolve System Phase/);
  assert.match(source, /Secret Mandate/);
  assert.match(source, /Queued Moves/);
  assert.match(source, /Action Tray/);
});

test('default game view state is simplified for the cutover shell', () => {
  assert.equal(DEFAULT_GAME_VIEW_STATE.focusedSeat, 0);
  assert.equal(DEFAULT_GAME_VIEW_STATE.regionId, null);
  assert.equal(DEFAULT_GAME_VIEW_STATE.eventSeq, null);
});

test('route screens point at the cutover guides and setup shell', () => {
  const home = readFileSync(new URL('../src/mvp/HomeScreen.tsx', import.meta.url), 'utf8');
  const guidelines = readFileSync(new URL('../src/mvp/GuidelinesScreen.tsx', import.meta.url), 'utf8');
  const playerGuide = readFileSync(new URL('../src/mvp/PlayerGuideScreen.tsx', import.meta.url), 'utf8');

  assert.match(home, /Canonical Ruleset/);
  assert.match(guidelines, /Victory Modes/);
  assert.match(playerGuide, /Coalition Field Notes/);
});

test('toast helpers keep live-region metadata and role semantics', () => {
  assert.equal(GAME_A11Y_LABELS.liveUpdates, 'Live game updates');
  assert.equal(getToastRole('success'), 'status');
  assert.equal(getToastRole('error'), 'alert');
});
