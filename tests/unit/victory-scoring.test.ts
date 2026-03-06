import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand } from '../../src/engine/index.ts';
import { applyScenarioPatch } from '../../src/simulation/experiments/applyScenarioPatch.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'stones_cry_out',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  secretMandates: 'enabled',
  seed: 2026,
};

const tahrirStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  ...startCommand,
  rulesetId: 'tahrir_square',
  seatFactionIds: ['april_6_youth', 'labor_movement', 'independent_journalists', 'rights_defenders'],
};

test('binary scenarios preserve mandate-failure defeat behavior', () => {
  const content = compileContent('stones_cry_out');
  const state = initializeGame(startCommand);
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 0;
  }
  state.round = 3;
  state.phase = 'RESOLUTION';
  for (const player of state.players) {
    player.mandateSatisfied = false;
  }

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
  assert.equal(next.phase, 'LOSS');
  assert.equal(next.terminalOutcome?.cause, 'mandate_failure');
});

test('score mode awards victory when threshold is met', () => {
  const content = compileContent('tahrir_square');
  const state = initializeGame(tahrirStartCommand);

  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 0;
  }
  state.round = 3;
  state.phase = 'RESOLUTION';
  for (const player of state.players) {
    player.mandateSatisfied = true;
  }

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
  assert.equal(next.phase, 'WIN');
  assert.equal(next.terminalOutcome?.victoryScore, 100);
  assert.equal(next.terminalOutcome?.victoryThreshold, 45);
});

test('score cap prevents success when catastrophic condition is active', () => {
  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_cap_enforced',
    scenarioId: 'tahrir_square',
    patch: {
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 30,
        mandatesWeight: 70,
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const state = initializeGame({
      ...tahrirStartCommand,
      rulesetId: mounted.treatmentScenarioId,
    });

    for (const region of Object.values(state.regions)) {
      region.extractionTokens = 0;
    }
    for (const region of Object.values(state.regions)) {
      region.comradesPresent[0] = 0;
    }
    state.regions.Cairo.comradesPresent[0] = 1;
    state.round = 3;
    state.phase = 'RESOLUTION';
    for (const player of state.players) {
      player.mandateSatisfied = true;
    }

    const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
    assert.notEqual(next.phase, 'WIN');
    assert.equal(next.victoryProgress?.lastVictoryScore, 69);
    assert.equal(next.victoryProgress?.lastVictoryThreshold, 70);
  } finally {
    mounted.unregister();
  }
});

test('score mode still respects victory gate minimum round', () => {
  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_score_gate',
    scenarioId: 'tahrir_square',
    patch: {
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
      },
      victoryGate: {
        minRoundBeforeVictory: 4,
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const state = initializeGame({
      ...tahrirStartCommand,
      rulesetId: mounted.treatmentScenarioId,
    });

    for (const region of Object.values(state.regions)) {
      region.extractionTokens = 0;
    }
    for (const player of state.players) {
      player.mandateSatisfied = true;
    }
    state.round = 3;
    state.phase = 'RESOLUTION';

    const blocked = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
    assert.notEqual(blocked.phase, 'WIN');
    assert.equal(blocked.victoryProgress?.victoryPredicateSatisfiedBeforeAllowedRound, true);
  } finally {
    mounted.unregister();
  }
});
