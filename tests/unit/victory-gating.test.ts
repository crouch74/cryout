import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, type EngineCommand } from '../../src/engine/index.ts';
import { applyScenarioPatch } from '../../src/simulation/experiments/applyScenarioPatch.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  secretMandates: 'disabled',
  seed: 4242,
};

test('round gate blocks turn-1 public victory checks until minimum round', () => {
  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_gate_round',
    scenarioId: 'base_design',
    patch: {
      victoryGate: {
        minRoundBeforeVictory: 3,
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const initial = initializeGame({ ...startCommand, rulesetId: mounted.treatmentScenarioId });
    for (const region of Object.values(initial.regions)) {
      region.extractionTokens = 0;
    }
    initial.phase = 'RESOLUTION';
    initial.round = 1;

    const blocked = dispatchCommand(initial, { type: 'ResolveResolutionPhase' }, content);
    assert.notEqual(blocked.phase, 'WIN');
    assert.equal(blocked.victoryProgress?.victoryPredicateSatisfiedBeforeAllowedRound, true);

    blocked.phase = 'RESOLUTION';
    blocked.round = 3;
    const allowed = dispatchCommand(blocked, { type: 'ResolveResolutionPhase' }, content);
    assert.equal(allowed.phase, 'WIN');
  } finally {
    mounted.unregister();
  }
});

test('action gate only evaluates victory when the required action resolves', () => {
  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_gate_action',
    scenarioId: 'base_design',
    patch: {
      victoryGate: {
        requiredAction: {
          actionId: 'organize',
        },
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const state = initializeGame({ ...startCommand, rulesetId: mounted.treatmentScenarioId });
    for (const region of Object.values(state.regions)) {
      region.extractionTokens = 0;
    }
    state.phase = 'COALITION';
    state.round = 3;

    for (const player of state.players) {
      player.actionsRemaining = 0;
      player.ready = true;
      player.queuedIntents = [];
    }

    state.players[0].actionsRemaining = 0;
    state.players[0].ready = true;
    state.players[0].queuedIntents = [{ actionId: 'organize', regionId: 'Congo', slot: 0 }];

    const withRequiredAction = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
    assert.equal(withRequiredAction.phase, 'WIN');
  } finally {
    mounted.unregister();
  }
});

test('progress gate requires minimum extraction removal before victory can trigger', () => {
  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_gate_progress',
    scenarioId: 'base_design',
    patch: {
      victoryGate: {
        requiredProgress: {
          extractionRemoved: 3,
        },
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const state = initializeGame({ ...startCommand, rulesetId: mounted.treatmentScenarioId });
    for (const region of Object.values(state.regions)) {
      region.extractionTokens = 0;
    }
    state.phase = 'RESOLUTION';
    state.round = 3;
    state.victoryProgress = {
      extractionRemoved: 2,
      actionsById: {},
      lastResolvedActionId: null,
      victoryPredicateSatisfiedBeforeAllowedRound: false,
    };

    const blocked = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
    assert.notEqual(blocked.phase, 'WIN');

    blocked.phase = 'RESOLUTION';
    blocked.victoryProgress.extractionRemoved = 3;
    const allowed = dispatchCommand(blocked, { type: 'ResolveResolutionPhase' }, content);
    assert.equal(allowed.phase, 'WIN');
  } finally {
    mounted.unregister();
  }
});

test('score mode still waits for required extraction progress gate', () => {
  const tahrirStartCommand: typeof startCommand = {
    ...startCommand,
    rulesetId: 'tahrir_square',
    seatFactionIds: ['april_6_youth', 'labor_movement', 'independent_journalists', 'rights_defenders'],
  };

  const mounted = applyScenarioPatch({
    experimentId: 'unit_victory_gate_progress_score',
    scenarioId: 'tahrir_square',
    patch: {
      victoryScoring: {
        mode: 'score',
        threshold: 70,
        publicVictoryWeight: 45,
        mandatesWeight: 55,
      },
      victoryGate: {
        requiredProgress: {
          extractionRemoved: 3,
        },
      },
    },
  });

  try {
    const content = compileContent(mounted.treatmentScenarioId);
    const state = initializeGame({ ...tahrirStartCommand, rulesetId: mounted.treatmentScenarioId });
    for (const region of Object.values(state.regions)) {
      region.extractionTokens = 0;
    }
    for (const player of state.players) {
      player.mandateSatisfied = true;
    }
    state.phase = 'RESOLUTION';
    state.round = 3;
    state.victoryProgress = {
      extractionRemoved: 2,
      actionsById: {},
      lastResolvedActionId: null,
      victoryPredicateSatisfiedBeforeAllowedRound: false,
    };

    const blocked = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);
    assert.notEqual(blocked.phase, 'WIN');

    blocked.phase = 'RESOLUTION';
    blocked.victoryProgress.extractionRemoved = 3;
    const allowed = dispatchCommand(blocked, { type: 'ResolveResolutionPhase' }, content);
    assert.equal(allowed.phase, 'WIN');
  } finally {
    mounted.unregister();
  }
});
