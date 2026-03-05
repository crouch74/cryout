import type { DomainId, EngineState } from '../engine/index.ts';
import { seatComrades, totalComrades, totalEvidence } from './invariants.ts';
import type { PreDefeatSnapshot } from './types.ts';

const CANONICAL_DOMAIN_ORDER: DomainId[] = [
  'WarMachine',
  'DyingPlanet',
  'GildedCage',
  'SilencedTruth',
  'EmptyStomach',
  'FossilGrip',
  'StolenVoice',
  'RevolutionaryWave',
  'PatriarchalGrip',
  'UnfinishedJustice',
];

function collectDomains(state: EngineState): PreDefeatSnapshot['domains'] {
  const domains: PreDefeatSnapshot['domains'] = {};

  for (const domainId of CANONICAL_DOMAIN_ORDER) {
    const progress = state.domains[domainId]?.progress;
    if (typeof progress === 'number') {
      domains[domainId] = progress;
    }
  }

  return domains;
}

function collectFronts(state: EngineState): PreDefeatSnapshot['fronts'] {
  const fronts: PreDefeatSnapshot['fronts'] = {};

  for (const [frontId, front] of Object.entries(state.regions)) {
    fronts[frontId] = {
      extraction: front.extractionTokens,
      comradesTotal: Object.values(front.comradesPresent).reduce((sum, count) => sum + count, 0),
    };
  }

  return fronts;
}

export function capturePreDefeatSnapshot(
  state: EngineState,
  phase: string,
): PreDefeatSnapshot {
  const seats = state.players.map((player) => ({
    seatId: String(player.seat),
    comrades: seatComrades(state, player.seat),
    evidence: player.evidence,
  }));

  return {
    round: state.round,
    phase,
    totals: {
      comrades: totalComrades(state),
      evidence: totalEvidence(state),
    },
    seats,
    fronts: collectFronts(state),
    globalTracks: {
      globalGaze: state.globalGaze,
      warMachine: state.northernWarMachine,
    },
    domains: collectDomains(state),
  };
}
