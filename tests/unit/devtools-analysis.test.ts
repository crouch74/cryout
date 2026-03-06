import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, type StartGameCommand } from '../../src/engine/index.ts';
import {
  buildReplayTimeline,
  inspectActionLegality,
  lintNarrativeContent,
  runProbabilitySandbox,
} from '../../src/devtools/analysis.ts';

const baseStartCommand: StartGameCommand = {
  type: 'StartGame',
  rulesetId: 'stones_cry_out',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
  secretMandates: 'disabled',
};

test('replay timeline reconstructs command history and highlights phase changes', () => {
  const content = compileContent(baseStartCommand.rulesetId);
  const state = dispatchCommand(initializeGame(baseStartCommand), { type: 'ResolveSystemPhase' }, content);

  const timeline = buildReplayTimeline(state, content);

  assert.equal(timeline.length, state.commandLog.length);
  assert.equal(timeline[1]?.label, 'Resolve System');
  assert.equal(timeline[1]?.changes.some((entry) => entry.label === 'Phase' && entry.after === 'COALITION'), true);
});

test('action legality explorer exposes projected launch campaign math', () => {
  const content = compileContent(baseStartCommand.rulesetId);
  const state = initializeGame(baseStartCommand);
  state.phase = 'COALITION';

  const report = inspectActionLegality(state, content, 0, {
    actionId: 'launch_campaign',
    regionId: 'Congo',
    domainId: 'DyingPlanet',
    comradesCommitted: 2,
    evidenceCommitted: 1,
    targetSeat: undefined,
    cardId: undefined,
  });

  assert.equal(report.legal, true);
  assert.equal(report.projectedCampaignTarget, 8);
  assert.equal(report.modifiers.some((modifier) => modifier.label === 'Committed Comrades'), true);
});

test('narrative lint flags savior framing and canonical terminology drift', () => {
  const content = compileContent(baseStartCommand.rulesetId);
  const mutated = structuredClone(content);
  mutated.ruleset.description = 'A hero arrives to save the third world.';
  mutated.ruleset.actions[0].description = 'Track the Northern War Machine while we civilize the frontier.';

  const findings = lintNarrativeContent(mutated);

  assert.equal(findings.some((finding) => finding.detail.includes('savior framing')), true);
  assert.equal(findings.some((finding) => finding.detail.includes('Prefer the canonical track name War Machine')), true);
});

test('probability sandbox returns aggregate outcome counts for seeded simulations', () => {
  const state = initializeGame(baseStartCommand);
  const report = runProbabilitySandbox(state, 3);

  assert.equal(report.simulations, 3);
  assert.equal(report.wins + report.losses, 3);
  assert.equal(report.topOutcomes.length > 0, true);
});
