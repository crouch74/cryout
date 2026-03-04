import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  toCompatStructuredEvent,
  getAvailableDomains,
  getAvailableRegions,
  getPlayerBodyTotal,
  getSeatActions,
  getSeatDisabledReason,
  getSeatFaction,
  type ActionId,
  type CampaignResolvedEventPayload,
  type CompiledContent,
  type DomainId,
  type EngineCommand,
  type EngineState,
  type Effect,
  type QueuedIntent,
  type RegionId,
  type SystemPersistentModifiers,
} from '../../engine/index.ts';
import {
  formatNumber,
  localizeActionField,
  localizeBeaconField,
  localizeCardField,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  t,
} from '../../i18n/index.ts';
import { ActionDock } from '../panels/ActionDock.tsx';
import { ContextPanel } from '../panels/ContextPanel.tsx';
import { playDeckCue, primeDeckAudio } from '../audio/deckSound.ts';
import { FrontTrackBar } from '../hud/FrontTrackBar.tsx';
import { CampaignResultModal } from '../overlays/CampaignResultModal.tsx';
import { GameIntroModal } from '../overlays/GameIntroModal.tsx';
import { SecretMandateModal } from '../overlays/SecretMandateModal.tsx';
import { Icon } from '../../ui/icon/Icon.tsx';
import type { IconType } from '../../ui/icon/iconTypes.ts';
import { PlayerStrip } from '../hud/PlayerStrip.tsx';
import { PhaseProgress } from '../hud/PhaseProgress.tsx';
import { StatusRibbon } from '../hud/StatusRibbon.tsx';
import { TerminalOutcomeModal } from '../overlays/TerminalOutcomeModal.tsx';
import { getCampaignResolvedPayload } from '../presentation/campaignResultPresentation.ts';
import { localizeDisabledReason, presentHistoryEvent } from '../presentation/historyPresentation.ts';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';
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
} from '../presentation/gameUiHelpers.ts';
import { CrisisCard, DeckBackArt, DeckStack, LocaleSwitcher, TableSurface, ThemePlate, useTabletopTheme } from '../../ui/layout/tabletop.tsx';
import type { SessionViewport } from '../../features/session-setup/model/sessionTypes.ts';
import { WorldMapBoard } from '../board/WorldMapBoard.tsx';

interface GameSessionScreenProps {
  state: EngineState;
  content: CompiledContent;
  viewState: SessionViewport;
  onViewStateChange: (patch: Partial<SessionViewport>) => void;
  onCommand: (command: EngineCommand) => Promise<void> | void;
  onToast: (toast: { tone: 'info' | 'success' | 'warning' | 'error'; message: string; title?: string; dismissAfterMs?: number }) => void;
  onBack: () => void;
  authorizedOwnerId?: number | null;
  autoAdvanceTransientUi?: boolean;
}

const VISIBLE_DECK_IDS = ['system', 'resistance', 'crisis'] as const;

type VisibleDeckId = typeof VISIBLE_DECK_IDS[number];

type DraftState = Omit<QueuedIntent, 'slot'>;

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
  seq: number;
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
  RevolutionaryWave: 'frontWave',
  PatriarchalGrip: 'frontPatriarchy',
  UnfinishedJustice: 'frontJustice',
};

function createDraft(actionId: ActionId, regions: RegionId[], domains: DomainId[]): DraftState {
  return {
    actionId,
    regionId: regions[0],
    domainId: domains[0],
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

function getCampaignResultEvents(state: EngineState) {
  return state.eventLog
    .map((event) => getCampaignResolvedPayload(toCompatStructuredEvent(event)))
    .filter((event): event is CampaignResolvedEventPayload => Boolean(event));
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
      return formatSignedLabel(effect.amount, t('ui.game.bodies', 'Comrades'));
    case 'remove_bodies':
      return formatSignedLabel(effect.amount * -1, t('ui.game.bodies', 'Comrades'));
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
      detail: state.secretMandatesEnabled
        ? t('ui.game.phaseInsightResolutionCheck', 'After resolution, the game checks victory, defeat, Secret Mandates, and whether a new round begins.')
        : t('ui.game.phaseInsightResolutionCheckLocal', 'After resolution, the game checks victory, defeat, and whether a new round begins.'),
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

function getRegionIdFromDeltaLabel(label: string, content: CompiledContent): RegionId | null {
  const regions = getAvailableRegions(content);
  const regionId = label.split('.')[0] ?? '';
  return (regions as string[]).includes(regionId) ? regionId as RegionId : null;
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
      const regionId = getRegionIdFromDeltaLabel(delta.label, content);
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
      const regionId = getRegionIdFromDeltaLabel(delta.label, content);
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
      const regionId = getRegionIdFromDeltaLabel(delta.label, content);
      const seat = getSeatFromDeltaLabel(delta.label);
      return {
        glyph: {
          id: `${delta.kind}:${delta.label}`,
          icon: 'bodies',
          value: signedDelta ?? '*',
          tone: 'resource',
          ariaLabel: `${regionId ? localizeRegionField(regionId, 'name', content.regions[regionId].name) : t('ui.game.bodies', 'Comrades')} ${t('ui.game.bodies', 'Comrades')} ${signedDelta ?? ''}`.trim(),
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
        .map((delta) => getVisualDeltaGlyph(delta, content))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const glyphs = glyphEntries.map((entry) => entry.glyph);
      const targetKeys = [...new Set(glyphEntries.flatMap((entry) => entry.targetKeys))];

      return {
        id: String(event.seq),
        seq: event.seq,
        emoji: event.emoji,
        phaseIcon: getPhasePresentation(event.phase).icon,
        glyphs,
        ariaLabel: `${presentHistoryEvent(event, content).title}. ${glyphs.map((glyph) => glyph.ariaLabel).join('. ')}`.trim(),
        targetKeys,
      };
    })
    .filter((tile) => tile.glyphs.length > 0);
}

export function GameSessionScreen({
  state,
  content,
  viewState,
  onViewStateChange,
  onCommand,
  onToast,
  onBack,
  authorizedOwnerId,
  autoAdvanceTransientUi = false,
}: GameSessionScreenProps) {
  const { motionMode } = useTabletopTheme();
  const ownedSeats = authorizedOwnerId === null || authorizedOwnerId === undefined
    ? state.players.map((player) => player.seat)
    : state.players.filter((player) => player.ownerId === authorizedOwnerId).map((player) => player.seat);
  const defaultFocusedSeat = ownedSeats[0] ?? 0;
  const focusedSeat = ownedSeats.includes(viewState.focusedSeat) ? viewState.focusedSeat : defaultFocusedSeat;
  const focusedPlayer = state.players[focusedSeat] ?? state.players[0];
  const faction = getSeatFaction(state, content, focusedPlayer.seat);
  const REGION_IDS = useMemo(() => getAvailableRegions(content), [content]);
  const DOMAIN_IDS = useMemo(() => getAvailableDomains(content), [content]);

  const [contextOpen, setContextOpen] = useState(false);
  const [contextMode, setContextMode] = useState<ContextPanelMode>('ledger');
  const [selectedDeckId, setSelectedDeckId] = useState<VisibleDeckId>('system');
  const [draft, setDraft] = useState<DraftState>(() => createDraft('organize', REGION_IDS, DOMAIN_IDS));
  const [activeCardRevealSeq, setActiveCardRevealSeq] = useState<number | null>(null);
  const [activeCardReveal, setActiveCardReveal] = useState<CardRevealQueueItem | null>(null);
  const [cardRevealStage, setCardRevealStage] = useState<CardRevealStage>('lift');
  const [activeCardRevealOrigin, setActiveCardRevealOrigin] = useState<CardRevealOrigin | null>(null);
  const [activeCampaignResult, setActiveCampaignResult] = useState<CampaignResolvedEventPayload | null>(null);
  const [campaignDismissEnabled, setCampaignDismissEnabled] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [startupMandateDismissed, setStartupMandateDismissed] = useState(false);
  const [mandateModalOpen, setMandateModalOpen] = useState(false);
  const revealQueueRef = useRef<CardRevealQueueItem[]>([]);
  const revealSeenRef = useRef(new Set<string>());
  const campaignResultQueueRef = useRef<CampaignResolvedEventPayload[]>([]);
  const campaignResultSeenRef = useRef(new Set<number>());
  const campaignResultsHydratedRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const revealPhaseTimerRef = useRef<number | null>(null);
  const revealCleanupTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const revealActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const deckButtonRefs = useRef<Record<VisibleDeckId, HTMLButtonElement | null>>({
    system: null,
    resistance: null,
    crisis: null,
  });
  const selectedRegionId = viewState.regionId;
  const isGameStart = state.round === 1 && state.commandLog.length === 1;
  const startupMandateSeat = ownedSeats[0] ?? 0;
  const startupMandatePlayer = state.players[startupMandateSeat];
  const introOpen = isGameStart && !introDismissed;
  const startupMandateOpen = Boolean(
    isGameStart
    && state.secretMandatesEnabled
    && !introOpen
    && !startupMandateDismissed
    && startupMandatePlayer
    && startupMandatePlayer.mandateId,
  );
  const activeMandateSeat = mandateModalOpen ? focusedPlayer.seat : startupMandateSeat;
  const revealQueueBlocked = introOpen || startupMandateOpen || mandateModalOpen || Boolean(activeCampaignResult);
  const highlightSuspended = Boolean(activeCardReveal || activeCampaignResult || introOpen || startupMandateOpen || mandateModalOpen);
  const emptySpaceCloseSelector = [
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    'a[href]',
    '[role="dialog"]',
    '.board-region-cluster',
    '.board-region-sidecard',
    '.deck-stack',
    '.context-card',
  ].join(', ');

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
  const playerSummaries = state.players
    .filter((player) => ownedSeats.includes(player.seat))
    .map((player) => getPlayerStripSummary(player, content, state));
  const actionItems = getActionDockItems(state, content, focusedPlayer.seat);
  const phasePresentation = getPhasePresentation(state.phase);
  const preparedMovePreview = buildIntentPreview(draft, draftAction, state, content, focusedPlayer.seat);
  const campaignResults = useMemo(() => getCampaignResultEvents(state), [state]);
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
      ...createDraft(actionId, REGION_IDS, DOMAIN_IDS),
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
  const visualDeltaTiles = useMemo(() => {
    const tiles = getRecentVisualDeltaTiles(state, content);
    return highlightSuspended && activeCardRevealSeq !== null
      ? tiles.filter((tile) => tile.seq < activeCardRevealSeq)
      : tiles;
  }, [activeCardRevealSeq, content, highlightSuspended, state]);
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
  const audioEnabled = true;
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
          <select value={draft.actionId} onChange={(event) => setDraft(createDraft(event.target.value as ActionId, REGION_IDS, DOMAIN_IDS))}>
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
    title: localizeBeaconField(beaconId, 'title', content.beacons[beaconId]?.title ?? beaconId),
    description: localizeBeaconField(beaconId, 'description', content.beacons[beaconId]?.description ?? ''),
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

  const dismissActiveReveal = (restoreFocus: boolean) => {
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
  };

  const startRevealDismiss = (restoreFocus: boolean) => {
    clearRevealTimers();

    if (motionMode === 'reduced') {
      dismissActiveReveal(restoreFocus);
      return;
    }

    setCardRevealStage('dismiss');
    revealCleanupTimerRef.current = window.setTimeout(() => {
      dismissActiveReveal(restoreFocus);
    }, 420);
  };

  const openDeckPanel = (deckId: VisibleDeckId) => {
    setSelectedDeckId(deckId);
    setContextMode('decks');
    setContextOpen(true);
  };

  const closeOpenDrawers = () => {
    setContextOpen(false);
    if (selectedRegionId !== null) {
      onViewStateChange({ regionId: null });
    }
  };

  const handleEmptySpacePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (activeCardReveal) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(emptySpaceCloseSelector)) {
      return;
    }

    closeOpenDrawers();
  };

  const handleSetReady = (ready: boolean) => {
    if (ready) {
      const nextSeat = getNextUnfinishedCoalitionSeat(state.players, focusedPlayer.seat);
      onViewStateChange({ focusedSeat: nextSeat });
    }
    void onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready });
  };

  useEffect(() => () => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
    }
    if (revealPhaseTimerRef.current !== null) {
      window.clearTimeout(revealPhaseTimerRef.current);
    }
    if (revealCleanupTimerRef.current !== null) {
      window.clearTimeout(revealCleanupTimerRef.current);
    }
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
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
    if (revealQueueBlocked || activeCardReveal || revealQueueRef.current.length === 0) {
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
    }, profile.liftMs + profile.travelMs + profile.flipMs);
  }, [activeCardReveal, audioEnabled, motionMode, revealQueueBlocked, state.eventLog]);

  useEffect(() => {
    if (cardRevealStage !== 'settle' || !activeCardReveal) {
      return;
    }

    if (autoAdvanceTransientUi) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        startRevealDismiss(false);
      }, motionMode === 'reduced' ? 120 : 260);
      return () => {
        if (autoAdvanceTimerRef.current !== null) {
          window.clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = null;
        }
      };
    }

    revealActionButtonRef.current?.focus();
  }, [activeCardReveal, autoAdvanceTransientUi, cardRevealStage, motionMode]);

  useEffect(() => {
    if (!campaignResultsHydratedRef.current) {
      campaignResults.forEach((result) => {
        campaignResultSeenRef.current.add(result.eventSeq);
      });
      campaignResultsHydratedRef.current = true;
      return;
    }

    for (const result of campaignResults) {
      if (campaignResultSeenRef.current.has(result.eventSeq)) {
        continue;
      }
      campaignResultSeenRef.current.add(result.eventSeq);
      campaignResultQueueRef.current.push(result);
    }
  }, [campaignResults]);

  useEffect(() => {
    if (activeCampaignResult || campaignResultQueueRef.current.length === 0) {
      return;
    }

    const nextResult = campaignResultQueueRef.current.shift() ?? null;
    if (!nextResult) {
      return;
    }

    setCampaignDismissEnabled(false);
    setActiveCampaignResult(nextResult);
  }, [activeCampaignResult, campaignResults]);

  useEffect(() => {
    if (!activeCampaignResult || activeCampaignResult.dice.length > 0) {
      return;
    }

    setCampaignDismissEnabled(true);
  }, [activeCampaignResult]);

  useEffect(() => {
    if (!autoAdvanceTransientUi || !activeCampaignResult || !campaignDismissEnabled) {
      return;
    }

    autoAdvanceTimerRef.current = window.setTimeout(() => {
      setActiveCampaignResult(null);
      setCampaignDismissEnabled(false);
    }, motionMode === 'reduced' ? 140 : 320);

    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [activeCampaignResult, autoAdvanceTransientUi, campaignDismissEnabled, motionMode]);

  return (
    <TableSurface className={`game-screen game-screen-compressed ${activeCardReveal ? 'is-reveal-active' : ''}`.trim()}>
      <main
        className={`game-compression-layout ${contextOpen ? 'is-context-open' : 'is-context-closed'}`.trim()}
        onPointerDownCapture={handleEmptySpacePointerDown}
      >
        <section className="board-core">
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
                      <span>{formatNumber(getPlayerBodyTotal(state, focusedPlayer.seat))} {t('ui.game.bodies', 'Comrades')}</span>
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

          <StatusRibbon
            items={statusItems}
            highlightedIds={highlightedStatusItems}
            suspendHighlights={highlightSuspended}
            utilities={(
              <div className="status-ribbon-utilities-group">
                <LocaleSwitcher showLabel={false} />
                <ThemePlate
                  label={(
                    <Icon
                      type="home"
                      size={18}
                      title={t('ui.game.backHome', 'Back Home')}
                    />
                  )}
                  onClick={onBack}
                />
                {state.secretMandatesEnabled ? (
                  <button
                    type="button"
                    className="ledger-toggle ledger-toggle-mandate"
                    onClick={() => setMandateModalOpen(true)}
                    aria-label={t('ui.game.openSecretMandate', 'Open Secret Mandate')}
                    title={t('ui.game.openSecretMandate', 'Open Secret Mandate')}
                  >
                    <Icon type="mandate" size={20} />
                    <span>{t('ui.game.viewMandate', 'Mandate Letter')}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ledger-toggle"
                  onClick={() => { setContextMode('ledger'); setContextOpen(true); }}
                  aria-label={t('ui.game.ledger', 'Ledger')}
                >
                  <Icon type="ledger" size={20} />
                  <span>{t('ui.game.ledger', 'Ledger')}</span>
                </button>
              </div>
            )}
          />

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
              externalHighlightKeys={highlightedMapTargets}
              suspendHighlights={highlightSuspended}
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
                      urgent={state.phase === 'SYSTEM' && summary.deckId === 'crisis'}
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

          <FrontTrackBar rows={frontRows} highlightedIds={highlightedFrontRows} suspendHighlights={highlightSuspended} />
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
      {
        activeCardReveal ? (
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
        ) : null
      }

      <CampaignResultModal
        open={Boolean(activeCampaignResult)}
        result={activeCampaignResult}
        content={content}
        motionMode={motionMode}
        dismissEnabled={campaignDismissEnabled}
        onAnimationComplete={() => {
          setCampaignDismissEnabled((current) => {
            if (current) {
              return current;
            }
            window.dispatchEvent(new CustomEvent('campaign-result-animation-complete', {
              detail: { eventSeq: activeCampaignResult?.eventSeq ?? null },
            }));
            return true;
          });
        }}
        onRequestClose={() => {
          setActiveCampaignResult(null);
          setCampaignDismissEnabled(false);
        }}
      />

      <TerminalOutcomeModal
        state={state}
        content={content}
        onReviewLedger={() => {
          setContextMode('ledger');
          setContextOpen(true);
        }}
        onBack={onBack}
      />

      <SecretMandateModal
        open={startupMandateOpen || mandateModalOpen}
        state={state}
        content={content}
        seat={activeMandateSeat}
        startupReveal={startupMandateOpen}
        motionMode={motionMode}
        autoAdvance={autoAdvanceTransientUi}
        onRequestClose={() => {
          if (startupMandateOpen) {
            setStartupMandateDismissed(true);
          }
          setMandateModalOpen(false);
        }}
      />

      <GameIntroModal
        open={introOpen}
        state={state}
        content={content}
        onDismiss={() => setIntroDismissed(true)}
      />
    </TableSurface >
  );
}
