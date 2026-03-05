import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileContent,
  initializeGame,
  type CompiledContent,
  type StartGameCommand,
} from '../../src/engine/index.ts';
import {
  buildAutoPlayCandidates,
  getAutoPlaySelectionPreview,
  listAutoPlayIntentsForSeat,
  selectAutoPlayDecision,
} from '../../src/devtools/autoPlaySelector.ts';

const baseStartCommand: StartGameCommand = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
  secretMandates: 'disabled',
};

const tahrirStartCommand: StartGameCommand = {
  type: 'StartGame',
  rulesetId: 'tahrir_square',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['april_6_youth', 'labor_movement', 'independent_journalists', 'rights_defenders'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 7171,
  secretMandates: 'disabled',
};

function makeCoalitionState(command: StartGameCommand) {
  const content = compileContent(command.rulesetId);
  const state = initializeGame(command);
  state.phase = 'COALITION';
  state.players.forEach((player) => {
    player.actionsRemaining = 0;
    player.ready = false;
    player.evidence = 0;
    player.resistanceHand = [];
  });
  for (const region of Object.values(state.regions)) {
    region.defenseRating = 0;
    region.extractionTokens = 0;
    region.comradesPresent = Object.fromEntries(state.players.map((player) => [player.seat, 0]));
  }
  return { state, content };
}

function cloneContent(content: CompiledContent): CompiledContent {
  return structuredClone(content);
}

test('chooses a higher-scoring coalition action instead of the first legal action', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.players[1].actionsRemaining = 1;

  state.regions.Congo.comradesPresent[0] = 1;
  state.regions.Levant.comradesPresent[1] = 5;
  state.regions.Levant.extractionTokens = 5;
  state.players[1].evidence = 2;
  state.players[1].resistanceHand = ['sup_arms_manifest'];
  state.globalGaze = 10;
  state.northernWarMachine = 4;

  const selection = selectAutoPlayDecision(state, content);

  assert.equal(selection?.command.type, 'QueueIntent');
  assert.equal(selection?.command.seat, 1);
  assert.equal(selection?.command.action.actionId, 'launch_campaign');
  assert.equal(selection?.command.action.regionId, 'Levant');
  assert.equal(selection?.command.action.domainId, 'WarMachine');
});

test('prefers launch campaign over organize when campaign odds and extraction pressure are strong', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.regions.Congo.comradesPresent[0] = 6;
  state.regions.Congo.extractionTokens = 5;
  state.players[0].evidence = 2;
  state.players[0].resistanceHand = ['sup_watershed_maps'];
  state.globalGaze = 10;
  state.northernWarMachine = 4;

  const selection = selectAutoPlayDecision(state, content);

  assert.equal(selection?.command.type, 'QueueIntent');
  assert.equal(selection?.command.seat, 0);
  assert.equal(selection?.command.action.actionId, 'launch_campaign');
  assert.equal(selection?.command.action.regionId, 'Congo');
  assert.equal(selection?.command.action.domainId, 'DyingPlanet');
});

test('prefers investigate when a seat is starved for evidence and cannot mount a strong campaign', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.regions.Congo.comradesPresent[0] = 0;
  state.regions.Congo.extractionTokens = 1;
  state.players[0].evidence = 0;

  const selection = selectAutoPlayDecision(state, content);

  assert.equal(selection?.command.type, 'QueueIntent');
  assert.equal(selection?.command.seat, 0);
  assert.equal(selection?.command.action.actionId, 'investigate');
  assert.equal(selection?.command.action.regionId, 'Congo');
});

test('smuggle evidence does not outrank stronger local movement plays by default', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.players[1].actionsRemaining = 1;
  state.regions.Sahel.comradesPresent[0] = 1;
  state.players[0].evidence = 1;
  state.regions.Levant.comradesPresent[1] = 1;
  state.players[1].evidence = 0;

  const selection = selectAutoPlayDecision(state, content);

  assert.equal(selection?.command.type, 'QueueIntent');
  assert.notEqual(selection?.command.action.actionId, 'smuggle_evidence');
  assert.equal(selection?.command.action.actionId, 'investigate');
});

test('keeps defend low priority unless the board is under heavy pressure', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.regions.Andes.comradesPresent[0] = 1;
  state.regions.Andes.extractionTokens = 1;
  state.northernWarMachine = 3;

  const selection = selectAutoPlayDecision(state, content);

  assert.equal(selection?.command.type, 'QueueIntent');
  assert.notEqual(selection?.command.action.actionId, 'defend');
  assert.equal(selection?.command.action.actionId, 'investigate');
});

test('scenario-specific actions are enumerated in shipped non-base scenarios', () => {
  const { state, content } = makeCoalitionState(tahrirStartCommand);

  state.players[0].actionsRemaining = 1;
  state.players[0].evidence = 2;
  state.regions.Cairo.comradesPresent[0] = 0;
  state.northernWarMachine = 9;
  state.globalGaze = 12;

  const candidates = buildAutoPlayCandidates(state, content);

  assert.equal(candidates.some((candidate) => candidate.action.actionId === 'expose_regime_lies'), true);
  assert.equal(candidates.some((candidate) => candidate.action.actionId === 'go_viral'), true);
});

test('seeded tie-breaking is deterministic and does not mutate rng state', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.regions.Congo.comradesPresent[0] = 1;
  state.regions.Levant.comradesPresent[0] = 1;
  state.regions.Congo.extractionTokens = 3;
  state.regions.Levant.extractionTokens = 3;
  state.globalGaze = 5;
  const rngBefore = structuredClone(state.rng);

  const first = selectAutoPlayDecision(state, content);
  const second = selectAutoPlayDecision(state, content);

  assert.deepEqual(first, second);
  assert.deepEqual(state.rng, rngBefore);
});

test('returns null when no legal coalition intent exists for active seats', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);
  const noActionContent = cloneContent(content);

  state.players[0].actionsRemaining = 1;
  noActionContent.actions = {
    play_card: noActionContent.actions.play_card,
  };

  const selection = selectAutoPlayDecision(state, noActionContent);

  assert.equal(selection, null);
});

test('non-coalition phases keep their existing command flow', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.phase = 'SYSTEM';
  assert.deepEqual(selectAutoPlayDecision(state, content), {
    command: { type: 'ResolveSystemPhase' },
  });

  state.phase = 'RESOLUTION';
  assert.deepEqual(selectAutoPlayDecision(state, content), {
    command: { type: 'ResolveResolutionPhase' },
  });

  state.phase = 'COALITION';
  state.players.forEach((player) => {
    player.actionsRemaining = 0;
    player.ready = true;
  });
  assert.deepEqual(selectAutoPlayDecision(state, content), {
    command: { type: 'CommitCoalitionIntent' },
  });
});

test('enumerates legal intents for a seat including support-backed campaigns', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.players[0].evidence = 2;
  state.players[0].resistanceHand = ['sup_watershed_maps'];
  state.regions.Congo.comradesPresent[0] = 4;
  state.regions.Congo.extractionTokens = 4;

  const intents = listAutoPlayIntentsForSeat(state, content, 0);
  const campaigns = intents.filter((intent) => intent.actionId === 'launch_campaign' && intent.regionId === 'Congo');
  const candidates = buildAutoPlayCandidates(state, content).filter((candidate) => candidate.seat === 0);

  assert.equal(campaigns.some((intent) => intent.cardId === 'sup_watershed_maps' && intent.domainId === 'DyingPlanet'), true);
  assert.equal(candidates.some((candidate) => candidate.action.actionId === 'launch_campaign'), true);
});

test('builds a readable preview for queued autoplay actions', () => {
  const { state, content } = makeCoalitionState(baseStartCommand);

  state.players[0].actionsRemaining = 1;
  state.regions.Congo.comradesPresent[0] = 6;
  state.regions.Congo.extractionTokens = 5;
  state.players[0].evidence = 2;
  state.players[0].resistanceHand = ['sup_watershed_maps'];
  state.globalGaze = 10;
  state.northernWarMachine = 4;

  const selection = selectAutoPlayDecision(state, content);
  const preview = selection ? getAutoPlaySelectionPreview(state, content, selection) : null;

  assert.equal(Boolean(preview), true);
  assert.match(preview?.title ?? '', /autoplay/i);
  assert.match(preview?.message ?? '', /Congo Basin/i);
});
