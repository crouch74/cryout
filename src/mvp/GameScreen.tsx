import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  getAvailableDomains,
  getAvailableRegions,
  getPlayerBodyTotal,
  getSeatActions,
  getSeatDisabledReason,
  getSeatFaction,
  serializeGame,
  type ActionId,
  type CompiledContent,
  type DomainId,
  type EngineCommand,
  type EngineState,
  type Effect,
  type QueuedIntent,
  type RegionId,
  type RollResolution,
  type SystemPersistentModifiers,
} from '../../engine/index.ts';
import {
  formatNumber,
  localizeActionField,
  localizeCardField,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../i18n/index.ts';
import { ActionDock } from './ActionDock.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { playDeckCue, primeDeckAudio } from './deckSound.ts';
import { DebugOverlay, type AutoPlaySpeedLevel } from './DebugOverlay.tsx';
import { FrontTrackBar } from './FrontTrackBar.tsx';
import { Icon } from './icons/Icon.tsx';
import type { IconType } from './icons/iconTypes.ts';
import { PlayerStrip } from './PlayerStrip.tsx';
import { PhaseProgress } from './PhaseProgress.tsx';
import { StatusRibbon } from './StatusRibbon.tsx';
import { localizeDisabledReason, presentHistoryEvent } from './historyPresentation.ts';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';
import {
  buildIntentPreview,
  getActionDockItems,
  getActionQuickQueue,
  getDeckSummaries,
  getFrontTrackRows,
  getNextUnfinishedCoalitionSeat,
  getPhasePresentation,
  getPlayerStripSummary,
  getStatusRibbonItems,
  type ContextPanelMode,
} from './gameUiHelpers.ts';
import { CrisisCard, DeckBackArt, DeckStack, LocaleSwitcher, TableSurface, ThemePlate, useTabletopTheme } from './tabletop.tsx';
import type { GameViewState } from './urlState.ts';
import { WorldMapBoard } from './WorldMapBoard.tsx';

interface GameScreenProps {
  devMode: boolean;
  surface: 'local' | 'room';
  roomId?: string | null;
  state: EngineState;
  content: CompiledContent;
  viewState: GameViewState;
  onViewStateChange: (patch: Partial<GameViewState>) => void;
  onCommand: (command: EngineCommand) => Promise<void> | void;
  onToast: (toast: { tone: 'info' | 'success' | 'warning' | 'error'; message: string; title?: string; dismissAfterMs?: number }) => void;
  onBack: () => void;
  onExportSave: (serialized: string) => void;
  authorizedSeat?: number | null;
}

const DOMAIN_IDS = getAvailableDomains();
const REGION_IDS = getAvailableRegions();
const AUTOPLAY_SPEED_DELAYS: Record<AutoPlaySpeedLevel, number> = {
  1: 1800,
  2: 1300,
  3: 900,
  4: 600,
  5: 320,
};
const TERMINAL_PHASES: EngineState['phase'][] = ['WIN', 'LOSS'];
const VISIBLE_DECK_IDS = ['system', 'resistance', 'crisis'] as const;

type VisibleDeckId = typeof VISIBLE_DECK_IDS[number];

type DraftState = Omit<QueuedIntent, 'slot'>;

interface CampaignRollPresentation extends RollResolution {
  seq: number;
  dieOne: number;
  dieTwo: number;
  rolling: boolean;
}

interface CardRevealQueueItem {
  key: string;
  eventSeq: number;
  revealIndex: number;
  deckId: VisibleDeckId;
  cardId: string;
}

type CardRevealStage = 'lift' | 'travel' | 'flip' | 'settle' | 'dismiss';

interface CardRevealOrigin {
  x: number;
  y: number;
  rotation: number;
}

interface PhaseInsight {
  id: string;
  label: string;
  detail: string;
}

interface VisualDeltaGlyph {
  id: string;
  icon: IconType;
  value: string;
  tone: 'track' | 'region' | 'resource' | 'card' | 'player';
  ariaLabel: string;
}

interface VisualDeltaTile {
  id: string;
  emoji: string;
  phaseIcon: string;
  glyphs: VisualDeltaGlyph[];
  ariaLabel: string;
  targetKeys: string[];
}

const DOMAIN_DELTA_ICONS: Record<DomainId, IconType> = {
  WarMachine: 'frontWar',
  DyingPlanet: 'frontPlanet',
  GildedCage: 'frontCage',
  SilencedTruth: 'frontTruth',
  EmptyStomach: 'frontHunger',
  FossilGrip: 'frontFossil',
  StolenVoice: 'frontVoice',
};

function createDraft(actionId: ActionId): DraftState {
  return {
    actionId,
    regionId: REGION_IDS[0],
    domainId: DOMAIN_IDS[0],
    targetSeat: 1,
    bodiesCommitted: 1,
    evidenceCommitted: 0,
    cardId: undefined,
  };
}

function getActionButtonLabel(phase: EngineState['phase']) {
  switch (phase) {
    case 'SYSTEM':
      return t('ui.game.resolveSystemPhase', 'Resolve System Phase');
    case 'COALITION':
      return t('ui.game.commitCoalitionIntent', 'Commit Prepared Moves');
    case 'RESOLUTION':
      return t('ui.game.resolveResolutionPhase', 'Resolve Resolution Phase');
    default:
      return t('ui.game.tableClosed', 'Table Closed');
  }
}

function getPhaseControlHint(state: EngineState, focusedSeat: number) {
  if (state.phase === 'SYSTEM') {
    return t('ui.game.systemPhaseHint', 'Resolve the Crisis draw and any System escalation to open coalition planning.');
  }

  if (state.phase === 'COALITION') {
    const player = state.players[focusedSeat];
    if (!player) {
      return t('ui.game.coalitionPhaseHint', 'Prepare moves, then mark every seat ready.');
    }
    if (player.actionsRemaining > 0) {
      return t('ui.game.coalitionMovesRemainingHint', 'Prepare both moves for this seat before marking it ready.');
    }
    if (!state.players.every((seat) => seat.ready)) {
      return t('ui.game.coalitionWaitingHint', 'Every seat must be marked ready before the coalition can resolve.');
    }
    return t('ui.game.coalitionResolveHint', 'The coalition is ready. Resolve the prepared moves.');
  }

  if (state.phase === 'RESOLUTION') {
    return t('ui.game.resolutionPhaseHint', 'Check the aftermath, then begin the next round.');
  }

  return t('ui.game.tableClosed', 'Table Closed');
}

function getLatestCampaignRoll(state: EngineState): CampaignRollPresentation | null {
  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.eventLog[index];
    const roll = event?.context?.roll;
    if (!roll) {
      continue;
    }

    return {
      seq: event.seq,
      actionId: roll.actionId,
      seat: roll.seat,
      regionId: roll.regionId,
      domainId: roll.domainId,
      dice: roll.dice,
      total: roll.total,
      modifier: roll.modifier,
      dieOne: roll.dice[0],
      dieTwo: roll.dice[1],
      target: roll.target,
      success: roll.success,
      outcomeBand: roll.outcomeBand,
      extractionRemoved: roll.extractionRemoved,
      domainDelta: roll.domainDelta,
      globalGazeDelta: roll.globalGazeDelta,
      warMachineDelta: roll.warMachineDelta,
      rolling: false,
    };
  }

  return null;
}

function getLatestRevealCardIdForDeck(state: EngineState, deckId: VisibleDeckId) {
  for (let eventIndex = state.eventLog.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const reveals = state.eventLog[eventIndex]?.context?.cardReveals;
    if (!reveals?.length) {
      continue;
    }

    for (let revealIndex = reveals.length - 1; revealIndex >= 0; revealIndex -= 1) {
      const reveal = reveals[revealIndex];
      if (reveal?.deckId === deckId) {
        return reveal.cardId;
      }
    }
  }

  return null;
}

function getRevealCopy(
  content: CompiledContent,
  _deckId: VisibleDeckId,
  cardId: string,
) {
  const card = content.cards[cardId];
  return {
    title: localizeCardField(cardId, 'name', card?.name ?? cardId),
    body: localizeCardField(cardId, 'text', card?.text ?? ''),
  };
}

function getRevealMotionProfile(deckId: VisibleDeckId) {
  switch (deckId) {
    case 'system':
      return {
        liftMs: 220,
        travelMs: 480,
        flipMs: 400,
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        glow: 'rgba(122, 30, 30, 0.12)',
        rotation: 0,
      };
    case 'resistance':
      return {
        liftMs: 180,
        travelMs: 400,
        flipMs: 420,
        ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
        glow: 'rgba(200, 167, 94, 0.10)',
        rotation: -1.5,
      };
    case 'crisis':
      return {
        liftMs: 160,
        travelMs: 420,
        flipMs: 380,
        ease: 'cubic-bezier(0.28, 0.82, 0.34, 1)',
        glow: 'rgba(138, 59, 47, 0.14)',
        rotation: ((Math.abs(deckId.length * 7) % 6) - 3) || 2,
      };
  }
}

function getRevealActionLabel(deckId: VisibleDeckId) {
  return deckId === 'resistance'
    ? t('ui.game.confirmCard', 'Confirm')
    : t('ui.game.resolveCard', 'Resolve');
}

function getPrintedDeckTitle(deckId: VisibleDeckId) {
  switch (deckId) {
    case 'system':
      return t('ui.game.systemDeckPrinted', 'System');
    case 'resistance':
      return t('ui.game.resistanceDeckPrinted', 'Resistance');
    case 'crisis':
      return t('ui.game.crisisDeckPrinted', 'Crisis');
  }
}

function formatSignedLabel(value: number, label: string) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)} ${label}`;
}

function summarizeCardEffect(effect: Effect, content: CompiledContent) {
  switch (effect.type) {
    case 'modify_gaze':
      return formatSignedLabel(effect.delta, t('ui.game.globalGaze', 'Global Gaze'));
    case 'modify_war_machine':
      return formatSignedLabel(effect.delta, t('ui.game.northernWarMachine', 'War Machine'));
    case 'modify_domain':
      return typeof effect.domain === 'string' && effect.domain !== 'target_domain'
        ? formatSignedLabel(effect.delta, localizeDomainField(effect.domain, 'name', content.domains[effect.domain].name))
        : formatSignedLabel(effect.delta, t('ui.game.domain', 'Domain'));
    case 'add_extraction':
      return formatSignedLabel(effect.amount, t('ui.game.extractionTokens', 'Extraction Tokens'));
    case 'remove_extraction':
      return formatSignedLabel(effect.amount * -1, t('ui.game.extractionTokens', 'Extraction Tokens'));
    case 'add_bodies':
      return formatSignedLabel(effect.amount, t('ui.game.bodies', 'Bodies'));
    case 'remove_bodies':
      return formatSignedLabel(effect.amount * -1, t('ui.game.bodies', 'Bodies'));
    case 'gain_evidence':
      return formatSignedLabel(effect.amount, t('ui.game.evidence', 'Evidence'));
    case 'lose_evidence':
      return formatSignedLabel(effect.amount * -1, t('ui.game.evidence', 'Evidence'));
    case 'set_defense':
      return `${t('ui.game.defense', 'Defense')} ${formatNumber(effect.amount)}`;
    case 'draw_resistance':
      return formatSignedLabel(effect.count, t('ui.game.resistanceDeckPrinted', 'Resistance'));
    case 'log':
      return null;
  }
}

function getPersistentModifierChips(persistentModifiers: SystemPersistentModifiers | undefined) {
  if (!persistentModifiers) {
    return [];
  }

  const chips: string[] = [];
  if (persistentModifiers.campaignTargetDelta) {
    chips.push(t('ui.game.campaignTargetShift', 'Campaign target +{{count}}', { count: persistentModifiers.campaignTargetDelta }));
  }
  if (persistentModifiers.campaignModifierDelta) {
    chips.push(t('ui.game.campaignRollShift', 'Campaign roll {{count}}', { count: persistentModifiers.campaignModifierDelta }));
  }
  if (persistentModifiers.outreachCostDelta) {
    chips.push(t('ui.game.outreachCostShift', 'Outreach cost +{{count}}', { count: persistentModifiers.outreachCostDelta }));
  }
  if (persistentModifiers.resistanceDrawDelta) {
    chips.push(t('ui.game.resistanceDrawShift', 'Resistance draw {{count}}', { count: persistentModifiers.resistanceDrawDelta }));
  }
  if (persistentModifiers.crisisDrawDelta) {
    chips.push(t('ui.game.crisisDrawShift', 'Crisis draw +{{count}}', { count: persistentModifiers.crisisDrawDelta }));
  }
  if (persistentModifiers.crisisExtractionBonus) {
    chips.push(t('ui.game.crisisExtractionShift', 'Crisis extraction +{{count}}', { count: persistentModifiers.crisisExtractionBonus }));
  }
  return chips;
}

function getRevealSummaryChips(content: CompiledContent, _deckId: VisibleDeckId, cardId: string) {
  const card = content.cards[cardId];
  if (!card) {
    return [];
  }

  const chips: string[] = [];
  if (card.deck === 'resistance') {
    chips.push(card.type === 'support' ? t('ui.game.supportCard', 'Support Card') : t('ui.game.actionCard', 'Action Card'));
    if (typeof card.campaignBonus === 'number') {
      chips.push(t('ui.game.campaignBonusChip', 'Campaign +{{count}}', { count: card.campaignBonus }));
    }
    if (card.domainBonus) {
      chips.push(localizeDomainField(card.domainBonus, 'name', content.domains[card.domainBonus].name));
    }
  }

  if (card.deck === 'system') {
    chips.push(t('ui.game.persistentEscalation', 'Persistent escalation'));
    chips.push(...getPersistentModifierChips(card.persistentModifiers));
  }

  const effectList = card.deck === 'system' ? card.onReveal : card.effects ?? [];
  chips.push(...effectList.map((effect) => summarizeCardEffect(effect, content)).filter((chip): chip is string => Boolean(chip)));

  return [...new Set(chips)].slice(0, 3);
}

function getPhaseInsights(state: EngineState, focusedSeat: number): PhaseInsight[] {
  if (state.phase === 'SYSTEM') {
    return [
      {
        id: 'system-pressure',
        label: t('ui.game.phaseInsightPressure', 'Pressure rises'),
        detail: t('ui.game.phaseInsightSystemCards', 'Crisis cards strike each round, System escalations persist, and intervention pushes Extraction Tokens, War Machine pressure, and direct harm onto exposed regions.'),
      },
      {
        id: 'system-refresh',
        label: t('ui.game.phaseInsightReset', 'Coalition resets'),
        detail: t('ui.game.phaseInsightSystemRefresh', 'Defense clears, each seat regains two moves, and resolving this strike opens coalition planning.'),
      },
    ];
  }

  if (state.phase === 'COALITION') {
    const player = state.players[focusedSeat];
    return [
      {
        id: 'coalition-plan',
        label: t('ui.game.phaseInsightPlan', 'Plan together'),
        detail: t('ui.game.phaseInsightCoalitionPlan', 'Each seat prepares two moves. Costs and targets are locked now so the coalition can resolve in a shared order.'),
      },
      {
        id: 'coalition-ready',
        label: t('ui.game.phaseInsightReady', 'Ready the table'),
        detail: player?.actionsRemaining
          ? t('ui.game.phaseInsightCoalitionReadyPending', 'This seat still has moves to prepare before it can mark ready.')
          : t('ui.game.phaseInsightCoalitionReady', 'When every seat is ready, the prepared moves resolve and the board changes.'),
      },
    ];
  }

  return [
    {
      id: 'resolution-resolve',
      label: t('ui.game.phaseInsightResolve', 'Resolve consequences'),
      detail: t('ui.game.phaseInsightResolutionResolve', 'Prepared moves now change Domains, regions, Comrades, Evidence, and cards in priority order.'),
    },
    {
      id: 'resolution-check',
      label: t('ui.game.phaseInsightCheck', 'Check why the round ends'),
      detail: t('ui.game.phaseInsightResolutionCheck', 'After resolution, the game checks victory, defeat, Secret Mandates, and whether a new round begins.'),
    },
  ];
}

function getSignedDelta(before: number | string | boolean | null, after: number | string | boolean | null) {
  if (typeof before !== 'number' || typeof after !== 'number') {
    return null;
  }

  const amount = after - before;
  if (amount === 0) {
    return '0';
  }

  return `${amount > 0 ? '+' : ''}${formatNumber(amount)}`;
}

function getRegionIdFromDeltaLabel(label: string): RegionId | null {
  const regionId = label.split('.')[0] ?? '';
  return REGION_IDS.includes(regionId as RegionId) ? regionId as RegionId : null;
}

function getSeatFromDeltaLabel(label: string) {
  const match = label.match(/seat:(\d+)/);
  return match ? Number(match[1]) : null;
}

function getEventDeltas(event: EngineState['eventLog'][number]) {
  const seen = new Set<string>();

  return [event.deltas, ...event.trace.map((trace) => trace.deltas)]
    .flat()
    .filter((delta) => {
      const key = `${delta.kind}:${delta.label}:${String(delta.before)}:${String(delta.after)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function getVisualDeltaGlyph(delta: EngineState['eventLog'][number]['deltas'][number], content: CompiledContent) {
  const signedDelta = getSignedDelta(delta.before, delta.after);

  switch (delta.kind) {
    case 'track': {
      const isGaze = delta.label === 'globalGaze';
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: isGaze ? 'globalGaze' : 'warMachine',
          value: signedDelta ?? '*',
          tone: 'track',
          ariaLabel: `${isGaze ? t('ui.game.globalGaze', 'Global Gaze') : t('ui.game.northernWarMachine', 'War Machine')} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: [isGaze ? 'globalGaze' : 'warMachine'],
      };
    }
    case 'domain': {
      const domainId = delta.label as DomainId;
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: DOMAIN_DELTA_ICONS[domainId],
          value: signedDelta ?? '*',
          tone: 'track',
          ariaLabel: `${localizeDomainField(domainId, 'name', content.domains[domainId].name)} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: [domainId],
      };
    }
    case 'extraction': {
      const regionId = getRegionIdFromDeltaLabel(delta.label);
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'extraction',
          value: signedDelta ?? '*',
          tone: 'region',
          ariaLabel: `${regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : t('ui.game.extractionTokens', 'Extraction Tokens')} ${t('ui.game.extractionTokens', 'Extraction Tokens')} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: regionId ? [`region:${regionId}`, `region:${regionId}:extraction`] : [],
      };
    }
    case 'defense': {
      const regionId = getRegionIdFromDeltaLabel(delta.label);
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'defense',
          value: signedDelta ?? '*',
          tone: 'region',
          ariaLabel: `${regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : t('ui.game.defense', 'Defense')} ${t('ui.game.defense', 'Defense')} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: regionId ? [`region:${regionId}`, `region:${regionId}:defense`] : [],
      };
    }
    case 'bodies': {
      const regionId = getRegionIdFromDeltaLabel(delta.label);
      const seat = getSeatFromDeltaLabel(delta.label);
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'bodies',
          value: signedDelta ?? '*',
          tone: 'resource',
          ariaLabel: `${regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : t('ui.game.bodies', 'Bodies')} ${t('ui.game.bodies', 'Bodies')} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: [
          ...(regionId ? [`region:${regionId}`, `region:${regionId}:bodies`] : []),
          ...(seat === null ? [] : [`player:${seat}:bodies`]),
        ],
      };
    }
    case 'evidence': {
      const seat = getSeatFromDeltaLabel(delta.label);
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'evidence',
          value: signedDelta ?? '*',
          tone: 'resource',
          ariaLabel: `${t('ui.game.evidence', 'Evidence')} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: seat === null ? [] : [`player:${seat}:evidence`],
      };
    }
    case 'card':
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'playCard',
          value: '+',
          tone: 'card',
          ariaLabel: t('ui.game.cardsChanged', 'Cards changed'),
        } satisfies VisualDeltaGlyph,
        targetKeys: [],
      };
    case 'player':
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'seat',
          value: signedDelta ?? '*',
          tone: 'player',
          ariaLabel: `${delta.label} ${signedDelta ?? ''}`.trim(),
        } satisfies VisualDeltaGlyph,
        targetKeys: [],
      };
  }
}

function getRecentVisualDeltaTiles(state: EngineState, content: CompiledContent): VisualDeltaTile[] {
  return state.eventLog
    .slice()
    .reverse()
    .filter((event) => event.deltas.length > 0 || event.trace.some((trace) => trace.deltas.length > 0))
    .slice(0, 3)
    .map((event) => {
      const glyphEntries = getEventDeltas(event)
        .slice(0, 3)
        .map((delta) => getVisualDeltaGlyph(delta, content));
      const glyphs = glyphEntries.map((entry) => entry.glyph);
      const targetKeys = [...new Set(glyphEntries.flatMap((entry) => entry.targetKeys))];

      return {
        id: String(event.seq),
        emoji: event.emoji,
        phaseIcon: getPhasePresentation(event.phase).icon,
        glyphs,
        ariaLabel: `${presentHistoryEvent(event, content).title}. ${glyphs.map((glyph) => glyph.ariaLabel).join('. ')}`.trim(),
        targetKeys,
      };
    })
    .filter((tile) => tile.glyphs.length > 0);
}

function createAutoPlayIntent(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: ActionId,
): Omit<QueuedIntent, 'slot'> | null {
  const action = content.actions[actionId];
  const player = state.players[seat];
  if (!action || !player) {
    return null;
  }

  const compatibleCardId = player.resistanceHand.find((cardId) => {
    const card = content.cards[cardId];
    return card?.deck === 'resistance' && (!action.cardType || card.type === action.cardType);
  });
  const regionCandidates = action.needsRegion ? REGION_IDS : [undefined];
  const domainCandidates = action.needsDomain ? [...DOMAIN_IDS] : [undefined];
  const targetSeatCandidates = action.needsTargetSeat
    ? state.players.filter((candidate) => candidate.seat !== seat).map((candidate) => candidate.seat)
    : [undefined];

  for (const regionId of regionCandidates) {
    const bodiesInRegion = regionId ? state.regions[regionId].bodiesPresent[seat] ?? 0 : 0;
    const maxBodies = action.needsBodies ? Math.max(1, bodiesInRegion) : 1;
    const bodyCandidates = action.needsBodies
      ? Array.from({ length: maxBodies }, (_, index) => index + 1)
      : [undefined];
    const evidenceCandidates = action.needsEvidence
      ? Array.from({ length: Math.max(player.evidence, 0) + 1 }, (_, index) => index)
      : [undefined];

    for (const domainId of domainCandidates) {
      for (const targetSeat of targetSeatCandidates) {
        for (const bodiesCommitted of bodyCandidates) {
          for (const evidenceCommitted of evidenceCandidates) {
            const intent: Omit<QueuedIntent, 'slot'> = {
              actionId,
              regionId,
              domainId,
              targetSeat,
              bodiesCommitted,
              evidenceCommitted,
              cardId: action.needsCard ? compatibleCardId : undefined,
            };
            const disabledReason = getSeatDisabledReason(state, content, seat, intent);
            if (!disabledReason.disabled) {
              return intent;
            }
          }
        }
      }
    }
  }

  return null;
}

function getNextAutoPlayCommand(state: EngineState, content: CompiledContent): EngineCommand | null {
  if (state.phase === 'SYSTEM') {
    return { type: 'ResolveSystemPhase' };
  }

  if (state.phase === 'COALITION') {
    for (const player of state.players) {
      if (player.actionsRemaining > 0) {
        for (const action of getSeatActions(content)) {
          const intent = createAutoPlayIntent(state, content, player.seat, action.id);
          if (intent) {
            return {
              type: 'QueueIntent',
              seat: player.seat,
              action: intent,
            };
          }
        }
        return null;
      }

      if (!player.ready) {
        return { type: 'SetReady', seat: player.seat, ready: true };
      }
    }

    return { type: 'CommitCoalitionIntent' };
  }

  if (state.phase === 'RESOLUTION') {
    return { type: 'ResolveResolutionPhase' };
  }

  return null;
}

export function GameScreen({
  devMode,
  surface,
  roomId,
  state,
  content,
  viewState,
  onViewStateChange,
  onCommand,
  onToast,
  onBack,
  onExportSave,
  authorizedSeat,
}: GameScreenProps) {
  const { motionMode } = useTabletopTheme();
  const focusedSeat = authorizedSeat ?? viewState.focusedSeat;
  const focusedPlayer = state.players[focusedSeat] ?? state.players[0];
  const faction = getSeatFaction(state, content, focusedPlayer.seat);
  const [copied, setCopied] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextMode, setContextMode] = useState<ContextPanelMode>('ledger');
  const [selectedDeckId, setSelectedDeckId] = useState<VisibleDeckId>('system');
  const [draft, setDraft] = useState<DraftState>(() => createDraft('organize'));
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showDebugSnapshot, setShowDebugSnapshot] = useState(false);
  const [autoPlayRounds, setAutoPlayRounds] = useState('1');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<AutoPlaySpeedLevel>(3);
  const [autoPlayTargetRound, setAutoPlayTargetRound] = useState<number | null>(null);
  const [autoPlayRunning, setAutoPlayRunning] = useState(false);
  const [autoPlayStatus, setAutoPlayStatus] = useState<string | null>(null);
  const [activeCardRevealSeq, setActiveCardRevealSeq] = useState<number | null>(null);
  const [activeCardReveal, setActiveCardReveal] = useState<CardRevealQueueItem | null>(null);
  const [cardRevealStage, setCardRevealStage] = useState<CardRevealStage>('lift');
  const [activeCardRevealOrigin, setActiveCardRevealOrigin] = useState<CardRevealOrigin | null>(null);
  const [animatedCampaignRoll, setAnimatedCampaignRoll] = useState<CampaignRollPresentation | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const revealQueueRef = useRef<CardRevealQueueItem[]>([]);
  const revealSeenRef = useRef(new Set<string>());
  const revealTimerRef = useRef<number | null>(null);
  const revealPhaseTimerRef = useRef<number | null>(null);
  const revealCleanupTimerRef = useRef<number | null>(null);
  const lastCampaignRollSeqRef = useRef<number | null>(null);
  const revealActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const deckButtonRefs = useRef<Record<VisibleDeckId, HTMLButtonElement | null>>({
    system: null,
    resistance: null,
    crisis: null,
  });
  const selectedRegionId = viewState.regionId;

  const draftAction = content.actions[draft.actionId];
  const availableCards = focusedPlayer.resistanceHand
    .map((cardId) => content.cards[cardId])
    .filter((card) => card.deck === 'resistance' && (!draftAction.cardType || card.type === draftAction.cardType));
  const disabledReason = getSeatDisabledReason(state, content, focusedPlayer.seat, {
    ...draft,
    targetSeat: draft.targetSeat === focusedPlayer.seat ? undefined : draft.targetSeat,
  });
  const localizedDisabledReason = localizeDisabledReason(disabledReason);

  const statusItems = getStatusRibbonItems(state, content);
  const frontRows = getFrontTrackRows(state, content);
  const playerSummaries = state.players.map((player) => getPlayerStripSummary(player, content, state));
  const actionItems = getActionDockItems(state, content, focusedPlayer.seat);
  const phasePresentation = getPhasePresentation(state.phase);
  const preparedMovePreview = buildIntentPreview(draft, draftAction, state, content, focusedPlayer.seat);
  const latestCampaignRoll = useMemo(() => getLatestCampaignRoll(state), [state]);
  const deckSummaries = useMemo(() => getDeckSummaries(state, content), [content, state]);
  const phaseControlHint = getPhaseControlHint(state, focusedPlayer.seat);

  const ledgerGroups = useMemo(() => {
    const groups: Array<{ key: string; title: string; events: typeof state.eventLog }> = [];
    for (const event of state.eventLog.slice().reverse().slice(0, 10)) {
      const key = `${event.round}-${event.phase}`;
      const current = groups.at(-1);
      if (current && current.key === key) {
        current.events.push(event);
      } else {
        groups.push({
          key,
          title: `${t('ui.game.round', 'Round')} ${formatNumber(event.round)} • ${t(`ui.phases.${event.phase}`, event.phase)}`,
          events: [event],
        });
      }
    }
    return groups;
  }, [state.eventLog]);

  const queueIntent = (nextDraft: DraftState) => {
    const nextDisabledReason = getSeatDisabledReason(state, content, focusedPlayer.seat, {
      ...nextDraft,
      targetSeat: nextDraft.targetSeat === focusedPlayer.seat ? undefined : nextDraft.targetSeat,
    });
    if (nextDisabledReason.disabled) {
      onToast({
        tone: 'warning',
        title: t('ui.game.actions', 'Moves'),
        message: localizeDisabledReason(nextDisabledReason) ?? t('ui.game.phaseLocked', 'Phase locked'),
        dismissAfterMs: 2200,
      });
      return;
    }

    void onCommand({
      type: 'QueueIntent',
      seat: focusedPlayer.seat,
      action: {
        ...nextDraft,
        targetSeat: nextDraft.targetSeat === focusedPlayer.seat ? undefined : nextDraft.targetSeat,
      },
    });
  };

  const openActionPanel = (actionId: ActionId) => {
    const quick = getActionQuickQueue(state, content, focusedPlayer.seat, actionId);
    if (quick.quickQueue) {
      queueIntent(quick.draft);
      return;
    }

    setDraft({
      ...createDraft(actionId),
      ...quick.draft,
      actionId,
    });
    setContextMode('action');
    setContextOpen(true);
  };

  const runPhaseAction = () => {
    if (state.phase === 'SYSTEM') {
      void onCommand({ type: 'ResolveSystemPhase' });
      return;
    }
    if (state.phase === 'COALITION') {
      void onCommand({ type: 'CommitCoalitionIntent' });
      return;
    }
    if (state.phase === 'RESOLUTION') {
      void onCommand({ type: 'ResolveResolutionPhase' });
    }
  };

  const phaseActionDisabled = state.phase === 'COALITION'
    ? !state.players.every((player) => player.ready)
    : state.phase === 'WIN' || state.phase === 'LOSS' || Boolean(activeCardReveal);
  const phaseInsights = getPhaseInsights(state, focusedPlayer.seat);
  const visualDeltaTiles = useMemo(() => getRecentVisualDeltaTiles(state, content), [content, state]);
  const visualTargetSignatures = useMemo(
    () => Object.fromEntries(
      [...new Set(visualDeltaTiles.flatMap((tile) => tile.targetKeys))].map((key) => [
        key,
        visualDeltaTiles.filter((tile) => tile.targetKeys.includes(key)).map((tile) => tile.id).join(':'),
      ]),
    ),
    [visualDeltaTiles],
  );
  const liveVisualTargets = useTransientHighlightKeys(visualTargetSignatures, 1900);
  const visualDeltaTileSignatures = useMemo(
    () => Object.fromEntries(visualDeltaTiles.map((tile) => [`delta:${tile.id}`, tile.id])),
    [visualDeltaTiles],
  );
  const liveVisualDeltaTiles = useTransientHighlightKeys(visualDeltaTileSignatures, 1900);
  const phaseActionLabel = state.phase === 'SYSTEM'
    ? t('ui.game.playSystemPhase', 'Play System')
    : getActionButtonLabel(state.phase);
  const audioEnabled = !autoPlayRunning && !devMode;
  const highlightedStatusItems = useMemo(
    () => new Set(statusItems.map((item) => item.id).filter((itemId) => liveVisualTargets.has(itemId))),
    [liveVisualTargets, statusItems],
  );
  const highlightedFrontRows = useMemo(
    () => new Set(frontRows.map((row) => row.id).filter((rowId) => liveVisualTargets.has(rowId))),
    [frontRows, liveVisualTargets],
  );
  const highlightedMapTargets = useMemo(
    () => new Set([...liveVisualTargets].filter((key) => key.startsWith('region:'))),
    [liveVisualTargets],
  );
  const phaseHelpContent = (
    <span className="phase-help-copy">
      <span>{phasePresentation.copy}</span>
      <span className="phase-help-insight-list">
        {phaseInsights.map((item) => (
          <span key={item.id} className="phase-help-insight">
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </span>
        ))}
      </span>
    </span>
  );

  const phaseProgressControls = (
    <div className="phase-progress-controls">
      <button
        type="button"
        className="dock-control-button is-primary is-play-button"
        disabled={phaseActionDisabled}
        onClick={runPhaseAction}
        aria-label={phaseActionLabel}
        title={phaseActionLabel}
      >
        <Icon type="advancePhase" size={18} title={phaseActionLabel} />
      </button>
    </div>
  );

  const regionContent = null;

  const actionContent = (
    <div className="context-stack">
      <section className="context-card">
        <span className="context-eyebrow">{t('ui.game.configureAction', 'Configure action')}</span>
        <strong>{localizeActionField(draftAction.id, 'name', draftAction.name)}</strong>
        <p>{localizeActionField(draftAction.id, 'description', draftAction.description)}</p>
      </section>

      <section className="context-card context-form">
        <label>
          <span>{t('ui.game.move', 'Move')}</span>
          <select value={draft.actionId} onChange={(event) => setDraft(createDraft(event.target.value as DraftState['actionId']))}>
            {getSeatActions(content).map((action) => (
              <option key={action.id} value={action.id}>
                {localizeActionField(action.id, 'name', action.name)}
              </option>
            ))}
          </select>
        </label>

        {draftAction.needsRegion ? (
          <label>
            <span>{t('ui.game.region', 'Region')}</span>
            <select value={draft.regionId} onChange={(event) => setDraft((current) => ({ ...current, regionId: event.target.value as RegionId }))}>
              {REGION_IDS.map((regionId) => (
                <option key={regionId} value={regionId}>
                  {localizeRegionField(regionId, 'name', content.regions[regionId].name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {draftAction.needsDomain ? (
          <label>
            <span>{t('ui.game.domain', 'Domain')}</span>
            <select value={draft.domainId} onChange={(event) => setDraft((current) => ({ ...current, domainId: event.target.value as DomainId }))}>
              {DOMAIN_IDS.map((domainId) => (
                <option key={domainId} value={domainId}>
                  {localizeDomainField(domainId, 'name', content.domains[domainId].name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {draftAction.needsTargetSeat ? (
          <label>
            <span>{t('ui.game.targetSeat', 'Target Seat')}</span>
            <select
              value={draft.targetSeat}
              onChange={(event) => setDraft((current) => ({ ...current, targetSeat: Number(event.target.value) }))}
            >
              {state.players.filter((player) => player.seat !== focusedPlayer.seat).map((player) => (
                <option key={player.seat} value={player.seat}>
                  {t('ui.game.seat', 'Seat {{seat}}', { seat: player.seat + 1 })}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {draftAction.needsBodies ? (
          <label>
            <span>{t('ui.game.bodiesCommitted', 'Comrades Committed')}</span>
            <input
              type="number"
              min={1}
              value={draft.bodiesCommitted ?? 1}
              onChange={(event) => setDraft((current) => ({ ...current, bodiesCommitted: Number(event.target.value) }))}
            />
          </label>
        ) : null}

        {draftAction.needsEvidence ? (
          <label>
            <span>{t('ui.game.evidenceCommitted', 'Evidence Committed')}</span>
            <input
              type="number"
              min={0}
              value={draft.evidenceCommitted ?? 0}
              onChange={(event) => setDraft((current) => ({ ...current, evidenceCommitted: Number(event.target.value) }))}
            />
          </label>
        ) : null}

        {draftAction.needsCard ? (
          <label>
            <span>{draftAction.cardType === 'support' ? t('ui.game.supportCard', 'Support Card') : t('ui.game.actionCard', 'Action Card')}</span>
            <select
              value={draft.cardId ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, cardId: event.target.value || undefined }))}
            >
              <option value="">{t('ui.game.noCard', 'No card')}</option>
              {availableCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {localizeCardField(card.id, 'name', card.name)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="context-card">
        <span className="context-eyebrow">{t('ui.game.projectedEffect', 'Projected effect')}</span>
        <div className="preview-chip-row">
          {preparedMovePreview.map((chip) => (
            <span key={chip.id} className={`preview-chip tone-${chip.tone}`.trim()}>
              <strong>{chip.label}</strong> {chip.value}
            </span>
          ))}
        </div>
        <div className="context-footer-actions">
          {disabledReason.disabled ? <span className="context-warning">{localizedDisabledReason}</span> : null}
          <button type="button" className="context-primary" disabled={disabledReason.disabled} onClick={() => queueIntent(draft)}>
            {t('ui.game.prepareMove', 'Prepare Move')}
          </button>
        </div>
      </section>
    </div>
  );

  const ledgerContent = (
    <div className="context-stack">
      {ledgerGroups.map((group) => (
        <section key={group.key} className="context-card">
          <strong>{group.title}</strong>
          <div className="context-list">
            {group.events.map((event) => {
              const presented = presentHistoryEvent(event, content);
              return (
                <article key={event.seq} className="context-card context-history-card">
                  <span className="context-eyebrow">{presented.sourceLabel}</span>
                  <strong>{event.emoji} {presented.title}</strong>
                  {presented.contextLabel ? <p>{presented.contextLabel}</p> : null}
                  {presented.cardReveals.length > 0 ? (
                    <div className="context-list">
                      {presented.cardReveals.map((reveal) => (
                        <div key={reveal.key} className="deck-discard-row">
                          <strong>{reveal.seatLabel ? `${reveal.seatLabel} · ${reveal.deckLabel}` : reveal.deckLabel}</strong>
                          <span>{reveal.title}</span>
                          <span>{reveal.body}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {presented.roll ? (
                    <div className="context-list">
                      <div className="ledger-row">
                        <span>{t('ui.history.roll', 'Roll')}</span>
                        <strong dir="ltr">{presented.roll.formula}</strong>
                      </div>
                      <div className="ledger-row">
                        <span>{presented.roll.target}</span>
                        <strong>{presented.roll.outcome}</strong>
                      </div>
                      <p>{presented.roll.meaning}</p>
                    </div>
                  ) : null}
                  {presented.deltas.length > 0 ? (
                    <div className="ledger-list">
                      {presented.deltas.map((delta) => (
                        <div key={delta.key} className="ledger-row">
                          <span>{delta.label}</span>
                          <strong>{delta.value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const selectedDeckSummary = deckSummaries.find((summary) => summary.deckId === selectedDeckId) ?? deckSummaries[0];
  const selectedDeckCards = selectedDeckId === 'system'
    ? state.activeSystemCardIds.slice().reverse()
    : state.decks[selectedDeckId].discardPile.slice().reverse();
  const selectedDeckLatestCardId = getLatestRevealCardIdForDeck(state, selectedDeckId);
  const selectedDeckLatestCard = selectedDeckLatestCardId ? getRevealCopy(content, selectedDeckId, selectedDeckLatestCardId) : null;
  const activeBeaconObjectives = state.activeBeaconIds.map((beaconId) => ({
    id: beaconId,
    title: content.beacons[beaconId]?.title ?? beaconId,
    description: content.beacons[beaconId]?.description ?? '',
    complete: state.beacons[beaconId]?.complete ?? false,
  }));

  const decksContent = selectedDeckSummary ? (
    <div className="context-stack">
      <section className="context-card">
        <span className="context-eyebrow">{t('ui.game.latestReveal', 'Latest reveal')}</span>
        <p>{selectedDeckId === 'system'
          ? t('ui.game.systemReviewHint', 'Review the latest escalation here, then inspect the active tray for structural pressure already in play.')
          : t('ui.game.drawReviewHint', 'Review the latest reveal here, then inspect the discard pile for earlier cards.')}
        </p>
        {selectedDeckLatestCard ? (
          <CrisisCard
            title={selectedDeckLatestCard.title}
            body={selectedDeckLatestCard.body}
            tag={t('ui.game.latestReveal', 'Latest reveal')}
            emoji={selectedDeckId === 'system' ? '🚩' : selectedDeckId === 'crisis' ? '⚠️' : '🃏'}
          />
        ) : (
          <p>{t('ui.game.noRevealYet', 'No card has been revealed for this deck yet.')}</p>
        )}
      </section>

      <section className="context-card">
        <span className="context-eyebrow">{selectedDeckId === 'system' ? t('ui.game.escalationTray', 'Escalation tray') : t('ui.game.discardPile', 'Discard pile')}</span>
        {selectedDeckCards.length === 0 ? (
          <p>{selectedDeckId === 'system'
            ? t('ui.game.noEscalationYet', 'No active system escalations yet.')
            : t('ui.game.noDiscardYet', 'No discarded cards yet.')}
          </p>
        ) : (
          <div className={`context-list ${selectedDeckId === 'system' ? 'deck-tray-list' : 'deck-discard-list'}`.trim()}>
            {selectedDeckCards.map((cardId, index) => {
              const revealCopy = getRevealCopy(content, selectedDeckId, cardId);
              return (
                <div key={`${selectedDeckId}-${cardId}-${index}`} className="deck-discard-row">
                  <strong>{revealCopy.title}</strong>
                  <span>{revealCopy.body}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  ) : null;

  const clearRevealTimers = () => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (revealPhaseTimerRef.current !== null) {
      window.clearTimeout(revealPhaseTimerRef.current);
      revealPhaseTimerRef.current = null;
    }
    if (revealCleanupTimerRef.current !== null) {
      window.clearTimeout(revealCleanupTimerRef.current);
      revealCleanupTimerRef.current = null;
    }
  };

  const dismissActiveReveal = useEffectEvent((restoreFocus: boolean) => {
    clearRevealTimers();

    const sourceDeckId = activeCardReveal?.deckId ?? null;
    if (sourceDeckId) {
      playDeckCue(sourceDeckId === 'system' ? 'resolveSystem' : sourceDeckId === 'crisis' ? 'resolveCrisis' : 'settle', sourceDeckId, audioEnabled);
    }
    setActiveCardReveal(null);
    setActiveCardRevealSeq(null);
    setActiveCardRevealOrigin(null);
    setCardRevealStage('lift');

    if (restoreFocus && sourceDeckId) {
      window.setTimeout(() => deckButtonRefs.current[sourceDeckId]?.focus(), 0);
    }
  });

  const startRevealDismiss = useEffectEvent((restoreFocus: boolean) => {
    clearRevealTimers();

    if (motionMode === 'reduced') {
      dismissActiveReveal(restoreFocus);
      return;
    }

    setCardRevealStage('dismiss');
    revealCleanupTimerRef.current = window.setTimeout(() => {
      dismissActiveReveal(restoreFocus);
    }, 420);
  });

  const openDeckPanel = (deckId: VisibleDeckId) => {
    setSelectedDeckId(deckId);
    setContextMode('decks');
    setContextOpen(true);
  };

  const handleSetReady = (ready: boolean) => {
    if (ready) {
      const nextSeat = getNextUnfinishedCoalitionSeat(state.players, focusedPlayer.seat);
      onViewStateChange({ focusedSeat: nextSeat });
    }
    void onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready });
  };

  useEffect(() => () => {
    if (autoPlayTimerRef.current !== null) {
      window.clearTimeout(autoPlayTimerRef.current);
    }
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
    }
    if (revealPhaseTimerRef.current !== null) {
      window.clearTimeout(revealPhaseTimerRef.current);
    }
    if (revealCleanupTimerRef.current !== null) {
      window.clearTimeout(revealCleanupTimerRef.current);
    }
  }, []);

  useEffect(() => {
    for (const event of state.eventLog) {
      const reveals = event.context?.cardReveals ?? [];
      reveals.forEach((reveal, revealIndex) => {
        if (!reveal.public || !VISIBLE_DECK_IDS.includes(reveal.deckId as VisibleDeckId)) {
          return;
        }
        const key = `${event.seq}:${revealIndex}:${reveal.deckId}:${reveal.cardId}`;
        if (revealSeenRef.current.has(key)) {
          return;
        }
        revealSeenRef.current.add(key);
        revealQueueRef.current.push({
          key,
          eventSeq: event.seq,
          revealIndex,
          deckId: reveal.deckId as VisibleDeckId,
          cardId: reveal.cardId,
        });
      });
    }
  }, [state.eventLog]);

  useEffect(() => {
    if (activeCardReveal || revealQueueRef.current.length === 0) {
      return;
    }

    const nextReveal = revealQueueRef.current.shift() ?? null;
    if (!nextReveal) {
      return;
    }

    setSelectedDeckId(nextReveal.deckId);
    setActiveCardRevealSeq(nextReveal.eventSeq);
    setActiveCardReveal(nextReveal);
    setCardRevealStage('lift');
    const deckButton = deckButtonRefs.current[nextReveal.deckId];
    const rect = deckButton?.getBoundingClientRect();
    const profile = getRevealMotionProfile(nextReveal.deckId);
    const rotation = nextReveal.deckId === 'crisis'
      ? (((nextReveal.eventSeq + nextReveal.revealIndex) % 7) - 3)
      : profile.rotation;
    setActiveCardRevealOrigin(rect
      ? {
          x: rect.left + (rect.width / 2),
          y: rect.top + (rect.height / 2),
          rotation,
        }
      : {
          x: window.innerWidth * 0.18,
          y: window.innerHeight * 0.3,
          rotation,
        });
    void primeDeckAudio();
    playDeckCue('lift', nextReveal.deckId, audioEnabled);

    if (motionMode === 'reduced') {
      setCardRevealStage('settle');
      if (autoPlayRunning) {
        revealTimerRef.current = window.setTimeout(() => startRevealDismiss(false), 320);
      }
      return;
    }

    revealPhaseTimerRef.current = window.setTimeout(() => {
      setCardRevealStage('travel');
    }, profile.liftMs);
    revealTimerRef.current = window.setTimeout(() => {
      setCardRevealStage('flip');
      playDeckCue('flip', nextReveal.deckId, audioEnabled);
    }, profile.liftMs + profile.travelMs);
    revealCleanupTimerRef.current = window.setTimeout(() => {
      setCardRevealStage('settle');
      if (autoPlayRunning) {
        revealCleanupTimerRef.current = window.setTimeout(() => startRevealDismiss(false), 420);
      }
    }, profile.liftMs + profile.travelMs + profile.flipMs);
  }, [activeCardReveal, audioEnabled, autoPlayRunning, motionMode, state.eventLog]);

  useEffect(() => {
    if (cardRevealStage !== 'settle' || !activeCardReveal || autoPlayRunning) {
      return;
    }

    revealActionButtonRef.current?.focus();
  }, [activeCardReveal, autoPlayRunning, cardRevealStage]);

  useEffect(() => {
    if (!latestCampaignRoll) {
      return;
    }
    if (lastCampaignRollSeqRef.current === latestCampaignRoll.seq) {
      return;
    }

    lastCampaignRollSeqRef.current = latestCampaignRoll.seq;
    if (motionMode === 'reduced') {
      setAnimatedCampaignRoll(latestCampaignRoll);
      return;
    }

    setAnimatedCampaignRoll({ ...latestCampaignRoll, rolling: true });
    const settled = window.setTimeout(() => {
      setAnimatedCampaignRoll({ ...latestCampaignRoll, rolling: false });
    }, 520);

    return () => {
      window.clearTimeout(settled);
    };
  }, [latestCampaignRoll, motionMode]);

  useEffect(() => {
    if (surface !== 'local' && autoPlayRunning) {
      console.log('🧪 [GameScreen] Autoplay halted because the table is no longer local.');
      setAutoPlayRunning(false);
      setAutoPlayTargetRound(null);
      setAutoPlayStatus(t('ui.debug.autoplayLocalOnly', 'Autoplay is only available on local tables.'));
    }
  }, [autoPlayRunning, surface]);

  useEffect(() => {
    if (!autoPlayRunning) {
      if (autoPlayTimerRef.current !== null) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    const stopAutoPlay = (message: string) => {
      console.log(`🧪 [GameScreen] ${message}`);
      setAutoPlayRunning(false);
      setAutoPlayTargetRound(null);
      setAutoPlayStatus(message);
    };

    if (TERMINAL_PHASES.includes(state.phase)) {
      stopAutoPlay(
        state.phase === 'WIN'
          ? t('ui.debug.autoplayWon', 'Autoplay stopped because the coalition won.')
          : t('ui.debug.autoplayLost', 'Autoplay stopped because the coalition lost.'),
      );
      return;
    }

    // Stop only after the requested number of full rounds has returned to the system step.
    if (autoPlayTargetRound !== null && state.round >= autoPlayTargetRound && state.phase === 'SYSTEM') {
      stopAutoPlay(t('ui.debug.autoplayFinished', 'Autoplay finished at the requested round mark.'));
      return;
    }

    const command = getNextAutoPlayCommand(state, content);
    if (!command) {
      stopAutoPlay(t('ui.debug.autoplayNoCommand', 'Autoplay found no legal command and stopped.'));
      return;
    }

    autoPlayTimerRef.current = window.setTimeout(() => {
      console.log(`🎲 [GameScreen] Autoplay dispatching ${command.type} during ${state.phase}.`);
      void Promise.resolve(onCommand(command)).catch((error) => {
        console.error('🧪 [GameScreen] Autoplay command failed.', error);
        setAutoPlayRunning(false);
        setAutoPlayTargetRound(null);
        setAutoPlayStatus(t('ui.debug.autoplayCommandError', 'Autoplay stopped after a command error.'));
      });
    }, AUTOPLAY_SPEED_DELAYS[autoPlaySpeed]);

    return () => {
      if (autoPlayTimerRef.current !== null) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayRunning, autoPlaySpeed, autoPlayTargetRound, content, onCommand, state]);

  const handleAutoPlayStart = () => {
    if (surface !== 'local') {
      setAutoPlayStatus(t('ui.debug.autoplayLocalOnly', 'Autoplay is only available on local tables.'));
      return;
    }

    const parsedRounds = Number.parseInt(autoPlayRounds, 10);
    if (!Number.isFinite(parsedRounds) || parsedRounds <= 0) {
      setAutoPlayStatus(t('ui.debug.autoplayInvalid', 'Enter a valid round count before starting autoplay.'));
      return;
    }

    const roundsToPlay = Math.min(parsedRounds, 24);
    setAutoPlayRounds(String(roundsToPlay));
    setAutoPlayTargetRound(state.round + roundsToPlay);
    setAutoPlayRunning(true);
    setAutoPlayStatus(t('ui.debug.autoplayArmed', 'Autoplay armed for {{count}} rounds.', { count: roundsToPlay }));
    console.log(`🧪 [GameScreen] Autoplay armed for ${roundsToPlay} rounds at speed ${autoPlaySpeed}.`);
  };

  const handleAutoPlayStop = () => {
    if (autoPlayTimerRef.current !== null) {
      window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    console.log('🧪 [GameScreen] Autoplay stopped by user.');
    setAutoPlayRunning(false);
    setAutoPlayTargetRound(null);
    setAutoPlayStatus(t('ui.debug.autoplayStopped', 'Autoplay stopped.'));
  };

  const autoPlayStatusText = autoPlayRunning
    ? t('ui.debug.autoplayTick', 'Autoplay: round {{round}}, phase {{phase}}.', {
      round: state.round,
      phase: t(`ui.phases.${state.phase}`, state.phase),
    })
    : autoPlayStatus;

  return (
    <TableSurface className={`game-screen game-screen-compressed ${activeCardReveal ? 'is-reveal-active' : ''}`.trim()}>
      <header className="game-header-shell">
        <div className="table-utility-bar">
          <LocaleSwitcher />
          <ThemePlate
            label={surface === 'room' && roomId
              ? t('ui.game.room', 'Room {{roomId}}', { roomId })
              : t('ui.game.table', 'Table')}
            onClick={() => {}}
          />
          <ThemePlate
            label={copied ? t('ui.game.saved', 'Saved') : t('ui.game.save', 'Save')}
            onClick={() => {
              onExportSave(serializeGame(state));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          />
          <ThemePlate label={t('ui.game.backHome', 'Back Home')} onClick={onBack} />
        </div>
      </header>

      <main className={`game-compression-layout ${contextOpen ? 'is-context-open' : 'is-context-closed'}`.trim()}>
        <section className="board-core">
          <div className="board-core-head">
            <div>
              <span className="board-core-eyebrow">
                {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
              </span>
              <h1>{phasePresentation.verb}</h1>
            </div>
            <button type="button" className="ledger-toggle" onClick={() => { setContextMode('ledger'); setContextOpen(true); }}>
              {t('ui.game.ledger', 'Ledger')}
            </button>
          </div>

          <PhaseProgress
            phase={state.phase}
            activeContent={phaseProgressControls}
            activeHint={phaseControlHint}
            activeHelpContent={phaseHelpContent}
          />

          {state.phase === 'COALITION' ? (
            <>
              <section className="board-player-strip">
                <PlayerStrip
                  summaries={playerSummaries}
                  focusedSeat={focusedPlayer.seat}
                  onSelectSeat={(seat) => onViewStateChange({ focusedSeat: seat })}
                />
              </section>

              <ActionDock
                items={actionItems}
                onAction={openActionPanel}
                controls={(
                  <>
                    <div className="dock-queue-summary">
                      <strong>{localizeFactionField(faction.id, 'shortName', faction.shortName)}</strong>
                      <span>{formatNumber(getPlayerBodyTotal(state, focusedPlayer.seat))} {t('ui.game.bodies', 'Bodies')}</span>
                      <span>{formatNumber(focusedPlayer.evidence)} {t('ui.game.evidence', 'Evidence')}</span>
                      <span>{t('ui.game.queuedCount', '{{count}} queued', { count: focusedPlayer.queuedIntents.length })}</span>
                    </div>
                <div className="dock-queue-list" aria-label={t('ui.game.preparedMovesLabel', 'Prepared moves')}>
                  {focusedPlayer.queuedIntents.length === 0 ? (
                    <span className="dock-empty">{t('ui.game.noPreparedMoves', 'No prepared moves yet.')}</span>
                  ) : (
                    focusedPlayer.queuedIntents.map((intent) => (
                          <button
                            key={`${intent.actionId}-${intent.slot}`}
                            type="button"
                            className="dock-queue-chip"
                            onClick={() => void onCommand({ type: 'RemoveQueuedIntent', seat: focusedPlayer.seat, slot: intent.slot })}
                            title={t('ui.game.remove', 'Remove')}
                          >
                            <span>{intent.slot + 1}</span>
                            <strong>{localizeActionField(intent.actionId, 'name', content.actions[intent.actionId].name)}</strong>
                      </button>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className={`action-dock-submit ${focusedPlayer.ready ? 'is-active' : ''}`.trim()}
                  disabled={focusedPlayer.actionsRemaining > 0}
                  onClick={() => handleSetReady(!focusedPlayer.ready)}
                >
                  <Icon type="objective" size={18} className="action-dock-submit-icon" />
                  <span>{focusedPlayer.ready ? t('ui.game.seatReady', 'Seat Ready') : t('ui.game.markSeatReady', 'Mark Seat Ready')}</span>
                </button>
              </>
            )}
          />
            </>
          ) : null}

          {visualDeltaTiles.length > 0 ? (
            <section className="visual-delta-strip" aria-label={t('ui.game.latestChanges', 'Latest changes')}>
              {visualDeltaTiles.map((tile) => (
                <article
                  key={tile.id}
                  className={`visual-delta-tile ${liveVisualDeltaTiles.has(`delta:${tile.id}`) ? 'is-live' : ''}`.trim()}
                  aria-label={tile.ariaLabel}
                  title={tile.ariaLabel}
                >
                  <div className="visual-delta-tile-head" aria-hidden="true">
                    <span className="visual-delta-phase-marker">{tile.phaseIcon}</span>
                    <span className="visual-delta-emoji">{tile.emoji}</span>
                  </div>
                  <div className="visual-delta-glyph-row" aria-hidden="true">
                    {tile.glyphs.map((glyph) => (
                      <span key={glyph.id} className={`visual-delta-glyph tone-${glyph.tone}`.trim()}>
                        <Icon type={glyph.icon} size={16} title={glyph.ariaLabel} />
                        <strong dir="ltr">{glyph.value}</strong>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <StatusRibbon items={statusItems} highlightedIds={highlightedStatusItems} />
          {state.mode === 'SYMBOLIC' && activeBeaconObjectives.length > 0 ? (
            <section className="beacon-objective-strip" aria-label={t('ui.game.beaconObjectives', 'Beacon objectives')}>
              {activeBeaconObjectives.map((beacon) => (
                <article key={beacon.id} className={`beacon-objective-card ${beacon.complete ? 'is-complete' : ''}`.trim()}>
                  <span className="context-eyebrow">{t('ui.game.beaconObjective', 'Beacon objective')}</span>
                  <strong>{beacon.title}</strong>
                  <p>{beacon.description}</p>
                  <span className="beacon-objective-state">
                    {beacon.complete ? t('ui.game.beaconComplete', 'Complete') : t('ui.game.beaconOpen', 'Open')}
                  </span>
                </article>
              ))}
            </section>
          ) : null}

          <div className="board-map-panel">
            <WorldMapBoard
              state={state}
              content={content}
              selectedRegionId={selectedRegionId}
              campaignRoll={animatedCampaignRoll}
              debugLayout={devMode}
              externalHighlightKeys={highlightedMapTargets}
              onSelectRegion={(regionId) => {
                onViewStateChange({ regionId });
              }}
            />
            <section className="board-deck-rail" aria-label={t('ui.game.decks', 'Decks')}>
              <div className="board-deck-rail-grid">
                {deckSummaries.map((summary) => (
                  <div
                    key={summary.deckId}
                    className={`board-deck-stack-shell board-deck-stack-shell-${summary.deckId} ${selectedDeckId === summary.deckId ? 'is-selected' : ''}`.trim()}
                  >
                    <DeckStack
                      ref={(node) => {
                        deckButtonRefs.current[summary.deckId] = node;
                      }}
                      label={summary.label}
                      deckId={summary.deckId}
                      deckName={getPrintedDeckTitle(summary.deckId)}
                      drawCount={summary.drawCount}
                      lowCount={summary.drawCount <= 3}
                      shakeEmpty={summary.drawCount === 0 && selectedDeckId === summary.deckId}
                      onPointerDown={() => {
                        void primeDeckAudio();
                        playDeckCue('press', summary.deckId, audioEnabled);
                      }}
                      onClick={() => openDeckPanel(summary.deckId)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <FrontTrackBar rows={frontRows} highlightedIds={highlightedFrontRows} />
        </section>

        <aside className="board-context-slot" aria-label={t('ui.game.boardContext', 'Board context')}>
          <ContextPanel
            mode={contextMode}
            open={contextOpen}
            onClose={() => setContextOpen(false)}
            onModeChange={(mode) => {
              setContextMode(mode);
              setContextOpen(true);
            }}
            showRegionTab={false}
            regionContent={regionContent}
            actionContent={actionContent}
            decksContent={decksContent}
            ledgerContent={ledgerContent}
          />
        </aside>
      </main>

      {devMode ? (
        <button
          type="button"
          className={`dev-panel-toggle ${showDevPanel ? 'is-active' : ''}`.trim()}
          onClick={() => setShowDevPanel((current) => !current)}
          aria-expanded={showDevPanel}
          aria-controls="debug-panel-title"
        >
          {showDevPanel ? t('ui.debug.hidePanel', 'Hide Dev Panel') : t('ui.debug.showPanel', 'Dev Panel')}
        </button>
      ) : null}

      {devMode && showDevPanel ? (
        <DebugOverlay
          state={state}
          content={content}
          roomId={roomId}
          showDebugSnapshot={showDebugSnapshot}
          autoPlayRounds={autoPlayRounds}
          autoPlaySpeed={autoPlaySpeed}
          autoPlayRunning={autoPlayRunning}
          autoPlayStatus={autoPlayStatusText}
          onToggleDebugSnapshot={() => setShowDebugSnapshot((current) => !current)}
          onAutoPlayRoundsChange={setAutoPlayRounds}
          onAutoPlaySpeedChange={setAutoPlaySpeed}
          onAutoPlayStart={handleAutoPlayStart}
          onAutoPlayStop={handleAutoPlayStop}
          onClose={() => setShowDevPanel(false)}
        />
      ) : null}
      {activeCardReveal ? (
        <div className={`deck-reveal-overlay deck-reveal-stage-${cardRevealStage}`.trim()} role="dialog" aria-modal="true" aria-labelledby="deck-reveal-title">
          <div className="deck-reveal-vignette" />
          <div
            className="deck-reveal-scene"
            style={{
              ['--reveal-origin-x' as string]: `${activeCardRevealOrigin?.x ?? 0}px`,
              ['--reveal-origin-y' as string]: `${activeCardRevealOrigin?.y ?? 0}px`,
              ['--reveal-origin-rotation' as string]: `${activeCardRevealOrigin?.rotation ?? 0}deg`,
              ['--reveal-glow' as string]: getRevealMotionProfile(activeCardReveal.deckId).glow,
              ['--reveal-ease' as string]: getRevealMotionProfile(activeCardReveal.deckId).ease,
            }}
          >
            <article
              className={`deck-reveal-card deck-reveal-card-${activeCardReveal.deckId}`.trim()}
              data-seq={activeCardRevealSeq ?? undefined}
            >
              <div className="deck-reveal-rotator">
                <div className="deck-reveal-face deck-reveal-face-back">
                  <DeckBackArt
                    deckId={activeCardReveal.deckId}
                    deckName={getPrintedDeckTitle(activeCardReveal.deckId)}
                    className="deck-reveal-back-art"
                  />
                </div>
                <div className="deck-reveal-face deck-reveal-face-front">
                  <header className="deck-reveal-front-head">
                    <span className="deck-reveal-deck-label">{getPrintedDeckTitle(activeCardReveal.deckId)}</span>
                    <strong id="deck-reveal-title">{getRevealCopy(content, activeCardReveal.deckId, activeCardReveal.cardId).title}</strong>
                  </header>
                  <div className="deck-reveal-illustration" aria-hidden="true">
                    <span className="deck-reveal-illustration-emblem">{getPrintedDeckTitle(activeCardReveal.deckId)}</span>
                  </div>
                  <div className="deck-reveal-body-copy">
                    <p>{getRevealCopy(content, activeCardReveal.deckId, activeCardReveal.cardId).body}</p>
                  </div>
                  <div className="deck-reveal-footer">
                    <div className="deck-reveal-chip-row" aria-label={t('ui.game.effectSummary', 'Effect summary')}>
                      {getRevealSummaryChips(content, activeCardReveal.deckId, activeCardReveal.cardId).map((chip) => (
                        <span key={chip} className="deck-reveal-chip">{chip}</span>
                      ))}
                    </div>
                    <button
                      ref={revealActionButtonRef}
                      type="button"
                      className="reveal-action-button"
                      onClick={() => startRevealDismiss(true)}
                    >
                      {getRevealActionLabel(activeCardReveal.deckId)}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </TableSurface>
  );
}
