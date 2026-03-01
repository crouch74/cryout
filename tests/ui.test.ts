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
import {
  getActionDockItems,
  buildIntentPreview,
  getFrontTrackRows,
  GAME_A11Y_LABELS,
  getActiveCoalitionSeat,
  getPhasePresentation,
  getPhaseProgressSteps,
  getPlayerStripSummary,
  getRegionDangerState,
  getStatusRibbonItems,
  getToastRole,
  getTrackPresentation,
} from '../src/mvp/gameUiHelpers.ts';
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
  assert.equal(steps[1]?.verb, 'Organizes');
});

test('phase and preview helpers expose calibrated presentation copy', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';
  const phase = getPhasePresentation('COALITION');
  const tracks = getTrackPresentation(state);
  const ribbon = getStatusRibbonItems(state, content);
  const fronts = getFrontTrackRows(state, content);
  const dock = getActionDockItems(state, content, 0);
  const strip = getPlayerStripSummary(state.players[0], content, state);
  const preview = buildIntentPreview(
    { actionId: 'launch_campaign', regionId: 'Congo', domainId: 'WarMachine', bodiesCommitted: 2, evidenceCommitted: 1 },
    content.actions.launch_campaign,
    state,
    content,
    0,
  );

  assert.equal(phase.verb, 'Organizes');
  assert.equal(tracks.globalGaze.max, 20);
  assert.equal(tracks.northernWarMachine.max, 12);
  assert.equal(ribbon.some((item) => item.id === 'globalGaze'), true);
  assert.equal(fronts.length, 7);
  assert.equal(dock.some((item) => item.actionId === 'organize'), true);
  assert.match(strip.mandateTitle, /Forest|Siege|River|Sacrifice/i);
  assert.equal(preview.some((chip) => chip.tone === 'risk'), true);
  assert.equal(preview.some((chip) => chip.tone === 'benefit'), true);
});

test('region danger states escalate by extraction thresholds', () => {
  assert.equal(getRegionDangerState(2).tone, 'safe');
  assert.equal(getRegionDangerState(4).tone, 'strained');
  assert.equal(getRegionDangerState(5).pulsing, true);
  assert.equal(getRegionDangerState(6).tone, 'breach');
});

test('active coalition seat advances to the first seat that still has work', () => {
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';

  assert.equal(getActiveCoalitionSeat(state.players), 0);
  state.players[0].ready = true;
  state.players[0].actionsRemaining = 0;
  assert.equal(getActiveCoalitionSeat(state.players), 1);
});

test('game screen source keeps the compressed board layout contract', () => {
  const source = readFileSync(new URL('../src/mvp/GameScreen.tsx', import.meta.url), 'utf8');

  assert.match(source, /<header/);
  assert.match(source, /<main/);
  assert.match(source, /<aside/);
  assert.match(source, /StatusRibbon/);
  assert.match(source, /ActionDock/);
  assert.match(source, /ContextPanel/);
  assert.match(source, /FrontTrackBar/);
  assert.match(source, /Commit Prepared Moves/);
  assert.match(source, /QueueIntent/);
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
