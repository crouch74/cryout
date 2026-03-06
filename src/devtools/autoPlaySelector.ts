import {
  getAvailableDomains,
  getAvailableRegions,
  getSeatActions,
  getSeatDisabledReason,
  nextInt,
  type ActionDefinition,
  type CompiledContent,
  type DomainId,
  type EngineCommand,
  type EngineState,
  type FactionDefinition,
  type PlayerState,
  type QueuedIntent,
  type RegionId,
  type ResistanceCardDefinition,
  type RngState,
} from '../engine/index.ts';
import { localizeActionField, localizeFactionField, localizeRegionField } from '../i18n/index.ts';

const BASE_CAMPAIGN_TARGET = 8;
const TOP_BAND_DELTA = 5;

const BASE_ACTION_SCORES: Record<string, number> = {
  launch_campaign: 70,
  build_solidarity: 58,
  investigate: 42,
  play_card: 38,
  organize: 34,
  expose_regime_lies: 30,
  international_outreach: 26,
  go_viral: 26,
  call_labor_strike: 24,
  burn_veil: 24,
  schoolgirl_network: 20,
  smuggle_evidence: 14,
  defend: 12,
  compose_chant: 6,
  coordinate_digital: 4,
};

interface SystemPressureSnapshot {
  campaignTargetDelta: number;
  campaignModifierDelta: number;
  outreachCostDelta: number;
  resistanceDrawDelta: number;
  crisisDrawDelta: number;
  crisisExtractionBonus: number;
}

export interface AutoPlayCandidate {
  seat: number;
  action: Omit<QueuedIntent, 'slot'>;
  score: number;
  reasons: string[];
}

export interface AutoPlaySelection {
  command: EngineCommand;
  candidate?: AutoPlayCandidate;
}

export interface AutoPlaySelectionPreview {
  title: string;
  message: string;
}

function getFaction(state: EngineState, content: CompiledContent, seat: number): FactionDefinition | null {
  const player = state.players[seat];
  return player ? content.factions[player.factionId] ?? null : null;
}

function getRegionUrgencyBonus(regionExtraction: number) {
  if (regionExtraction >= 5) {
    return 24;
  }
  if (regionExtraction >= 4) {
    return 16;
  }
  if (regionExtraction >= 3) {
    return 10;
  }
  return 0;
}

function getSystemPressure(state: EngineState, content: CompiledContent): SystemPressureSnapshot {
  const totals: SystemPressureSnapshot = {
    campaignTargetDelta: 0,
    campaignModifierDelta: 0,
    outreachCostDelta: 0,
    resistanceDrawDelta: 0,
    crisisDrawDelta: 0,
    crisisExtractionBonus: 0,
  };

  for (const cardId of state.activeSystemCardIds) {
    const card = content.cards[cardId];
    if (!card || card.deck !== 'system') {
      continue;
    }

    const modifiers = card.persistentModifiers ?? {};
    totals.campaignTargetDelta += modifiers.campaignTargetDelta ?? 0;
    totals.campaignModifierDelta += modifiers.campaignModifierDelta ?? 0;
    totals.outreachCostDelta += modifiers.outreachCostDelta ?? 0;
    totals.resistanceDrawDelta += modifiers.resistanceDrawDelta ?? 0;
    totals.crisisDrawDelta += modifiers.crisisDrawDelta ?? 0;
    totals.crisisExtractionBonus += modifiers.crisisExtractionBonus ?? 0;
  }

  if (state.scenarioFlags.stateOfEmergencyNationwide) {
    totals.campaignTargetDelta += 1;
  }

  return totals;
}

function getOutreachCost(state: EngineState, content: CompiledContent, seat: number) {
  const faction = getFaction(state, content, seat);
  if (!faction) {
    return 2;
  }

  const pressure = getSystemPressure(state, content);
  return Math.max(0, 2 + faction.outreachPenalty + pressure.outreachCostDelta);
}

function getCampaignSupportBonus(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  intent: Omit<QueuedIntent, 'slot'>,
): { bonus: number; card: ResistanceCardDefinition | null } {
  if (!intent.cardId) {
    return { bonus: 0, card: null };
  }

  const card = content.cards[intent.cardId];
  const player = state.players[seat];
  if (!card || card.deck !== 'resistance' || card.type !== 'support' || !player?.resistanceHand.includes(intent.cardId)) {
    return { bonus: 0, card: null };
  }

  let bonus = card.campaignBonus ?? 0;
  if (card.domainBonus && card.domainBonus !== intent.domainId) {
    bonus = 0;
  }
  if (card.regionBonus && card.regionBonus !== 'ANY' && card.regionBonus !== intent.regionId) {
    bonus = 0;
  }
  return { bonus, card };
}

function getImplicitEvidenceSpend(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: string,
  intent: Omit<QueuedIntent, 'slot'>,
) {
  switch (actionId) {
    case 'launch_campaign':
      return intent.evidenceCommitted ?? 0;
    case 'international_outreach':
      return getOutreachCost(state, content, seat);
    case 'go_viral':
    case 'compose_chant':
    case 'coordinate_digital':
      return 1;
    case 'expose_regime_lies':
    case 'call_labor_strike':
      return 2;
    default:
      return 0;
  }
}

function getImplicitBodySpend(actionId: string, intent: Omit<QueuedIntent, 'slot'>) {
  switch (actionId) {
    case 'launch_campaign':
    case 'defend':
      return intent.comradesCommitted ?? 0;
    case 'build_solidarity':
      return 3;
    case 'smuggle_evidence':
    case 'burn_veil':
      return 1;
    default:
      return 0;
  }
}

function listCardCandidates(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  action: ActionDefinition,
): Array<string | undefined> {
  if (!action.needsCard) {
    return [undefined];
  }

  const player = state.players[seat];
  const matchingCards = player.resistanceHand.filter((cardId) => {
    const card = content.cards[cardId];
    return card?.deck === 'resistance' && (!action.cardType || card.type === action.cardType);
  });

  if (action.id === 'launch_campaign') {
    return [undefined, ...matchingCards];
  }

  return matchingCards.length > 0 ? matchingCards : [undefined];
}

function buildIntentKey(intent: Omit<QueuedIntent, 'slot'>) {
  return [
    intent.actionId,
    intent.regionId ?? '_',
    intent.domainId ?? '_',
    intent.targetSeat ?? '_',
    intent.comradesCommitted ?? '_',
    intent.evidenceCommitted ?? '_',
    intent.cardId ?? '_',
  ].join('|');
}

function pushReason(reasons: string[], condition: boolean, reason: string) {
  if (condition) {
    reasons.push(reason);
  }
}

function hasCompatibleSupportCard(state: EngineState, content: CompiledContent, seat: number) {
  return state.players[seat]?.resistanceHand.some((cardId) => {
    const card = content.cards[cardId];
    return card?.deck === 'resistance' && card.type === 'support';
  }) ?? false;
}

function hasMeaningfulCardEffects(card: ResistanceCardDefinition | undefined) {
  if (!card?.effects) {
    return false;
  }

  return card.effects.some((effect) => effect.type === 'modify_domain'
    || effect.type === 'modify_gaze'
    || effect.type === 'add_extraction'
    || effect.type === 'remove_extraction');
}

function scoreActionSpecificAdjustments(
  state: EngineState,
  content: CompiledContent,
  candidate: AutoPlayCandidate,
  faction: FactionDefinition | null,
  reasons: string[],
) {
  const { seat, action } = candidate;
  const player = state.players[seat];
  const region = action.regionId ? state.regions[action.regionId] : null;
  const regionComrades = region ? (region.comradesPresent[seat] ?? 0) : 0;
  const support = getCampaignSupportBonus(state, content, seat, action);
  const pressure = getSystemPressure(state, content);

  switch (action.actionId) {
    case 'launch_campaign': {
      const committedComrades = action.comradesCommitted ?? 0;
      const committedEvidence = action.evidenceCommitted ?? 0;
      const comradesModifier = Math.floor(committedComrades / 2);
      const gazeModifier = Math.floor(state.globalGaze / 5);
      const warMachineModifier = -Math.floor(state.northernWarMachine / 4);
      let staticModifier = comradesModifier + committedEvidence + gazeModifier + warMachineModifier + pressure.campaignModifierDelta;

      if (faction && action.regionId === faction.homeRegion) {
        staticModifier += faction.campaignBonus;
      }
      if (faction?.campaignDomainBonus && faction.campaignDomainBonus === action.domainId) {
        staticModifier += 1;
      }
      staticModifier += support.bonus;

      const estimatedTotal = 7 + staticModifier;
      const successTarget = BASE_CAMPAIGN_TARGET + pressure.campaignTargetDelta;
      const estimatedMargin = estimatedTotal - successTarget;
      if (estimatedMargin >= 2) {
        candidate.score += 24;
        reasons.push('good odds');
      } else if (estimatedMargin >= 0) {
        candidate.score += 14;
        reasons.push('viable odds');
      } else {
        candidate.score -= 18;
      }

      const extraction = region?.extractionTokens ?? 0;
      if (extraction >= 4) {
        candidate.score += 14;
        reasons.push('urgent extraction');
      }
      if (extraction >= 5) {
        candidate.score += 10;
      }
      if (
        support.card
        && support.bonus > 0
        && (action.domainId === faction?.campaignDomainBonus || action.regionId === faction?.homeRegion)
      ) {
        candidate.score += 8;
        reasons.push('aligned support');
      }
      if (!support.card && committedComrades <= 1 && committedEvidence === 0) {
        candidate.score -= 10;
      }
      break;
    }
    case 'build_solidarity': {
      const extraction = region?.extractionTokens ?? 0;
      if (extraction >= 4) {
        candidate.score += 14;
        reasons.push('urgent extraction');
      }
      if (action.domainId && state.domains[action.domainId].progress < 5) {
        candidate.score += 8;
      }
      if (region && regionComrades - 3 < 2) {
        candidate.score -= 12;
      }
      break;
    }
    case 'investigate': {
      if (player.evidence <= 1) {
        candidate.score += 14;
        reasons.push('evidence starved');
      }
      if (!hasCompatibleSupportCard(state, content, seat)) {
        candidate.score += 10;
      }
      if (action.regionId && action.regionId === faction?.homeRegion) {
        candidate.score += 6;
      }
      break;
    }
    case 'organize': {
      if (regionComrades < 3) {
        candidate.score += 12;
      }
      if ((region?.extractionTokens ?? 0) >= 4) {
        candidate.score += 10;
      }
      if (action.regionId && action.regionId === faction?.homeRegion) {
        candidate.score += 8;
      }
      break;
    }
    case 'play_card': {
      const card = action.cardId ? content.cards[action.cardId] : undefined;
      const actionCard = card?.deck === 'resistance' && card.type === 'action' ? card : undefined;
      const effectCount = Math.min(18, (actionCard?.effects?.length ?? 0) * 6);
      candidate.score += effectCount;
      if (hasMeaningfulCardEffects(actionCard)) {
        candidate.score += 10;
        reasons.push('impactful card');
      }
      if (action.regionId && (action.regionId === faction?.homeRegion || (region?.extractionTokens ?? 0) >= 4)) {
        candidate.score += 6;
      }
      break;
    }
    case 'international_outreach':
    case 'go_viral': {
      if (state.globalGaze < 10) {
        candidate.score += 12;
        reasons.push('low gaze');
      } else if (state.globalGaze < 15) {
        candidate.score += 6;
      }
      if (player.evidence - getImplicitEvidenceSpend(state, content, seat, action.actionId, action) <= 0) {
        candidate.score -= 8;
      }
      break;
    }
    case 'expose_regime_lies': {
      if (state.northernWarMachine >= 8) {
        candidate.score += 18;
        reasons.push('war machine pressure');
      } else if (state.northernWarMachine >= 6) {
        candidate.score += 10;
      }
      break;
    }
    case 'call_labor_strike': {
      if (regionComrades < 3) {
        candidate.score += 10;
      }
      if ((region?.extractionTokens ?? 0) >= 4) {
        candidate.score += 6;
      }
      break;
    }
    case 'burn_veil': {
      if (state.globalGaze < 10) {
        candidate.score += 16;
        reasons.push('low gaze');
      }
      if (region && regionComrades - 1 <= 0) {
        candidate.score -= 10;
      }
      break;
    }
    case 'schoolgirl_network': {
      if (player.evidence <= 1) {
        candidate.score += 10;
      }
      break;
    }
    case 'smuggle_evidence': {
      const targetSeat = action.targetSeat ?? -1;
      const targetEvidence = state.players[targetSeat]?.evidence ?? 0;
      if (targetEvidence === 0) {
        candidate.score += 16;
        reasons.push('shares evidence');
      }
      if (player.evidence >= 3) {
        candidate.score += 10;
      }
      const transferAmount = faction?.id === 'amazon_guardians' ? 1 : Math.min(2, player.evidence);
      if (player.evidence - transferAmount <= 0) {
        candidate.score -= 10;
      }
      break;
    }
    case 'defend': {
      const extractionPressure = (region?.extractionTokens ?? 0) >= 4;
      const warPressure = state.northernWarMachine >= 8;
      if (extractionPressure) {
        candidate.score += 14;
      }
      if (warPressure) {
        candidate.score += 10;
      }
      if (!extractionPressure && !warPressure) {
        candidate.score -= 12;
      }
      break;
    }
    default:
      break;
  }
}

export function listAutoPlayIntentsForSeat(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  options?: { includeDisabledReasons?: boolean },
): Omit<QueuedIntent, 'slot'>[] {
  const player = state.players[seat];
  if (!player || player.actionsRemaining <= 0) {
    return [];
  }

  const intents: Omit<QueuedIntent, 'slot'>[] = [];
  const seen = new Set<string>();

  for (const action of getSeatActions(content)) {
    const regionCandidates = action.needsRegion ? getAvailableRegions(content) : [undefined];
    const domainCandidates = action.needsDomain ? getAvailableDomains(content) : [undefined];
    const targetSeatCandidates = action.needsTargetSeat
      ? state.players.filter((candidate) => candidate.seat !== seat).map((candidate) => candidate.seat)
      : [undefined];
    const cardCandidates = listCardCandidates(state, content, seat, action);

    for (const regionId of regionCandidates) {
      const comradesInRegion = regionId ? state.regions[regionId].comradesPresent[seat] ?? 0 : 0;
      const comradeCandidates = action.needsComrades
        ? Array.from({ length: Math.max(1, comradesInRegion) }, (_, index) => index + 1)
        : [undefined];
      const evidenceCandidates = action.needsEvidence
        ? Array.from({ length: Math.max(player.evidence, 0) + 1 }, (_, index) => index)
        : [undefined];

      for (const domainId of domainCandidates) {
        for (const targetSeat of targetSeatCandidates) {
          for (const comradesCommitted of comradeCandidates) {
            for (const evidenceCommitted of evidenceCandidates) {
              for (const cardId of cardCandidates) {
                const intent: Omit<QueuedIntent, 'slot'> = {
                  actionId: action.id,
                  regionId: regionId as RegionId | undefined,
                  domainId: domainId as DomainId | undefined,
                  targetSeat,
                  comradesCommitted,
                  evidenceCommitted,
                  cardId,
                };
                const disabledReason = getSeatDisabledReason(state, content, seat, intent, {
                  includeLegacyReason: options?.includeDisabledReasons !== false,
                });
                if (disabledReason.disabled) {
                  continue;
                }

                const key = buildIntentKey(intent);
                if (seen.has(key)) {
                  continue;
                }
                seen.add(key);
                intents.push(intent);
              }
            }
          }
        }
      }
    }
  }

  return intents;
}

export function scoreAutoPlayCandidate(
  state: EngineState,
  content: CompiledContent,
  candidate: AutoPlayCandidate,
): AutoPlayCandidate {
  const faction = getFaction(state, content, candidate.seat);
  const region = candidate.action.regionId ? state.regions[candidate.action.regionId] : null;
  const player = state.players[candidate.seat];
  const reasons: string[] = [];

  candidate.score = BASE_ACTION_SCORES[candidate.action.actionId] ?? 10;
  pushReason(reasons, candidate.action.actionId === 'launch_campaign', 'pressure play');
  pushReason(reasons, candidate.action.actionId === 'investigate', 'evidence engine');

  if (region) {
    const urgencyBonus = getRegionUrgencyBonus(region.extractionTokens);
    candidate.score += urgencyBonus;
    pushReason(reasons, urgencyBonus > 0, 'urgent extraction');
    if (candidate.action.regionId === faction?.homeRegion) {
      candidate.score += 8;
      reasons.push('home region');
    }
  }

  if (candidate.action.domainId && candidate.action.domainId === faction?.campaignDomainBonus) {
    candidate.score += 8;
    reasons.push('faction-aligned domain');
  }

  const comradeSpend = getImplicitBodySpend(candidate.action.actionId, candidate.action);
  const evidenceSpend = getImplicitEvidenceSpend(state, content, candidate.seat, candidate.action.actionId, candidate.action);
  candidate.score -= comradeSpend * 2;
  candidate.score -= evidenceSpend * 3;

  if (player.evidence > 0 && player.evidence - evidenceSpend <= 0 && evidenceSpend > 0) {
    candidate.score -= 6;
  }
  if (region && comradeSpend > 0 && (region.comradesPresent[candidate.seat] ?? 0) - comradeSpend <= 0) {
    candidate.score -= 6;
  }

  scoreActionSpecificAdjustments(state, content, candidate, faction, reasons);
  candidate.reasons = Array.from(new Set(reasons));
  return candidate;
}

export function buildAutoPlayCandidates(state: EngineState, content: CompiledContent): AutoPlayCandidate[] {
  const candidates: AutoPlayCandidate[] = [];

  for (const player of state.players) {
    if (player.actionsRemaining <= 0) {
      continue;
    }

    for (const intent of listAutoPlayIntentsForSeat(state, content, player.seat)) {
      candidates.push(scoreAutoPlayCandidate(state, content, {
        seat: player.seat,
        action: intent,
        score: 0,
        reasons: [],
      }));
    }
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.seat !== right.seat) {
      return left.seat - right.seat;
    }
    return buildIntentKey(left.action).localeCompare(buildIntentKey(right.action));
  });
}

function cloneRng(rng: RngState): RngState {
  return { ...rng };
}

function getSeatLabel(player: PlayerState | undefined, content: CompiledContent) {
  if (!player) {
    return 'Unknown seat';
  }

  const faction = content.factions[player.factionId];
  return localizeFactionField(faction.id, 'shortName', faction.shortName);
}

function describeQueueIntent(content: CompiledContent, candidate: AutoPlayCandidate) {
  const action = content.actions[candidate.action.actionId];
  const seatLabel = candidate.seat + 1;
  const regionLabel = candidate.action.regionId ? ` in ${candidate.action.regionId}` : '';
  const reasons = candidate.reasons.slice(0, 3).join(', ');
  return `🎲 [DevPanel] Autoplay chose ${action?.id ?? candidate.action.actionId} for seat ${seatLabel}${regionLabel} (score ${candidate.score}${reasons ? `: ${reasons}` : ''}).`;
}

export function getAutoPlayLogMessage(state: EngineState, content: CompiledContent, selection: AutoPlaySelection) {
  if (selection.command.type === 'QueueIntent' && selection.candidate) {
    return describeQueueIntent(content, selection.candidate);
  }

  return `🎲 [DevPanel] Autoplay dispatching ${selection.command.type} during ${state.phase}.`;
}

export function getAutoPlaySelectionPreview(
  state: EngineState,
  content: CompiledContent,
  selection: AutoPlaySelection,
): AutoPlaySelectionPreview | null {
  if (selection.command.type !== 'QueueIntent' || !selection.candidate) {
    return null;
  }

  const player = state.players[selection.command.seat];
  const action = content.actions[selection.command.action.actionId];
  const title = `${getSeatLabel(player, content)} autoplay`;
  const regionLabel = selection.command.action.regionId
    ? localizeRegionField(selection.command.action.regionId, 'name', content.regions[selection.command.action.regionId]?.name ?? selection.command.action.regionId)
    : null;
  const reasons = selection.candidate.reasons.slice(0, 2).join(', ');
  const actionLabel = localizeActionField(action.id, 'name', action.name);
  const message = regionLabel
    ? `${actionLabel} in ${regionLabel}${reasons ? ` • ${reasons}` : ''}`
    : `${actionLabel}${reasons ? ` • ${reasons}` : ''}`;

  return { title, message };
}

export function selectAutoPlayCommand(state: EngineState, content: CompiledContent): EngineCommand | null {
  return selectAutoPlayDecision(state, content)?.command ?? null;
}

export function selectAutoPlayDecision(state: EngineState, content: CompiledContent): AutoPlaySelection | null {
  if (state.phase === 'SYSTEM') {
    return { command: { type: 'ResolveSystemPhase' } };
  }

  if (state.phase === 'COALITION') {
    const activeSeats = state.players.filter((player) => player.actionsRemaining > 0);
    if (activeSeats.length > 0) {
      const candidates = buildAutoPlayCandidates(state, content);
      if (candidates.length === 0) {
        return null;
      }

      const bestScore = candidates[0].score;
      const topBand = candidates.filter((candidate) => candidate.score >= bestScore - TOP_BAND_DELTA);
      let chooserRng = cloneRng(state.rng);
      const [nextRng, index] = nextInt(chooserRng, topBand.length);
      chooserRng = nextRng;
      const selected = topBand[index] ?? candidates[0];
      return {
        command: {
          type: 'QueueIntent',
          seat: selected.seat,
          action: selected.action,
        },
        candidate: selected,
      };
    }

    for (const player of state.players) {
      if (!player.ready) {
        return { command: { type: 'SetReady', seat: player.seat, ready: true } };
      }
    }

    return { command: { type: 'CommitCoalitionIntent' } };
  }

  if (state.phase === 'RESOLUTION') {
    return { command: { type: 'ResolveResolutionPhase' } };
  }

  return null;
}
