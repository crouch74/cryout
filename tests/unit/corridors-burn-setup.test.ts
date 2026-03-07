import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContent, initializeGame, type EngineCommand } from '../../src/engine/index.ts';

const startCommand: Extract<EngineCommand, { type: 'StartGame' }> = {
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

test('when_the_corridors_burn initializes faction-specific starting resources and corridor tracks', () => {
  const content = compileContent('when_the_corridors_burn');
  const state = initializeGame(startCommand);

  assert.equal(state.players.length, 5);
  assert.deepEqual(content.ruleset.setup?.startingEvidenceByFaction, {
    palestinian_sumud_committees: 1,
    gaza_west_bank_witness_medics: 2,
    venezuelan_communal_councils: 1,
    cuban_cdr_neighborhood_defense: 1,
    corridor_workers_refuge_networks: 2,
  });
  assert.deepEqual(state.players.map((player) => player.evidence), [3, 2, 1, 1, 2]);
  assert.equal(state.regions.GazaWestBank.comradesPresent[0], 10);
  assert.equal(state.regions.GazaWestBank.comradesPresent[1], 8);
  assert.equal(state.regions.CaribbeanSiege.comradesPresent[2], 12);
  assert.equal(state.regions.CaribbeanSiege.comradesPresent[3], 8);
  assert.equal(state.regions.RedSeaSuezCorridor.comradesPresent[4], 8);
  assert.equal(state.globalGaze, 9);
  assert.equal(state.northernWarMachine, 6);
  assert.equal(state.customTracks.egypt_corridor?.value, 2);
  assert.equal(state.customTracks.qatar_corridor?.value, 3);
  assert.equal(state.customTracks.gulf_blowback?.value, 1);
  assert.equal(content.ruleset.setup?.startingEvidenceByFaction?.corridor_workers_refuge_networks, 2);
});
