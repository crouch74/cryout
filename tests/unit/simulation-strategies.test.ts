import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, initializeGame, type StartGameCommand } from '../../src/engine/index.ts';
import { buildStrategyCandidatesForSeat, listStrategyProfiles } from '../../src/simulation/strategies.ts';

const startCommand: StartGameCommand = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
  secretMandates: 'enabled',
};

function intentKey(intent: {
  actionId: string;
  regionId?: string;
  domainId?: string;
  targetSeat?: number;
  comradesCommitted?: number;
  evidenceCommitted?: number;
  cardId?: string;
}) {
  return JSON.stringify([
    intent.actionId,
    intent.regionId ?? null,
    intent.domainId ?? null,
    intent.targetSeat ?? null,
    intent.comradesCommitted ?? null,
    intent.evidenceCommitted ?? null,
    intent.cardId ?? null,
  ]);
}

function createCoalitionSnapshot() {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'COALITION';

  state.players.forEach((player, seat) => {
    player.actionsRemaining = seat === 0 ? 1 : 0;
    player.ready = seat !== 0;
    player.evidence = 2;
  });

  state.regions.Congo.comradesPresent[0] = 5;
  state.regions.Congo.extractionTokens = 5;
  state.globalGaze = 8;
  state.northernWarMachine = 6;

  return { state, content };
}

test('every strategy profile chooses a legal deterministic action for a seat', () => {
  const { state, content } = createCoalitionSnapshot();
  const candidates = buildStrategyCandidatesForSeat(state, content, 0);

  assert.equal(candidates.length > 0, true);

  const candidateKeys = new Set(candidates.map((candidate) => intentKey(candidate.action)));

  for (const profile of listStrategyProfiles()) {
    const first = profile.chooseAction({
      strategyId: profile.id,
      state,
      content,
      seat: 0,
      candidates,
    });
    const second = profile.chooseAction({
      strategyId: profile.id,
      state,
      content,
      seat: 0,
      candidates,
    });

    assert.notEqual(first, null);
    assert.notEqual(second, null);
    assert.equal(intentKey(first!.action), intentKey(second!.action));
    assert.equal(candidateKeys.has(intentKey(first!.action)), true);
  }
});

test('random strategy remains seeded-deterministic for unchanged state', () => {
  const { state, content } = createCoalitionSnapshot();
  const candidates = buildStrategyCandidatesForSeat(state, content, 0);
  const randomProfile = listStrategyProfiles().find((profile) => profile.id === 'random');

  assert.notEqual(randomProfile, undefined);

  const first = randomProfile!.chooseAction({
    strategyId: 'random',
    state,
    content,
    seat: 0,
    candidates,
  });

  const second = randomProfile!.chooseAction({
    strategyId: 'random',
    state,
    content,
    seat: 0,
    candidates,
  });

  assert.notEqual(first, null);
  assert.equal(intentKey(first!.action), intentKey(second!.action));
});
