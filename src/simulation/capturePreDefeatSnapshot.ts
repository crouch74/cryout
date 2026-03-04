import type { EngineState } from '../engine/index.ts';
import type { PreDefeatSnapshot } from './types.ts';

const CANONICAL_DOMAIN_ORDER: Array<keyof PreDefeatSnapshot['domains']> = [
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

function seatBodies(state: EngineState, seat: number) {
  return Object.values(state.regions).reduce((sum, front) => sum + (front.bodiesPresent[seat] ?? 0), 0);
}

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
      comradesTotal: Object.values(front.bodiesPresent).reduce((sum, count) => sum + count, 0),
    };
  }

  return fronts;
}

function hasExtractionBreach(state: EngineState) {
  return Object.values(state.regions).some((front) => front.extractionTokens >= 6);
}

function hasComradesExhausted(state: EngineState) {
  return state.players.some((player) => seatBodies(state, player.seat) <= 0);
}

export function capturePreDefeatSnapshot(
  state: EngineState,
  phase: string,
  suddenDeathRound: number,
): PreDefeatSnapshot {
  const seats = state.players.map((player) => ({
    seatId: String(player.seat),
    bodies: seatBodies(state, player.seat),
    evidence: player.evidence,
  }));

  const totalBodies = seats.reduce((sum, seat) => sum + seat.bodies, 0);
  const totalEvidence = seats.reduce((sum, seat) => sum + seat.evidence, 0);

  return {
    round: state.round,
    phase,
    resources: {
      bodiesRemaining: totalBodies,
      evidenceRemaining: totalEvidence,
    },
    seats,
    fronts: collectFronts(state),
    globalTracks: {
      globalGaze: state.globalGaze,
      warMachine: state.northernWarMachine,
    },
    domains: collectDomains(state),
    defeatChecks: {
      comradesExhausted: hasComradesExhausted(state),
      extractionBreach: hasExtractionBreach(state),
      suddenDeath: state.round >= suddenDeathRound,
    },
  };
}
