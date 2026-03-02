import type {
  ActionId,
  CardRevealEvent,
  CompiledContent,
  DisabledActionReason,
  DomainEvent,
  EffectTrace,
  EngineState,
  RegionId,
  RevealDeckId,
  RollResolution,
  StateDelta,
} from '../../engine/index.ts';
import {
  formatNumber,
  localizeActionField,
  localizeBeaconField,
  localizeCardField,
  localizeDomainField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../i18n/index.ts';

export interface PresentedHistoryCardReveal {
  key: string;
  deckLabel: string;
  seatLabel: string | null;
  title: string;
  body: string;
}

export interface PresentedHistoryRoll {
  formula: string;
  target: string;
  outcome: string;
  meaning: string;
}

export interface PresentedHistoryDelta {
  key: string;
  label: string;
  value: string;
}

export interface PresentedHistoryTrace {
  key: string;
  title: string;
  status: string;
  detail: string | null;
  deltas: PresentedHistoryDelta[];
}

export interface PresentedHistoryEvent {
  title: string;
  sourceLabel: string;
  contextLabel: string | null;
  cardReveals: PresentedHistoryCardReveal[];
  roll: PresentedHistoryRoll | null;
  deltas: PresentedHistoryDelta[];
  traces: PresentedHistoryTrace[];
}

function formatSeatLabel(seat: number) {
  return t('ui.game.seat', 'Seat {{seat}}', { seat: seat + 1 });
}

function getRevealTitle(content: CompiledContent, reveal: CardRevealEvent) {
  if (reveal.deckId === 'beacon') {
    const beacon = content.beacons[reveal.cardId];
    return {
      title: localizeBeaconField(reveal.cardId, 'title', beacon?.title ?? reveal.cardId),
      body: localizeBeaconField(reveal.cardId, 'description', beacon?.description ?? ''),
    };
  }

  const card = content.cards[reveal.cardId];
  return {
    title: localizeCardField(reveal.cardId, 'name', card?.name ?? reveal.cardId),
    body: localizeCardField(reveal.cardId, 'text', card?.text ?? ''),
  };
}

export function getRevealDeckLabel(deckId: RevealDeckId) {
  switch (deckId) {
    case 'system':
      return t('ui.game.systemDeck', 'System Deck');
    case 'resistance':
      return t('ui.game.resistanceDeck', 'Resistance Deck');
    case 'crisis':
      return t('ui.game.crisisDeck', 'Crisis Deck');
    case 'beacon':
      return t('ui.game.beaconDeck', 'Beacon Deck');
  }
}

export function getEventSourceLabel(sourceType: DomainEvent['sourceType']) {
  switch (sourceType) {
    case 'system':
      return t('ui.game.sourceSystem', 'System record');
    case 'command':
      return t('ui.game.sourceCommand', 'Table order');
    case 'action':
      return t('ui.game.sourceAction', 'Prepared move');
    case 'card':
      return t('ui.game.sourceCard', 'Card record');
    case 'mandate':
      return t('ui.game.sourceMandate', 'Secret Mandate record');
    case 'beacon':
      return t('ui.game.sourceBeacon', 'Beacon record');
  }
}

function formatSigned(value: number) {
  if (value === 0) {
    return formatNumber(0);
  }
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function pluralToken(count: number, singularKey: string, singularFallback: string, pluralKey: string, pluralFallback: string) {
  return count === 1 ? t(singularKey, singularFallback) : t(pluralKey, pluralFallback);
}

function getRollOutcomeMeaning(roll: RollPresentationInput, content: CompiledContent) {
  const parts: string[] = [];
  if (roll.extractionRemoved > 0) {
    parts.push(t('ui.history.rollMeaningExtractionRemoved', 'Remove {{count}} {{token}}.', {
      count: roll.extractionRemoved,
      token: pluralToken(
        roll.extractionRemoved,
        'ui.history.extractionTokenSingular',
        'Extraction Token',
        'ui.history.extractionTokenPlural',
        'Extraction Tokens',
      ),
    }));
  }
  if (roll.domainDelta !== 0) {
    parts.push(t('ui.history.rollMeaningDomain', '{{direction}} {{domain}} by {{count}}.', {
      direction: roll.domainDelta > 0
        ? t('ui.history.advance', 'Advance')
        : t('ui.history.reduce', 'Reduce'),
      domain: localizeDomainField(roll.domainId, 'name', content.domains[roll.domainId].name),
      count: Math.abs(roll.domainDelta),
    }));
  }
  if (roll.globalGazeDelta !== 0) {
    parts.push(t('ui.history.rollMeaningGaze', '{{direction}} Global Gaze by {{count}}.', {
      direction: roll.globalGazeDelta > 0
        ? t('ui.history.raise', 'Raise')
        : t('ui.history.lower', 'Lower'),
      count: Math.abs(roll.globalGazeDelta),
    }));
  }
  if (roll.warMachineDelta !== 0) {
    parts.push(t('ui.history.rollMeaningWarMachine', '{{direction}} War Machine by {{count}}.', {
      direction: roll.warMachineDelta > 0
        ? t('ui.history.raise', 'Raise')
        : t('ui.history.lower', 'Lower'),
      count: Math.abs(roll.warMachineDelta),
    }));
  }

  if (parts.length === 0) {
    return t('ui.history.rollMeaningNone', 'No board change followed from the roll.');
  }

  return parts.join(' ');
}

type RollPresentationInput = Pick<
  RollResolution,
  | 'dice'
  | 'modifier'
  | 'total'
  | 'target'
  | 'outcomeBand'
  | 'extractionRemoved'
  | 'domainDelta'
  | 'globalGazeDelta'
  | 'warMachineDelta'
  | 'domainId'
>;

export function presentRoll(roll: RollPresentationInput, content: CompiledContent): PresentedHistoryRoll {
  return {
    formula: `${formatNumber(roll.dice[0])} + ${formatNumber(roll.dice[1])} + ${formatSigned(roll.modifier)} = ${formatNumber(roll.total)}`,
    target: t('ui.history.rollTarget', 'Target {{target}}+', { target: roll.target }),
    outcome: {
      backlash: t('ui.history.rollOutcomeBacklash', 'Backlash'),
      attention: t('ui.history.rollOutcomeAttention', 'Setback'),
      success: t('ui.history.rollOutcomeSuccess', 'Success'),
      surge: t('ui.history.rollOutcomeSurge', 'Strong success'),
    }[roll.outcomeBand],
    meaning: getRollOutcomeMeaning(roll, content),
  };
}

function getRegionFromDeltaLabel(label: string): RegionId | null {
  const regionId = label.split('.')[0] ?? '';
  return ['Congo', 'Levant', 'Amazon', 'Sahel', 'Mekong', 'Andes'].includes(regionId) ? regionId as RegionId : null;
}

function getSeatFromDeltaLabel(label: string) {
  const match = label.match(/seat:(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatDeltaLabel(delta: StateDelta, content: CompiledContent) {
  switch (delta.kind) {
    case 'track':
      if (delta.label === 'globalGaze') {
        return t('ui.game.globalGaze', 'Global Gaze');
      }
      if (delta.label === 'northernWarMachine') {
        return t('ui.game.northernWarMachine', 'War Machine');
      }
      if (delta.label === 'failedCampaigns') {
        return t('ui.history.failedCampaigns', 'Failed campaigns');
      }
      return delta.label;
    case 'domain':
      return localizeDomainField(delta.label as keyof typeof content.domains, 'name', content.domains[delta.label as keyof typeof content.domains]?.name ?? delta.label);
    case 'extraction': {
      const regionId = getRegionFromDeltaLabel(delta.label);
      const regionLabel = regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : delta.label;
      return `${regionLabel} · ${t('ui.game.extractionTokens', 'Extraction Tokens')}`;
    }
    case 'defense': {
      const regionId = getRegionFromDeltaLabel(delta.label);
      const regionLabel = regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : delta.label;
      return `${regionLabel} · ${t('ui.game.defense', 'Defense')}`;
    }
    case 'bodies': {
      const regionId = getRegionFromDeltaLabel(delta.label);
      const seat = getSeatFromDeltaLabel(delta.label);
      const regionLabel = regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : delta.label;
      return seat === null
        ? `${regionLabel} · ${t('ui.game.bodies', 'Bodies')}`
        : `${regionLabel} · ${formatSeatLabel(seat)} · ${t('ui.game.bodies', 'Bodies')}`;
    }
    case 'evidence': {
      const seat = getSeatFromDeltaLabel(delta.label);
      return seat === null ? t('ui.game.evidence', 'Evidence') : `${formatSeatLabel(seat)} · ${t('ui.game.evidence', 'Evidence')}`;
    }
    case 'card':
      return {
        'system:active': t('ui.history.systemEscalations', 'System escalations'),
        'resistance:discard': t('ui.history.resistanceDiscard', 'Resistance discard'),
        'crisis:discard': t('ui.history.crisisDiscard', 'Crisis discard'),
      }[delta.label] ?? t('ui.history.cardsChanged', 'Cards');
    case 'player':
      return delta.label;
  }
}

export function presentDelta(delta: StateDelta, content: CompiledContent): PresentedHistoryDelta {
  return {
    key: `${delta.kind}:${delta.label}:${String(delta.before)}:${String(delta.after)}`,
    label: formatDeltaLabel(delta, content),
    value: `${String(delta.before)} → ${String(delta.after)}`,
  };
}

function getTraceTitle(trace: EffectTrace, content: CompiledContent) {
  const actionId = trace.effectType as ActionId;
  if (content.actions[actionId]) {
    return localizeActionField(actionId, 'name', content.actions[actionId].name);
  }

  switch (trace.effectType) {
    case 'draw_resistance':
      return t('ui.history.drawResistance', 'Draw Resistance');
    case 'modify_gaze':
      return t('ui.history.modifyGaze', 'Modify Global Gaze');
    case 'modify_war_machine':
      return t('ui.history.modifyWarMachine', 'Modify War Machine');
    case 'modify_domain':
      return t('ui.history.modifyDomain', 'Modify Domain');
    case 'add_extraction':
      return t('ui.history.addExtraction', 'Add Extraction Tokens');
    case 'remove_extraction':
      return t('ui.history.removeExtraction', 'Remove Extraction Tokens');
    case 'add_bodies':
    case 'remove_bodies':
      return t('ui.history.modifyBodies', 'Modify Bodies');
    case 'gain_evidence':
    case 'lose_evidence':
      return t('ui.history.modifyEvidence', 'Modify Evidence');
    case 'set_defense':
      return t('ui.history.setDefense', 'Set Defense');
    case 'log':
      return t('ui.history.logEffect', 'Log effect');
    case 'system_phase':
      return t('ui.history.systemPhase', 'System Phase');
    case 'resolution_phase':
      return t('ui.history.resolutionPhase', 'Resolution Phase');
    default:
      return trace.effectType;
  }
}

function getTraceDetail(trace: EffectTrace, content: CompiledContent) {
  if (trace.effectType === 'log') {
    return trace.message || null;
  }

  if (trace.effectType === 'launch_campaign') {
    return null;
  }

  if (trace.deltas.length > 0) {
    return trace.deltas
      .map((delta) => {
        const presented = presentDelta(delta, content);
        return `${presented.label} ${presented.value}`;
      })
      .join(' • ');
  }

  return null;
}

export function presentTrace(trace: EffectTrace, content: CompiledContent): PresentedHistoryTrace {
  return {
    key: `${trace.effectType}:${trace.status}:${trace.deltas.length}`,
    title: getTraceTitle(trace, content),
    status: {
      executed: t('ui.history.traceExecuted', 'Executed'),
      skipped: t('ui.history.traceSkipped', 'Skipped'),
      failed: t('ui.history.traceFailed', 'Failed'),
    }[trace.status],
    detail: getTraceDetail(trace, content),
    deltas: trace.deltas.map((delta) => presentDelta(delta, content)),
  };
}

function presentCardReveals(event: DomainEvent, content: CompiledContent): PresentedHistoryCardReveal[] {
  return (event.context?.cardReveals ?? []).map((reveal, index) => {
    const copy = getRevealTitle(content, reveal);
    return {
      key: `${event.seq}:${index}:${reveal.deckId}:${reveal.cardId}`,
      deckLabel: getRevealDeckLabel(reveal.deckId),
      seatLabel: typeof reveal.seat === 'number' ? formatSeatLabel(reveal.seat) : null,
      title: copy.title,
      body: copy.body,
    };
  });
}

function getEventContextLabel(event: DomainEvent, content: CompiledContent) {
  const parts = [getEventSourceLabel(event.sourceType)];
  if (typeof event.context?.actingSeat === 'number') {
    parts.push(formatSeatLabel(event.context.actingSeat));
  }
  if (event.context?.targetRegionId) {
    parts.push(localizeRegionField(event.context.targetRegionId, 'name', content.regions[event.context.targetRegionId].name));
  }
  if (event.context?.targetDomainId) {
    parts.push(localizeDomainField(event.context.targetDomainId, 'name', content.domains[event.context.targetDomainId].name));
  }
  return parts.filter(Boolean).join(' • ');
}

function getEventTitle(event: DomainEvent, content: CompiledContent) {
  const reveal = event.context?.cardReveals?.[0];
  if (reveal) {
    const revealCopy = getRevealTitle(content, reveal);
    if (reveal.origin === 'opening_hand' && typeof reveal.seat === 'number') {
      return t('ui.history.eventOpeningDraw', '🃏 {{seat}} drew an opening resistance card.', {
        seat: formatSeatLabel(reveal.seat),
      });
    }
    if (reveal.origin === 'investigate' && typeof reveal.seat === 'number') {
      return t('ui.history.eventInvestigateDraw', '🃏 {{seat}} drew a resistance card.', {
        seat: formatSeatLabel(reveal.seat),
      });
    }
    if (reveal.origin === 'played_action_card' && typeof reveal.seat === 'number') {
      return t('ui.history.eventPlayedCard', '🃏 {{seat}} played {{card}}.', {
        seat: formatSeatLabel(reveal.seat),
        card: revealCopy.title,
      });
    }
    if (reveal.origin === 'beacon_activation') {
      return t('ui.history.eventBeaconActivated', '🕯️ {{card}} became an active Beacon.', {
        card: revealCopy.title,
      });
    }
    if (reveal.deckId === 'system' || reveal.deckId === 'crisis') {
      return revealCopy.title;
    }
  }

  switch (event.sourceId) {
    case 'QueueIntent':
      if (typeof event.context?.actingSeat === 'number' && event.context?.actionId) {
        return t('ui.history.eventQueueIntent', '{{seat}} prepared {{action}}.', {
          seat: formatSeatLabel(event.context.actingSeat),
          action: localizeActionField(event.context.actionId, 'name', content.actions[event.context.actionId].name),
        });
      }
      break;
    case 'RemoveQueuedIntent':
      if (typeof event.context?.actingSeat === 'number') {
        return t('ui.history.eventRemoveIntent', '{{seat}} removed a prepared move.', {
          seat: formatSeatLabel(event.context.actingSeat),
        });
      }
      break;
    case 'ReorderQueuedIntent':
      if (typeof event.context?.actingSeat === 'number') {
        return t('ui.history.eventReorderIntent', '{{seat}} reordered prepared moves.', {
          seat: formatSeatLabel(event.context.actingSeat),
        });
      }
      break;
    case 'SetReady':
      if (typeof event.context?.actingSeat === 'number') {
        return event.context.readyState
          ? t('ui.history.eventSeatReady', '{{seat}} marked ready.', { seat: formatSeatLabel(event.context.actingSeat) })
          : t('ui.history.eventSeatNotReady', '{{seat}} is no longer ready.', { seat: formatSeatLabel(event.context.actingSeat) });
      }
      break;
    case 'ResolveSystemPhase':
      return t('ui.history.eventSystemResolved', 'System Phase resolved.');
    case 'CommitCoalitionIntent':
      return t('ui.history.eventCoalitionCommitted', 'Coalition prepared moves resolved.');
    case 'ResolveResolutionPhase':
      return t('ui.history.eventResolutionResolved', 'Resolution Phase completed.');
    case 'launch_campaign':
      if (typeof event.context?.actingSeat === 'number' && event.context.targetRegionId) {
        return t('ui.history.eventLaunchCampaign', '{{seat}} launched a campaign in {{region}}.', {
          seat: formatSeatLabel(event.context.actingSeat),
          region: localizeRegionField(event.context.targetRegionId, 'name', content.regions[event.context.targetRegionId].name),
        });
      }
      break;
    case 'extraction_breach':
      return t('ui.history.eventExtractionBreach', 'A region reached 6 Extraction Tokens.');
    case 'mandate_failure':
      return t('ui.history.eventMandateFailure', 'Public victory failed because Secret Mandates were broken.');
    case 'victory':
      return t('ui.history.eventVictory', 'The coalition achieved victory.');
    case 'sudden_death':
      return t('ui.history.eventSuddenDeath', 'Sudden death ended the struggle.');
    case 'public_attention':
      return t('ui.history.eventPublicAttention', 'System pressure shifted under public attention.');
    case 'game_start': {
      const mode = event.message.includes('SYMBOLIC')
        ? t('ui.mode.symbolic', 'Symbolic')
        : t('ui.mode.liberation', 'Liberation');
      return t('ui.history.eventGameStart', '🌍 {{ruleset}} begins in {{mode}} mode.', {
        ruleset: localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name),
        mode,
      });
    }
  }

  return event.message;
}

export function presentHistoryEvent(event: DomainEvent, content: CompiledContent): PresentedHistoryEvent {
  return {
    title: getEventTitle(event, content),
    sourceLabel: getEventSourceLabel(event.sourceType),
    contextLabel: getEventContextLabel(event, content),
    cardReveals: presentCardReveals(event, content),
    roll: event.context?.roll ? presentRoll(event.context.roll, content) : null,
    deltas: event.deltas.map((delta) => presentDelta(delta, content)),
    traces: event.trace.map((trace) => presentTrace(trace, content)),
  };
}

export function localizeDisabledReason(reason: Pick<DisabledActionReason, 'reasonCode' | 'reasonValues' | 'reason'>) {
  switch (reason.reasonCode) {
    case 'unknown_seat':
      return t('ui.game.unknownSeat', 'Unknown seat');
    case 'phase_locked':
      return t('ui.game.phaseLocked', 'Phase locked');
    case 'seat_already_ready':
      return t('ui.game.seatAlreadyReady', 'Seat already ready');
    case 'no_actions_remaining':
      return t('ui.game.noActionsRemaining', 'No actions remaining');
    case 'select_region':
      return t('ui.game.selectRegion', 'Select a region');
    case 'select_domain':
      return t('ui.game.selectDomain', 'Select a domain');
    case 'select_another_seat':
      return t('ui.game.selectAnotherSeat', 'Select another seat');
    case 'need_three_bodies':
      return t('ui.game.needThreeBodies', 'Need 3 Comrades in region');
    case 'not_enough_evidence':
      return t('ui.game.notEnoughEvidence', 'Not enough Evidence');
    case 'no_evidence_to_move':
      return t('ui.game.noEvidenceToMove', 'No Evidence to move');
    case 'need_one_body':
      return t('ui.game.needOneBody', 'Need 1 Comrade in region');
    case 'commit_one_body':
      return t('ui.game.commitOneBody', 'Commit at least 1 body');
    case 'not_enough_bodies':
      return t('ui.game.notEnoughBodies', 'Not enough Comrades in region');
    case 'support_card_unavailable':
      return t('ui.game.supportCardUnavailable', 'Support card unavailable');
    case 'action_card_unavailable':
      return t('ui.game.actionCardUnavailable', 'Action card unavailable');
    case 'select_card':
      return t('ui.game.selectCard', 'Select a card');
    default:
      return reason.reason;
  }
}

export function getTerminalStateLabel(state: EngineState, content: CompiledContent) {
  let terminalEvent: DomainEvent | null = null;
  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.eventLog[index];
    if (event?.phase === state.phase) {
      terminalEvent = event;
      break;
    }
  }
  if (terminalEvent) {
    return presentHistoryEvent(terminalEvent, content).title;
  }
  if (state.phase === 'WIN') {
    return t('ui.history.eventVictory', 'The coalition achieved victory.');
  }
  if (state.phase === 'LOSS') {
    return t('ui.history.eventLoss', 'The coalition lost the struggle.');
  }
  return null;
}
