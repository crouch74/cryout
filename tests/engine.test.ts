import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, dispatchCommand, initializeGame, listRulesets, type EngineCommand } from '../engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 1, 2, 3],
  seed: 4242,
};

const multiOwnerStartCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
  type: 'StartGame',
  rulesetId: 'base_design',
  mode: 'LIBERATION',
  humanPlayerCount: 2,
  seatFactionIds: ['congo_basin_collective', 'levant_sumud', 'mekong_echo_network', 'amazon_guardians'],
  seatOwnerIds: [0, 0, 1, 1],
  seed: 4242,
};

test('canonical ruleset registry exposes the design-faithful cutover ruleset', () => {
  const rulesets = listRulesets();
  const baseDesign = rulesets.find((ruleset) => ruleset.id === 'base_design');

  assert.equal(Boolean(baseDesign), true);
  assert.equal(baseDesign?.regions.length, 6);
});

test('same seed produces deterministic system deck order', () => {
  const stateA = initializeGame(startCommand);
  const stateB = initializeGame(startCommand);
  const stateC = initializeGame({ ...startCommand, seed: 99 });

  assert.deepEqual(stateA.decks.system.drawPile, stateB.decks.system.drawPile);
  assert.deepEqual(stateA.decks.crisis.drawPile, stateB.decks.crisis.drawPile);
  assert.notDeepEqual(stateA.decks.system.drawPile, stateC.decks.system.drawPile);
});

test('opening resistance draws reveal publicly and move into discard', () => {
  const state = initializeGame(startCommand);
  const revealEvents = state.eventLog.filter((event) => event.context?.sourceDeckId === 'resistance' && event.context?.cardReveals?.length);
  const revealOrigins = revealEvents.flatMap((event) => event.context?.cardReveals ?? []).map((reveal) => reveal.origin);

  assert.equal(state.players.every((player) => player.resistanceHand.length === 0), true);
  assert.equal(state.decks.resistance.discardPile.length, state.players.length);
  assert.equal(revealEvents.length >= state.players.length, true);
  assert.equal(revealOrigins.every((origin) => origin === 'opening_hand'), true);
});

test('startup supports fewer human players than faction seats while keeping all factions active', () => {
  const state = initializeGame(multiOwnerStartCommand);

  assert.equal(state.players.length, 4);
  assert.deepEqual(state.players.map((player) => player.factionId), multiOwnerStartCommand.seatFactionIds);
  assert.deepEqual(state.players.map((player) => player.ownerId), [0, 0, 1, 1]);
});

test('startup rejects ownership maps that leave a human player without a faction seat', () => {
  assert.throws(
    () => initializeGame({ ...multiOwnerStartCommand, humanPlayerCount: 3, seatOwnerIds: [0, 0, 2, 2] }),
    /owner 1 has no assigned factions/i,
  );
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

test('a failed mandate voids a public liberation win', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  for (const region of Object.values(state.regions)) {
    region.extractionTokens = 1;
  }
  state.northernWarMachine = 7;
  state.domains.DyingPlanet.progress = 0;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.match(next.lossReason ?? '', /Secret Mandate/i);
  assert.equal(next.players.every((player) => player.mandateRevealed), true);
  assert.equal(next.terminalOutcome?.cause, 'mandate_failure');
  assert.equal((next.terminalOutcome?.failedMandateIds?.length ?? 0) > 0, true);
});

test('sudden death writes a terminal defeat summary', () => {
  const content = compileContent(startCommand.rulesetId);
  const state = initializeGame(startCommand);
  state.phase = 'RESOLUTION';
  state.round = content.ruleset.suddenDeathRound;

  const next = dispatchCommand(state, { type: 'ResolveResolutionPhase' }, content);

  assert.equal(next.phase, 'LOSS');
  assert.equal(next.terminalOutcome?.cause, 'sudden_death');
  assert.match(next.lossReason ?? '', new RegExp(String(content.ruleset.suddenDeathRound)));
});

test('a seat reaching 0 comrades causes immediate defeat', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.regions.Congo.bodiesPresent[0] = 1;
  state.regions.Levant.bodiesPresent[0] = 0;
  state.regions.Mekong.bodiesPresent[0] = 0;
  state.regions.Amazon.bodiesPresent[0] = 0;

  const next = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'defend', regionId: 'Congo', bodiesCommitted: 1 } },
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

  assert.equal(resolved.phase, 'LOSS');
  assert.equal(resolved.terminalOutcome?.cause, 'comrades_exhausted');
  assert.equal(resolved.terminalOutcome?.exhaustedSeat, 0);
  assert.match(resolved.lossReason ?? '', /0 Comrades/);
});

test('launch campaign consumes 2d6 of rng and can remove extraction on success', () => {
  const content = compileContent(startCommand.rulesetId);
  let state = initializeGame(startCommand);
  state = dispatchCommand(state, { type: 'ResolveSystemPhase' }, content);
  state.players[0].actionsRemaining = 1;
  state = dispatchCommand(
    state,
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Congo', domainId: 'DyingPlanet', bodiesCommitted: 2, evidenceCommitted: 1 } },
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
    { type: 'QueueIntent', seat: 0, action: { actionId: 'launch_campaign', regionId: 'Congo', domainId, bodiesCommitted: 1, evidenceCommitted: 0 } },
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
      action: { actionId: 'launch_campaign', regionId: 'Sahel', domainId: 'WarMachine', bodiesCommitted: 1, evidenceCommitted: 0 },
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
