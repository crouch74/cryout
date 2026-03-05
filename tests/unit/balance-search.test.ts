import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateCandidateForTest, scoreMetricsForTest, type BalanceCandidate } from '../../src/simulation/balance/SearchEngine.ts';

test('balance score is maximal at target metrics', () => {
  const target = scoreMetricsForTest({
    publicVictoryRate: 0.5,
    mandateFailRateGivenPublic: 0.35,
    winRate: 0.30,
  });
  const offTarget = scoreMetricsForTest({
    publicVictoryRate: 0.2,
    mandateFailRateGivenPublic: 0.1,
    winRate: 0.6,
  });

  assert.equal(Math.abs(target) < 1e-9, true);
  assert.equal(offTarget < target, true);
});

test('candidate mutation keeps parameters in configured bounds', () => {
  const candidate: BalanceCandidate = {
    liberationThresholdDelta: 1,
    mandateRelaxation: 1,
    seededExtractionReduction: 1,
    crisisSpikeReduction: 1,
    northernWarMachineDelta: -1,
    globalGazeDelta: 1,
  };

  const mutated = mutateCandidateForTest(candidate, 4242);
  assert.equal([0, 1, 2].includes(mutated.liberationThresholdDelta), true);
  assert.equal([0, 1, 2].includes(mutated.mandateRelaxation), true);
  assert.equal([0, 1, 2].includes(mutated.seededExtractionReduction), true);
  assert.equal([0, 1].includes(mutated.crisisSpikeReduction), true);
  assert.equal([0, -1].includes(mutated.northernWarMachineDelta), true);
  assert.equal([0, 1].includes(mutated.globalGazeDelta), true);
});
