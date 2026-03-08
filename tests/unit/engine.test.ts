import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, listRulesets, toCompatStructuredEvent, type EngineCommand } from '../../src/engine/index.ts';
import type { DomainEvent, EngineState } from '../../src/engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'stones_cry_out',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
};

const multiOwnerStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'stones_cry_out',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 4242,
};

const localStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  ...multiOwnerStartCommand,
  secretMandates: 'disabled',
};

const tahrirStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'tahrir_square',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['april_6_youth', 'labor_movement', 'independent_journalists', 'rights_defenders'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
};

const womanLifeFreedomStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'woman_life_freedom',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['kurdish_women', 'student_union', 'bazaar_strikers', 'male_allies'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
};

const algeriaStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'algerian_war_of_independence',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['fln_urban_cells', 'kabyle_maquis', 'rural_organizing_committees', 'border_solidarity_networks'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
};

const corridorsBurnStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'when_the_corridors_burn',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: [
    'palestinian_sumud_committees',
    'gaza_west_bank_witness_medics',
    'venezuelan_communal_councils',
    'cuban_cdr_neighborhood_defense',
    'corridor_workers_refuge_networks',
  ],
  seatOwnerIds: [0, 1, 2, 3, 0],
  seed: 20260307,
};

function getStartupWithdrawalEvents(state: EngineState) {
  return state.eventLog.filter((event) => event.context?.cardReveals?.[0]?.origin === 'startup_withdrawal');
}

function findStartupWithdrawal(
  command: Extract<EngineCommand, { type: 'StartGame' }>,
  matcher: (event: DomainEvent, state: EngineState) => boolean,
  maxSeed = 5000,
) {
  for (let seed = 1; seed <= maxSeed; seed += 1) {
    const state = initializeGame({ ...command, seed });
    const event = getStartupWithdrawalEvents(state).find((entry) => matcher(entry, state));
    if (event) {
      return { seed, state, event };
    }
  }

  throw new Error(`Unable to find startup withdrawal within ${maxSeed} seeds.`);
}

test('canonical ruleset registry exposes the shipped rulesets', () => {
  const rulesets = listRulesets();
  const stonesCryOut = rulesets.find((ruleset) => ruleset.id === 'stones_cry_out');
  const algeria = rulesets.find((ruleset) => ruleset.id === 'algerian_war_of_independence');

  assert.equal(Boolean(stonesCryOut), true);
  assert.equal(Boolean(algeria), true);
  assert.equal(stonesCryOut?.regions.length, 6);
});

test('same seed produces deterministic system deck order', () => {
  const stateA = initializeGame(startCommand);
  const stateB = initializeGame(startCommand);
  const stateC = initializeGame({ ...startCommand, seed: 99 });

  assert.deepEqual(stateA.decks.system.drawPile, stateB.decks.system.drawPile);
  assert.deepEqual(stateA.decks.crisis.drawPile, stateB.decks.crisis.drawPile);
  assert.notDeepEqual(stateA.decks.system.drawPile, stateC.decks.system.drawPile);
});

test('startup resistance withdrawals reveal publicly and move into discard', () => {
  const state = initializeGame(startCommand);
  const revealEvents = getStartupWithdrawalEvents(state);
  const revealOrigins = revealEvents.flatMap((event) => event.context?.cardReveals ?? []).map((reveal) => reveal.origin);

  assert.equal(state.players.every((player) => player.resistanceHand.length === 0), true);
  assert.equal(state.decks.resistance.discardPile.length, state.players.length);
  assert.equal(revealEvents.length >= state.players.length, true);
  assert.equal(revealOrigins.every((origin) => origin === 'startup_withdrawal'), true);
});

test('startup withdrawal applies Archive Leak immediately for the owning seat', () => {
  const { state, event } = findStartupWithdrawal(
    startCommand,
    (entry) => entry.context?.actingSeat === 0 && entry.context?.cardReveals?.[0]?.cardId === 'res_archive_leak',
  );

  assert.equal(event.deltas.some((delta) => delta.kind === 'track' && delta.label === 'globalGaze' && delta.before === 8 && delta.after === 9), true);
  assert.equal(event.deltas.some((delta) => delta.kind === 'evidence' && delta.label === 'seat:0:evidence' && delta.before === 1 && delta.after === 2), true);
  assert.equal(state.globalGaze >= 9, true);
  assert.equal(state.players[0]?.evidence >= 2, true);
  assert.equal(state.decks.resistance.discardPile.includes('res_archive_leak'), true);
  assert.equal(event.context?.cardReveals?.[0]?.origin, 'startup_withdrawal');
});

test('startup withdrawal resolves target-region effects against the owning seat home region', () => {
  const { state, event } = findStartupWithdrawal(
    startCommand,
    (entry) => entry.context?.actingSeat === 0 && entry.context?.cardReveals?.[0]?.cardId === 'res_strike_fund',
  );

  assert.equal(event.context?.targetRegionId, 'Congo');
  assert.equal(event.deltas.some((delta) => delta.kind === 'comrades' && delta.label === 'Congo.seat:0' && delta.before === 4 && delta.after === 8), true);
  assert.equal(state.regions.Congo.comradesPresent[0] >= 8, true);
});

test('startup withdrawal keeps support-only cards as reveal-and-discard only', () => {
  const { state, event } = findStartupWithdrawal(
    startCommand,
    (entry) => entry.context?.actingSeat === 0 && Boolean(entry.context?.cardReveals?.[0]?.cardId?.startsWith('sup_')),
  );

  assert.equal(state.players[0]?.evidence, 1);
  assert.equal(event.deltas.length, 1);
  assert.equal(event.deltas[0]?.kind, 'card');
  assert.equal(state.decks.resistance.discardPile.includes(event.context?.cardReveals?.[0]?.cardId ?? ''), true);
});

test('Tahrir startup withdrawal applies effectful resistance cards during setup', () => {
  const { state, event } = findStartupWithdrawal(
    tahrirStartCommand,
    (entry) => entry.context?.actingSeat === 0 && entry.context?.cardReveals?.[0]?.cardId === 'res_tahrir_al_jazeera_interview',
  );

  assert.equal(event.deltas.some((delta) => delta.kind === 'evidence' && delta.label === 'seat:0:evidence' && delta.before === 1 && delta.after === 4), true);
  assert.equal(event.deltas.some((delta) => delta.kind === 'track' && delta.label === 'globalGaze' && delta.before === 0 && delta.after === 1), true);
  assert.equal(state.players[0]?.evidence >= 4, true);
  assert.equal(state.globalGaze >= 1, true);
  assert.equal(event.context?.targetRegionId, 'Cairo');
});

test('Woman, Life, Freedom startup withdrawal applies effectful resistance cards during setup', () => {
  const { state, event } = findStartupWithdrawal(
    womanLifeFreedomStartCommand,
    (entry) => entry.context?.actingSeat === 0 && entry.context?.cardReveals?.[0]?.cardId === 'res_wlf_cutting_hair_symbol',
  );

  assert.equal(event.deltas.some((delta) => delta.kind === 'track' && delta.label === 'globalGaze' && delta.before === 6 && delta.after === 8), true);
  assert.equal(state.globalGaze >= 8, true);
  assert.equal(event.context?.targetRegionId, 'Kurdistan');
});

test('Algeria startup seeds authored tracks and extraction values', () => {
  const content = compileContent(algeriaStartCommand.rulesetId);
  const state = initializeGame(algeriaStartCommand);

  assert.equal(content.ruleset.setup?.globalGaze, 3);
  assert.equal(content.ruleset.setup?.northernWarMachine, 7);
  assert.equal(state.customTracks.repression_cycle?.value, 3);
  assert.equal(state.regions.Oran.extractionTokens, content.ruleset.setup?.extractionSeeds?.Oran);
  assert.equal(state.regions.Algiers.extractionTokens, content.ruleset.setup?.extractionSeeds?.Algiers);
});

test('startup supports fewer human players than faction seats while keeping all factions active', () => {
  const state = initializeGame(multiOwnerStartCommand);

  assert.equal(state.players.length, 4);
  assert.deepEqual(state.players.map((player) => player.factionId), multiOwnerStartCommand.seatFactionIds);
  assert.deepEqual(state.players.map((player) => player.ownerId), [0, 0, 1, 1]);
});

test('startup can disable secret mandates for local tables', () => {
  const state = initializeGame(localStartCommand);

  assert.equal(state.secretMandatesEnabled, false);
  assert.equal(state.mandatesResolved, true);
  assert.equal(state.players.every((player) => player.mandateId === ''), true);
  assert.equal(state.players.every((player) => player.mandateRevealed), true);
});

test('room play starts with unsatisfied secret mandates', () => {
  const state = initializeGame(startCommand);

  assert.equal(state.secretMandatesEnabled, true);
  assert.equal(state.players.every((player) => player.mandateSatisfied === false), true);
});

test('startup rejects ownership maps that leave a human player without a faction seat', () => {
  assert.throws(
    () => initializeGame({ ...multiOwnerStartCommand, humanPlayerCount: 3, seatOwnerIds: [0, 0, 2, 2] }),
    /owner 1 has no assigned factions/i,
  );
});

test('local victory can clear the score threshold while room play continues without mandate score', () => {
  const content = compileContent(startCommand.rulesetId);
  const localState = initializeGame(localStartCommand);
  const roomState = initializeGame({ ...startCommand, secretMandates: 'enabled' });

  for (const region of Object.values(localState.regions)) {
    region.extractionTokens = 1;
  }
  for (const region of Object.values(roomState.regions)) {
    region.extractionTokens = 1;
  }

  localState.phase = 'RESOLUTION';
  roomState.phase = 'RESOLUTION';
  localState.round = 4;
  roomState.round = 4;
  localState.domains.DyingPlanet.progress = 0;
  roomState.domains.DyingPlanet.progress = 0;
  localState.northernWarMachine = 7;
  roomState.northernWarMachine = 7;

  const localOutcome = dispatchCommand(localState, { type: 'ResolveResolutionPhase' }, content);
  const roomOutcome = dispatchCommand(roomState, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(localOutcome.phase, 'WIN');
  assert.equal(roomOutcome.phase, 'SYSTEM');
  assert.equal(roomOutcome.round, 5);
  assert.equal(roomOutcome.terminalOutcome, null);
});

test('phase gating rejects coalition actions during system phase', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  const next = dispatchCommand(
    state,
    {
      type: 'QueueIntent',
      seat: 0,
      action: { actionId: 'organize', regionId: 'Congo' },
    },
    content,
  );

  assert.equal(next.phase, 'SYSTEM');
  assert.equal(next.players[0].queuedIntents.length, 0);
  assert.equal(next.eventLog.at(-1)?.emoji, '❌');
});

test('Algeria investigate raises Repression Cycle exactly once for a positive Evidence resolution', () => {
  const content = compileContent(algeriaStartCommand.rulesetId);
  let state = initializeGame(algeriaStartCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Algiers' } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  const investigateEvent = next.eventLog.findLast((event) => event.sourceId === 'investigate');
  const repressionDeltas = investigateEvent?.deltas.filter((delta) => delta.label === 'repression_cycle') ?? [];

  assert.equal(next.customTracks.repression_cycle.value, 4);
  assert.equal(repressionDeltas.length, 1);
});

test('Algeria urban campaign success escalates War Machine in Algiers', () => {
  const content = compileContent(algeriaStartCommand.rulesetId);
  let state = initializeGame(algeriaStartCommand);
  state.phase = 'COALITION';
  state.globalGaze = 15;
  state.players[0].evidence = 4;
  state.regions.Algiers.comradesPresent[0] = 8;
  state.regions.Algiers.extractionTokens = 2;
  state.players[0].actionsRemaining = 1;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Algiers', domainId: 'SilencedTruth', comradesCommitted: 4, evidenceCommitted: 2 } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  const campaignEvent = next.eventLog.findLast((event) => event.sourceId === 'launch_campaign');

  assert.equal((campaignEvent?.context?.roll?.success ?? false), true);
  assert.equal(next.northernWarMachine, state.northernWarMachine + 1);
});

test('Algeria repression thresholds apply their authored consequences once', () => {
  const content = compileContent(algeriaStartCommand.rulesetId);
  const state = initializeGame(algeriaStartCommand);
  state.customTracks.repression_cycle.value = 4;
  for (const player of state.players) {
    player.evidence = 1;
  }

  const traces = dispatchCommand(
    {
      ...state,
      phase: 'COALITION',
      players: state.players.map((player, index) => ({
        ...player,
        actionsRemaining: index === 0 ? 1 : 0,
        ready: index !== 0,
      })),
    },
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Algiers' } },
    content,
  );
  traces.players[0].actionsRemaining = 0;
  traces.players[0].ready = true;

  const resolved = dispatchCommand(traces, { type: 'CommitCoalitionIntent' }, content);
  const thresholdEvent = resolved.eventLog.find((event) => event.sourceId === 'threshold_repression_cycle_5');

  assert.equal(Boolean(thresholdEvent), true);
  assert.equal(resolved.players.slice(1).every((player) => player.evidence === 0), true);

  resolved.phase = 'COALITION';
  resolved.players[0].actionsRemaining = 1;
  resolved.players[0].ready = false;
  const queuedAgain = dispatchCommand(
    resolved,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Algiers' } },
    content,
  );
  queuedAgain.players[0].actionsRemaining = 0;
  queuedAgain.players[0].ready = true;
  for (const player of queuedAgain.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }
  const resolvedAgain = dispatchCommand(queuedAgain, { type: 'CommitCoalitionIntent' }, content);

  assert.equal(resolvedAgain.eventLog.filter((event) => event.sourceId === 'threshold_repression_cycle_5').length, 1);
});

test('Algeria symbolic beacons and tribunal acknowledgement can produce symbolic victory', () => {
  const content = compileContent('algerian_war_of_independence');
  const state = initializeGame({ ...algeriaStartCommand, mode: 'SYMBOLIC' });
  state.phase = 'RESOLUTION';
  state.round = 4;
  for (const player of state.players) {
    player.mandateSatisfied = true;
  }
  state.globalGaze = 15;
  state.domains.RevolutionaryWave.progress = 6;
  state.domains.GildedCage.progress = 4;
  state.regions.Algiers.extractionTokens = 2;
  state.regions.KabylieMountains.extractionTokens = 1;
  state.regions.SaharaSouth.extractionTokens = 2;
  state.regions.FrenchMetropoleInfluence.extractionTokens = 2;
  state.scenarioFlags.tortureExposed = true;
  state.scenarioFlags.tribunalAcknowledged = true;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'WIN');
  assert.equal(next.terminalOutcome?.cause, 'symbolic');
});

test('Algeria liberation victory requires repression to remain at 6 or lower', () => {
  const content = compileContent('algerian_war_of_independence');
  const state = initializeGame(algeriaStartCommand);
  state.phase = 'RESOLUTION';
  state.round = 4;
  for (const player of state.players) {
    player.mandateSatisfied = true;
  }
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 5;
  }
  state.customTracks.repression_cycle.value = 6;
  state.globalGaze = 12;
  state.domains.RevolutionaryWave.progress = 6;
  state.domains.GildedCage.progress = 4;
  state.regions.KabylieMountains.extractionTokens = 1;
  state.regions.SaharaSouth.extractionTokens = 2;
  state.regions.FrenchMetropoleInfluence.extractionTokens = 2;
  state.regions.Algiers.extractionTokens = 2;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'WIN');
  assert.equal(next.terminalOutcome?.cause, 'liberation');
});

test('when_the_corridors_burn aggregated gulf posture fires both authored threshold bundles', () => {
  const content = compileContent(corridorsBurnStartCommand.rulesetId);
  let state = initializeGame(corridorsBurnStartCommand);

  state.phase = 'COALITION';
  state.players[0].actionsRemaining = 1;
  state.players[0].resistanceHand = ['res_corr_street_to_strait_coordination'];
  state.regions.GulfHormuzCorridor.extractionTokens = 2;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'play_card', regionId: 'RedSeaSuezCorridor', cardId: 'res_corr_street_to_strait_coordination' } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);

  assert.equal(next.customTracks.gulf_posture?.value, 2);
  assert.equal(next.regions.GulfHormuzCorridor.extractionTokens, 1);
  assert.equal(next.domains.EmptyStomach.progress, state.domains.EmptyStomach.progress + 1);
  assert.equal(next.domains.FossilGrip.progress, state.domains.FossilGrip.progress + 1);
  assert.equal(next.globalGaze, state.globalGaze + 1);
  assert.equal(next.eventLog.some((event) => event.sourceId === 'threshold_gulf_posture_1'), true);
  assert.equal(next.eventLog.some((event) => event.sourceId === 'threshold_gulf_posture_2'), true);
});

test('symbolic mode reveals exactly three active beacons', () => {
  const state = initializeGame({ ...startCommand, mode: 'SYMBOLIC' });
  assert.equal(state.activeBeaconIds.length, 3);
  assert.equal(state.activeBeaconIds.every((beaconId) => state.beacons[beaconId]?.active), true);
});

test('system escalation cards enter the active tray and target authored vulnerability', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.decks.crisis.drawPile = [];
  state.decks.system.drawPile = ['sys_emergency_powers'];
  state.northernWarMachine = 6; // Force war_machine_threshold trigger

  const next = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  const cardEvent = next.eventLog.findLast((event) => event.sourceId === 'sys_emergency_powers');

  assert.equal(next.regions.Levant.extractionTokens, state.regions.Levant.extractionTokens + 1);
  assert.equal(next.phase, 'COALITION');
  assert.deepEqual(next.activeSystemCardIds, ['sys_emergency_powers']);
  assert.equal(cardEvent?.context?.cardReveals?.[0]?.deckId, 'system');
  assert.equal(cardEvent?.context?.cardReveals?.[0]?.destination, 'active');
});

test('any region reaching six extraction tokens causes immediate defeat', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.regions.Levant.extractionTokens = 5;
  state.decks.crisis.drawPile = [];
  state.decks.system.drawPile = ['sys_emergency_powers'];

  const next = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.match(next.lossReason ?? '', /Levant/);
  assert.equal(next.terminalOutcome?.cause, 'extraction_breach');
  assert.equal(next.terminalOutcome?.breachedRegionId, 'Levant');
});

test('liberation victory requires the public win and all active mandates', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  state.round = 4;
  for (const player of state.players) {
    player.mandateSatisfied = true;
  }
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 1;
  }
  state.northernWarMachine = 5;
  state.domains.DyingPlanet.progress = 2;
  state.domains.WarMachine.progress = 5;
  state.domains.SilencedTruth.progress = 5;
  state.domains.FossilGrip.progress = 5;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'WIN');
  assert.match(next.winner ?? '', /Liberation/);
  assert.equal(next.terminalOutcome?.cause, 'liberation');
});

test('unsatisfied mandates keep a public liberation state below the score threshold', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  state.round = 3;
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 1;
  }
  state.northernWarMachine = 7;
  state.domains.DyingPlanet.progress = 0;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'SYSTEM');
  assert.equal(next.round, 4);
  assert.equal(next.lossReason, null);
  assert.equal(next.terminalOutcome, null);
});

test('secret mandates lock only from coalition action resolution and stay latched', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state.northernWarMachine = 6;
  state.regions.Levant.extractionTokens = 1;
  state.decks.crisis.drawPile = [];
  state.decks.system.drawPile = [];

  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  assert.equal(state.players[1].mandateSatisfied, false);

  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'organize', regionId: 'Congo' } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  state = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  assert.equal(state.players[1].mandateSatisfied, true);
  assert.equal(state.eventLog.some((event) => event.sourceType === 'mandate' && event.sourceId === 'mandate_satisfied'), true);

  state.phase = 'COALITION';
  state.northernWarMachine = 7;
  state.players[0].actionsRemaining = 2;
  state.players[0].ready = false;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Congo' } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  assert.equal(next.players[1].mandateSatisfied, true);
});

test('sudden death writes a terminal defeat summary', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(localStartCommand);
  state.phase = 'RESOLUTION';
  state.round = content.ruleset.suddenDeathRound;
  state.regions.Congo.extractionTokens = 3;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.equal(next.terminalOutcome?.cause, 'sudden_death');
  assert.match(next.lossReason ?? '', new RegExp(String(content.ruleset.suddenDeathRound)));
});

test('coalition comrades exhaustion is checked during resolution', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.round = 4;
  for (const region of Object.values(state.regions)) {
    for (const player of state.players) {
      region.comradesPresent[player.seat] = 0;
    }
  }
  state.regions.Congo.comradesPresent[0] = 1;

  const next = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'defend', regionId: 'Congo', comradesCommitted: 1 } },
    content,
  );

  const committed = {
    ...next,
    players: next.players.map((player, index) => ({
      ...player,
      actionsRemaining: 0,
      ready: true,
      queuedIntents: index === 0 ? player.queuedIntents : [],
    })),
  };

  const resolved = dispatchCommand(committed, { type: 'CommitCoalitionIntent' }, content);
  assert.equal(resolved.phase, 'RESOLUTION');
  assert.equal(resolved.terminalOutcome, null);

  const postResolution = dispatchCommand(resolved, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(postResolution.phase, 'LOSS');
  assert.equal(postResolution.terminalOutcome?.cause, 'comrades_exhausted');
  assert.equal(postResolution.terminalOutcome?.exhaustedSeat, undefined);
  assert.match(postResolution.lossReason ?? '', /0 Comrades/);
});

test('launch campaign consumes 2d6 of rng and can remove extraction on success', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.players[0].actionsRemaining = 1;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Congo', domainId: 'DyingPlanet', comradesCommitted: 2, evidenceCommitted: 1 } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }
  const rngCallsBefore = state.rng.calls;

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  const campaignEvent = next.eventLog.findLast((event) => event.sourceId === 'launch_campaign');

  assert.equal(next.rng.calls, rngCallsBefore + 2);
  assert.equal(next.phase, 'RESOLUTION');
  assert.equal(next.regions.Congo.extractionTokens <= state.regions.Congo.extractionTokens, true);
  assert.equal(campaignEvent?.context?.targetRegionId, 'Congo');
  assert.equal(campaignEvent?.context?.targetDomainId, 'DyingPlanet');
  assert.deepEqual(campaignEvent?.context?.roll?.dice.length, 2);
  assert.equal(campaignEvent?.context?.roll?.actionId, 'launch_campaign');
  assert.equal(campaignEvent?.context?.roll?.regionId, 'Congo');
  assert.equal(campaignEvent?.context?.roll?.target, 8);
  assert.equal(typeof campaignEvent?.context?.roll?.outcomeBand, 'string');

  const structured = campaignEvent ? toCompatStructuredEvent(campaignEvent) : null;
  assert.equal(structured?.type, 'ui.action.CAMPAIGN_RESOLVED');
  assert.deepEqual(structured?.payload.dice, campaignEvent?.context?.roll?.dice);
  assert.equal(structured?.payload.regionId, 'Congo');
  assert.equal(structured?.payload.domainId, 'DyingPlanet');
  assert.equal(structured?.payload.diceKind, '2d6');
});

test('investigate reveal events carry investigate origin', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'investigate', regionId: 'Congo' } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  const investigateEvent = next.eventLog.findLast((event) => event.context?.cardReveals?.[0]?.origin === 'investigate');

  assert.equal(investigateEvent?.context?.cardReveals?.[0]?.origin, 'investigate');
});

function runCampaignForBand(seed: number, domainId: 'DyingPlanet' | 'WarMachine') {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame({ ...startCommand, seed });
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.players[0].actionsRemaining = 1;
  for (const player of state.players.slice(1)) {
    player.actionsRemaining = 0;
    player.ready = true;
  }
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Congo', domainId, comradesCommitted: 1, evidenceCommitted: 0 } },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;

  const next = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  const campaignEvent = next.eventLog.findLast((event) => event.sourceId === 'launch_campaign');
  return campaignEvent?.context?.roll ?? null;
}

test('launch campaign roll payload exposes canonical outcome semantics', () => {
  const seen = new Map<string, NonNullable<ReturnType<typeof runCampaignForBand>>>();

  for (let seed = 1; seed <= 2000 && seen.size < 4; seed += 1) {
    const roll = runCampaignForBand(seed, 'DyingPlanet');
    if (roll && !seen.has(roll.outcomeBand)) {
      seen.set(roll.outcomeBand, roll);
    }
  }

  const backlash = seen.get('backlash');
  const attention = seen.get('attention');
  const success = seen.get('success');
  const surge = seen.get('surge');

  assert.equal(backlash?.target, 8);
  assert.equal(backlash?.extractionRemoved, 0);
  assert.equal(backlash?.domainDelta, 0);
  assert.equal(backlash?.globalGazeDelta, 0);
  assert.equal(backlash?.warMachineDelta, 1);

  assert.equal(attention?.target, 8);
  assert.equal(attention?.extractionRemoved, 0);
  assert.equal(attention?.domainDelta, 0);
  assert.equal(attention?.globalGazeDelta, 1);
  assert.equal(attention?.warMachineDelta, 0);

  assert.equal(success?.target, 8);
  assert.equal(success?.extractionRemoved, 1);
  assert.equal(success?.domainDelta, 1);
  assert.equal(success?.globalGazeDelta, 0);
  assert.equal(success?.warMachineDelta, 0);

  assert.equal(surge?.target, 8);
  assert.equal(surge?.extractionRemoved, 2);
  assert.equal(surge?.domainDelta, 1);
  assert.equal(surge?.globalGazeDelta, 0);
  assert.equal(surge?.warMachineDelta, 0);
});

test('war machine campaign successes can reduce War Machine directly', () => {
  let warSuccess: NonNullable<ReturnType<typeof runCampaignForBand>> | null = null;

  for (let seed = 1; seed <= 2000 && !warSuccess; seed += 1) {
    const roll = runCampaignForBand(seed, 'WarMachine');
    if (roll && roll.success && roll.warMachineDelta === -1) {
      warSuccess = roll;
    }
  }

  assert.equal(warSuccess?.target, 8);
  assert.equal(warSuccess?.domainId, 'WarMachine');
  assert.equal(warSuccess?.warMachineDelta, -1);
});

test('crisis deck draws once each system phase and twice when Global Gaze is high', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.decks.crisis.drawPile = ['crisis_military_raid', 'crisis_media_smear'];
  state.decks.system.drawPile = [];
  state.globalGaze = 10;

  const next = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  const crisisReveals = next.eventLog.filter((event) => event.context?.cardReveals?.[0]?.deckId === 'crisis');

  assert.equal(crisisReveals.length, 2);
  assert.equal(next.decks.crisis.discardPile.length, 2);
  assert.equal(next.publicAttentionEvents.length >= 1, true);
});

test('each system escalation trigger can fire only once across the game', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.regions.Congo.extractionTokens = 2;
  state.regions.Levant.extractionTokens = 2;
  state.regions.Amazon.extractionTokens = 1;
  state.regions.Sahel.extractionTokens = 1;
  state.regions.Mekong.extractionTokens = 1;
  state.regions.Andes.extractionTokens = 1;
  state.decks.crisis.drawPile = [];
  state.decks.system.drawPile = ['sys_emergency_powers', 'sys_resource_privatization_wave'];

  const first = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  first.phase = 'SYSTEM';
  first.round = 2;
  first.northernWarMachine = 5;
  first.globalGaze = 8;
  first.usedSystemEscalationTriggers.war_machine_threshold = true;
  first.usedSystemEscalationTriggers.gaze_threshold = true;
  first.usedSystemEscalationTriggers.failed_campaigns = true;
  first.usedSystemEscalationTriggers.symbolic_round_six = true;

  const second = dispatchCommand(first, { type: 'ResolveSystemPhase' }, content);

  assert.equal(first.usedSystemEscalationTriggers.extraction_threshold, true);
  assert.equal(second.activeSystemCardIds.length, 1);
});

test('failed campaigns increment the escalation counter and can unlock the failed-campaign trigger', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state.phase = 'COALITION';
  state.activeSystemCardIds = ['sys_emergency_powers', 'sys_surveillance_normalization'];
  state.northernWarMachine = 12;
  state.globalGaze = 0;
  state.players[0].actionsRemaining = 1;
  state = dispatchCommand(
    state,
    {
      type: 'QueueIntent',
      seat: 0,
      action: { actionId: 'launch_campaign', regionId: 'Sahel', domainId: 'WarMachine', comradesCommitted: 1, evidenceCommitted: 0 },
    },
    content,
  );
  state.players[0].actionsRemaining = 0;
  state.players[0].ready = true;
  state.players[1].actionsRemaining = 0;
  state.players[1].ready = true;

  const failed = dispatchCommand(state, { type: 'CommitCoalitionIntent' }, content);
  failed.phase = 'SYSTEM';
  failed.decks.crisis.drawPile = [];
  failed.decks.system.drawPile = ['sys_structural_adjustment_program'];
  failed.failedCampaigns = 2;
  failed.usedSystemEscalationTriggers.extraction_threshold = true;
  failed.usedSystemEscalationTriggers.war_machine_threshold = true;
  failed.usedSystemEscalationTriggers.gaze_threshold = true;

  const escalated = dispatchCommand(failed, { type: 'ResolveSystemPhase' }, content);

  assert.equal(failed.failedCampaigns >= 1, true);
  assert.equal(escalated.usedSystemEscalationTriggers.failed_campaigns, true);
  assert.equal(escalated.activeSystemCardIds.includes('sys_structural_adjustment_program'), true);
});
