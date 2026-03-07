import {
  type CompiledContent,
  type EngineState,
  type QueuedIntent,
  type RegionId,
} from '../engine/index.ts';
import {
  listAutoPlayIntentsForSeat,
  scoreAutoPlayCandidate,
  type AutoPlayCandidate,
} from '../devtools/autoPlaySelector.ts';
import type {
  StrategyCandidate,
  StrategyContext,
  StrategyDecision,
  StrategyId,
  StrategyProfile,
} from './types.ts';

const TOP_BAND_DELTA = 5;

const HIGH_PRESSURE_EXTRACTION = 4;

function stableHash(value: string) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function deterministicIndex(state: EngineState, seat: number, strategyId: StrategyId, length: number) {
  if (length <= 1) {
    return 0;
  }
  const salt = stableHash(`${strategyId}:${seat}`);
  const mixed = (state.rng.state ^ state.rng.calls ^ state.round ^ ((seat + 1) * 97) ^ salt) >>> 0;
  return mixed % length;
}

function buildIntentKey(intent: Omit<QueuedIntent, 'slot'>) {
  return `${intent.actionId}|${intent.regionId ?? '_'}|${intent.domainId ?? '_'}|${intent.targetSeat ?? '_'}|${intent.comradesCommitted ?? '_'}|${intent.evidenceCommitted ?? '_'}|${intent.cardId ?? '_'}`;
}

function compareOptionalStrings(left: string | undefined, right: string | undefined) {
  if (left === right) {
    return 0;
  }
  if (left === undefined) {
    return -1;
  }
  if (right === undefined) {
    return 1;
  }
  return left.localeCompare(right);
}

function compareOptionalNumbers(left: number | undefined, right: number | undefined) {
  if (left === right) {
    return 0;
  }
  if (left === undefined) {
    return -1;
  }
  if (right === undefined) {
    return 1;
  }
  return left - right;
}

function compareIntent(left: Omit<QueuedIntent, 'slot'>, right: Omit<QueuedIntent, 'slot'>) {
  const actionCompare = left.actionId.localeCompare(right.actionId);
  if (actionCompare !== 0) {
    return actionCompare;
  }
  const regionCompare = compareOptionalStrings(left.regionId, right.regionId);
  if (regionCompare !== 0) {
    return regionCompare;
  }
  const domainCompare = compareOptionalStrings(left.domainId, right.domainId);
  if (domainCompare !== 0) {
    return domainCompare;
  }
  const targetCompare = compareOptionalNumbers(left.targetSeat, right.targetSeat);
  if (targetCompare !== 0) {
    return targetCompare;
  }
  const comradesCompare = compareOptionalNumbers(left.comradesCommitted, right.comradesCommitted);
  if (comradesCompare !== 0) {
    return comradesCompare;
  }
  const evidenceCompare = compareOptionalNumbers(left.evidenceCommitted, right.evidenceCommitted);
  if (evidenceCompare !== 0) {
    return evidenceCompare;
  }
  return compareOptionalStrings(left.cardId, right.cardId);
}

function toStrategyCandidate(candidate: AutoPlayCandidate): StrategyCandidate {
  return {
    seat: candidate.seat,
    action: candidate.action,
    baseScore: candidate.score,
    score: candidate.score,
    reasons: [...candidate.reasons],
  };
}

function getRegionExtraction(state: EngineState, regionId: RegionId | undefined) {
  if (!regionId) {
    return 0;
  }
  return state.regions[regionId]?.extractionTokens ?? 0;
}

function getSystemPressure(state: EngineState, content: CompiledContent) {
  const totals = {
    campaignTargetDelta: 0,
    campaignModifierDelta: 0,
    outreachCostDelta: 0,
  };

  for (const cardId of state.activeSystemCardIds) {
    const card = content.cards[cardId];
    if (!card || card.deck !== 'system') {
      continue;
    }

    totals.campaignTargetDelta += card.persistentModifiers?.campaignTargetDelta ?? 0;
    totals.campaignModifierDelta += card.persistentModifiers?.campaignModifierDelta ?? 0;
    totals.outreachCostDelta += card.persistentModifiers?.outreachCostDelta ?? 0;
  }

  if (state.scenarioFlags.stateOfEmergencyNationwide) {
    totals.campaignTargetDelta += 1;
  }

  return totals;
}

function getOutreachCost(state: EngineState, content: CompiledContent, seat: number) {
  const factionId = state.players[seat]?.factionId;
  const faction = factionId ? content.factions[factionId] : null;
  const pressure = getSystemPressure(state, content);
  return Math.max(0, 2 + (faction?.outreachPenalty ?? 0) + pressure.outreachCostDelta);
}

function getResourceSpend(state: EngineState, content: CompiledContent, seat: number, action: Omit<QueuedIntent, 'slot'>) {
  let comrades = 0;
  let evidence = 0;

  switch (action.actionId) {
    case 'launch_campaign':
      comrades += action.comradesCommitted ?? 0;
      evidence += action.evidenceCommitted ?? 0;
      break;
    case 'build_solidarity':
      comrades += 3;
      break;
    case 'smuggle_evidence':
      comrades += 1;
      break;
    case 'defend':
      comrades += action.comradesCommitted ?? 0;
      break;
    case 'international_outreach':
      evidence += getOutreachCost(state, content, seat);
      break;
    case 'go_viral':
    case 'burn_veil':
    case 'compose_chant':
    case 'coordinate_digital':
      evidence += 1;
      break;
    case 'expose_regime_lies':
    case 'call_labor_strike':
      evidence += 2;
      break;
    default:
      break;
  }

  return { comrades, evidence };
}

function getSupportBonus(state: EngineState, content: CompiledContent, seat: number, action: Omit<QueuedIntent, 'slot'>) {
  if (!action.cardId) {
    return 0;
  }

  const card = content.cards[action.cardId];
  if (!card || card.deck !== 'resistance' || card.type !== 'support') {
    return 0;
  }

  const player = state.players[seat];
  if (!player?.resistanceHand.includes(action.cardId)) {
    return 0;
  }

  let bonus = card.campaignBonus ?? 0;
  if (card.domainBonus && card.domainBonus !== action.domainId) {
    bonus = 0;
  }
  if (card.regionBonus && card.regionBonus !== 'ANY' && card.regionBonus !== action.regionId) {
    bonus = 0;
  }

  return bonus;
}

function estimateCampaignMargin(state: EngineState, content: CompiledContent, seat: number, action: Omit<QueuedIntent, 'slot'>) {
  if (action.actionId !== 'launch_campaign') {
    return 0;
  }

  const player = state.players[seat];
  const faction = player ? content.factions[player.factionId] : null;
  const pressure = getSystemPressure(state, content);

  const committedComrades = action.comradesCommitted ?? 0;
  const committedEvidence = action.evidenceCommitted ?? 0;

  let modifier = 0;
  modifier += Math.floor(committedComrades / 2);
  modifier += committedEvidence;
  modifier += Math.floor(state.globalGaze / 5);
  modifier -= Math.floor(state.northernWarMachine / 4);
  modifier += pressure.campaignModifierDelta;

  if (faction && action.regionId === faction.homeRegion) {
    modifier += faction.campaignBonus;
  }
  if (faction?.campaignDomainBonus && action.domainId === faction.campaignDomainBonus) {
    modifier += 1;
  }
  modifier += getSupportBonus(state, content, seat, action);

  const expectedTotal = 7 + modifier;
  const target = 8 + pressure.campaignTargetDelta;
  return expectedTotal - target;
}

function topBandSelection(
  state: EngineState,
  seat: number,
  strategyId: StrategyId,
  candidates: StrategyCandidate[],
): StrategyDecision | null {
  if (candidates.length === 0) {
    return null;
  }

  let bestScore = Number.NEGATIVE_INFINITY;
  const keyedCandidates = candidates.map((candidate) => ({
    candidate,
    key: buildIntentKey(candidate.action),
  }));
  for (const entry of keyedCandidates) {
    if (entry.candidate.score > bestScore) {
      bestScore = entry.candidate.score;
    }
  }

  const topBand = keyedCandidates
    .filter((entry) => entry.candidate.score >= bestScore - TOP_BAND_DELTA)
    .sort((left, right) => {
      if (right.candidate.score !== left.candidate.score) {
        return right.candidate.score - left.candidate.score;
      }
      return compareIntent(left.candidate.action, right.candidate.action);
    });
  const pick = topBand[deterministicIndex(state, seat, strategyId, topBand.length)]?.candidate ?? topBand[0]?.candidate;
  if (!pick) {
    return null;
  }

  return {
    seat,
    action: pick.action,
    baseScore: pick.baseScore,
    score: pick.score,
    reasons: [...new Set([...pick.reasons, `strategy:${strategyId}`])],
  };
}

function applyExtractionDefender(candidate: StrategyCandidate, context: StrategyContext) {
  const extraction = getRegionExtraction(context.state, candidate.action.regionId);
  if (extraction >= HIGH_PRESSURE_EXTRACTION) {
    if (candidate.action.actionId === 'launch_campaign' || candidate.action.actionId === 'build_solidarity' || candidate.action.actionId === 'defend') {
      candidate.score += 22 + extraction * 2;
      candidate.reasons.push('extraction containment');
    }
    if (candidate.action.actionId === 'organize' && extraction >= 5) {
      candidate.score += 16;
      candidate.reasons.push('reinforce critical front');
    }
  }

  if (!candidate.action.regionId && extraction === 0) {
    const highestExtraction = Math.max(...Object.values(context.state.regions).map((region) => region.extractionTokens));
    if (highestExtraction >= HIGH_PRESSURE_EXTRACTION) {
      candidate.score -= 14;
    }
  }
}

function applyDomainBuilder(candidate: StrategyCandidate, context: StrategyContext) {
  if (candidate.action.actionId === 'build_solidarity' || candidate.action.actionId === 'launch_campaign') {
    candidate.score += 18;
    candidate.reasons.push('domain progression');
  }

  if (candidate.action.domainId) {
    const progress = context.state.domains[candidate.action.domainId]?.progress ?? 0;
    if (progress < 6) {
      candidate.score += 10;
    }
  }
}

function applyEvidenceHoarder(candidate: StrategyCandidate, context: StrategyContext) {
  const spend = getResourceSpend(context.state, context.content, context.seat, candidate.action);

  if (candidate.action.actionId === 'investigate' || candidate.action.actionId === 'schoolgirl_network') {
    candidate.score += 24;
    candidate.reasons.push('evidence growth');
  }

  if (candidate.action.actionId === 'smuggle_evidence') {
    candidate.score += 10;
  }

  if (spend.evidence > 0) {
    candidate.score -= spend.evidence * 7;
  }
}

function applyGlobalAttention(candidate: StrategyCandidate) {
  if (candidate.action.actionId === 'international_outreach' || candidate.action.actionId === 'go_viral' || candidate.action.actionId === 'burn_veil') {
    candidate.score += 26;
    candidate.reasons.push('raise global gaze');
  }

  if (candidate.action.actionId === 'launch_campaign') {
    candidate.score += 4;
  }
}

function applyMandateHunter(candidate: StrategyCandidate, context: StrategyContext) {
  const player = context.state.players[context.seat];
  const faction = player ? context.content.factions[player.factionId] : null;
  if (!faction) {
    return;
  }

  const homeExtraction = context.state.regions[faction.homeRegion]?.extractionTokens ?? 0;

  if (candidate.action.regionId === faction.homeRegion) {
    candidate.score += 16;
    candidate.reasons.push('home-region mandate pressure');
  }

  if (candidate.action.domainId && candidate.action.domainId === faction.campaignDomainBonus) {
    candidate.score += 14;
    candidate.reasons.push('faction mandate domain');
  }

  if (candidate.action.actionId === 'defend' && homeExtraction >= HIGH_PRESSURE_EXTRACTION) {
    candidate.score += 14;
  }

  if (candidate.action.actionId === 'launch_campaign' && homeExtraction >= HIGH_PRESSURE_EXTRACTION) {
    candidate.score += 18;
  }
}

function applyRiskTaker(candidate: StrategyCandidate, context: StrategyContext) {
  if (candidate.action.actionId === 'launch_campaign') {
    const committedComrades = candidate.action.comradesCommitted ?? 0;
    const committedEvidence = candidate.action.evidenceCommitted ?? 0;
    candidate.score += 28 + committedComrades * 3 + committedEvidence * 4;
    candidate.reasons.push('aggressive campaign posture');
  }

  if (candidate.action.actionId === 'build_solidarity') {
    candidate.score += 8;
  }

  if (candidate.action.actionId === 'investigate' || candidate.action.actionId === 'defend') {
    candidate.score -= 6;
  }

  const margin = estimateCampaignMargin(context.state, context.content, context.seat, candidate.action);
  if (candidate.action.actionId === 'launch_campaign' && margin < 0) {
    candidate.score += 10;
  }
}

function applyRiskAvoider(candidate: StrategyCandidate, context: StrategyContext) {
  if (candidate.action.actionId === 'launch_campaign') {
    const margin = estimateCampaignMargin(context.state, context.content, context.seat, candidate.action);
    if (margin >= 2) {
      candidate.score += 14;
      candidate.reasons.push('safe campaign window');
    } else if (margin >= 0) {
      candidate.score += 4;
    } else {
      candidate.score -= 34;
      candidate.reasons.push('avoids risky campaign');
    }
  }

  if (candidate.action.actionId === 'investigate' || candidate.action.actionId === 'organize' || candidate.action.actionId === 'defend') {
    candidate.score += 10;
  }
}

function chooseByProfile(context: StrategyContext, applyAdjustments: (candidate: StrategyCandidate, context: StrategyContext) => void) {
  const adjusted: StrategyCandidate[] = [];
  for (const candidate of context.candidates) {
    const next: StrategyCandidate = {
      seat: candidate.seat,
      action: candidate.action,
      baseScore: candidate.baseScore,
      score: candidate.baseScore,
      reasons: [...candidate.reasons],
    };
    applyAdjustments(next, context);
    adjusted.push(next);
  }

  return topBandSelection(context.state, context.seat, context.strategyId, adjusted);
}

function chooseRandom(context: StrategyContext) {
  if (context.candidates.length === 0) {
    return null;
  }

  const index = deterministicIndex(context.state, context.seat, context.strategyId, context.candidates.length);
  const selected = context.candidates[index] ?? context.candidates[0];
  return {
    seat: context.seat,
    action: selected.action,
    baseScore: selected.baseScore,
    score: selected.baseScore,
    reasons: [...selected.reasons, 'strategy:random'],
  } satisfies StrategyDecision;
}

export function buildStrategyCandidatesForSeat(
  state: EngineState,
  content: CompiledContent,
  seat: number,
): StrategyCandidate[] {
  if (!state.players[seat] || state.players[seat].actionsRemaining <= 0) {
    return [];
  }

  const candidates = listAutoPlayIntentsForSeat(state, content, seat, {
    includeDisabledReasons: false,
  })
    .map((intent) => scoreAutoPlayCandidate(state, content, {
        seat,
        action: intent,
        score: 0,
        reasons: [],
      }))
    .map(toStrategyCandidate);

  return candidates;
}

const PROFILES: StrategyProfile[] = [
  {
    id: 'random',
    label: 'Random',
    chooseAction: (context) => chooseRandom(context),
  },
  {
    id: 'extraction_defender',
    label: 'Extraction Defender',
    chooseAction: (context) => chooseByProfile(context, applyExtractionDefender),
  },
  {
    id: 'domain_builder',
    label: 'Domain Builder',
    chooseAction: (context) => chooseByProfile(context, applyDomainBuilder),
  },
  {
    id: 'evidence_hoarder',
    label: 'Evidence Hoarder',
    chooseAction: (context) => chooseByProfile(context, applyEvidenceHoarder),
  },
  {
    id: 'global_attention',
    label: 'Global Attention',
    chooseAction: (context) => chooseByProfile(context, applyGlobalAttention),
  },
  {
    id: 'mandate_hunter',
    label: 'Mandate Hunter',
    chooseAction: (context) => chooseByProfile(context, applyMandateHunter),
  },
  {
    id: 'risk_taker',
    label: 'Risk Taker',
    chooseAction: (context) => chooseByProfile(context, applyRiskTaker),
  },
  {
    id: 'risk_avoider',
    label: 'Risk Avoider',
    chooseAction: (context) => chooseByProfile(context, applyRiskAvoider),
  },
  {
    id: 'balanced',
    label: 'Balanced',
    chooseAction: (context) => chooseByProfile(context, () => {
      // Balanced profile intentionally keeps base autoplay weighting intact.
    }),
  },
];

export const STRATEGY_PROFILES = PROFILES;

export function listStrategyProfiles() {
  return STRATEGY_PROFILES.map((profile) => profile);
}

export function getStrategyProfile(strategyId: StrategyId) {
  return STRATEGY_PROFILES.find((profile) => profile.id === strategyId) ?? null;
}
