import { useEffect, useMemo, useRef, useState } from 'react';
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
  type QueuedIntent,
  type RegionId,
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
  type Locale,
} from '../i18n/index.ts';
import { ActionDock } from './ActionDock.tsx';
import { ContextPanel } from './ContextPanel.tsx';
import { DebugOverlay, type AutoPlaySpeedLevel } from './DebugOverlay.tsx';
import { FrontTrackBar } from './FrontTrackBar.tsx';
import { Icon } from './icons/Icon.tsx';
import { PlayerStrip } from './PlayerStrip.tsx';
import { PhaseProgress } from './PhaseProgress.tsx';
import { StatusRibbon } from './StatusRibbon.tsx';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';
import {
  buildIntentPreview,
  getActionDockItems,
  getActionQuickQueue,
  getDeckSummaries,
  getFrontTrackRows,
  getLatestPublicCardReveal,
  getNextUnfinishedCoalitionSeat,
  getPhasePresentation,
  getPlayerStripSummary,
  getStatusRibbonItems,
  type ContextPanelMode,
} from './gameUiHelpers.ts';
import { CrisisCard, DeckStack, LocaleSwitcher, TableSurface, ThemePlate, useTabletopTheme } from './tabletop.tsx';
import type { GameViewState } from './urlState.ts';
import { WorldMapBoard } from './WorldMapBoard.tsx';

interface GameScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
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

type DraftState = Omit<QueuedIntent, 'slot'>;

interface CampaignRollPresentation {
  seq: number;
  regionId: RegionId;
  total: number;
  modifier: number;
  dieOne: number;
  dieTwo: number;
  success: boolean;
  rolling: boolean;
}

interface CardRevealQueueItem {
  key: string;
  eventSeq: number;
  revealIndex: number;
  deckId: 'system' | 'resistance' | 'beacon';
  cardId: string;
}

interface PhaseInsight {
  id: string;
  label: string;
  detail: string;
}

interface ChangeSnapshot {
  id: string;
  emoji: string;
  title: string;
  reason: string;
  changes: string[];
}

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
    return t('ui.game.systemPhaseHint', 'Resolve the system strike to open coalition planning.');
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
      regionId: roll.regionId,
      total: roll.total,
      modifier: roll.modifier,
      dieOne: roll.dice[0],
      dieTwo: roll.dice[1],
      success: roll.success,
      rolling: false,
    };
  }

  return null;
}

function getLatestRevealCardIdForDeck(state: EngineState, deckId: 'system' | 'resistance' | 'beacon') {
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
  deckId: 'system' | 'resistance' | 'beacon',
  cardId: string,
) {
  if (deckId === 'beacon') {
    const beacon = content.beacons[cardId];
    return {
      title: beacon?.title ?? cardId,
      body: beacon?.description ?? '',
    };
  }

  const card = content.cards[cardId];
  return {
    title: localizeCardField(cardId, 'name', card?.name ?? cardId),
    body: localizeCardField(cardId, 'text', card?.text ?? ''),
  };
}

function getPhaseInsights(state: EngineState, focusedSeat: number): PhaseInsight[] {
  if (state.phase === 'SYSTEM') {
    return [
      {
        id: 'system-pressure',
        label: t('ui.game.phaseInsightPressure', 'Pressure rises'),
        detail: t('ui.game.phaseInsightSystemCards', 'System cards and intervention push Extraction Tokens, War Machine pressure, and direct harm onto exposed regions.'),
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
      detail: t('ui.game.phaseInsightResolutionResolve', 'Prepared moves now change fronts, regions, comrades, witness, and cards in priority order.'),
    },
    {
      id: 'resolution-check',
      label: t('ui.game.phaseInsightCheck', 'Check why the round ends'),
      detail: t('ui.game.phaseInsightResolutionCheck', 'After resolution, the game checks victory, defeat, solemn charges, and whether a new round begins.'),
    },
  ];
}

function formatDeltaSummary(delta: EngineState['eventLog'][number]['deltas'][number]) {
  switch (delta.kind) {
    case 'track':
      return `${delta.label === 'globalGaze' ? t('ui.game.globalGaze', 'Global Gaze') : t('ui.game.northernWarMachine', 'Northern War Machine')} ${delta.before} -> ${delta.after}`;
    case 'domain':
      return `${delta.label} ${delta.before} -> ${delta.after}`;
    case 'extraction':
      return `${delta.label.split('.')[0]} ${t('ui.game.extractionTokens', 'Extraction Tokens')} ${delta.before} -> ${delta.after}`;
    case 'defense':
      return `${delta.label.split('.')[0]} ${t('ui.game.defense', 'Defense')} ${delta.before} -> ${delta.after}`;
    case 'evidence':
      return `${t('ui.game.evidence', 'Evidence')} ${delta.before} -> ${delta.after}`;
    case 'bodies':
      return `${delta.label.split('.')[0]} ${t('ui.game.bodies', 'Comrades')} ${delta.before} -> ${delta.after}`;
    case 'card':
      return t('ui.game.cardsChanged', 'Cards changed');
    case 'player':
      return `${delta.label} ${delta.before} -> ${delta.after}`;
  }
}

function getRecentChangeSnapshots(state: EngineState): ChangeSnapshot[] {
  return state.eventLog
    .slice()
    .reverse()
    .filter((event) => event.deltas.length > 0 || event.trace.some((trace) => trace.deltas.length > 0))
    .slice(0, 3)
    .map((event) => ({
      id: String(event.seq),
      emoji: event.emoji,
      title: event.message,
      reason: t(`ui.phases.${event.phase}`, event.phase),
      changes: event.deltas.slice(0, 3).map(formatDeltaSummary),
    }));
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
  locale,
  onLocaleChange,
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
  const [selectedDeckId, setSelectedDeckId] = useState<'system' | 'resistance' | 'beacon'>('system');
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
  const [cardRevealStage, setCardRevealStage] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [animatedCampaignRoll, setAnimatedCampaignRoll] = useState<CampaignRollPresentation | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const revealQueueRef = useRef<CardRevealQueueItem[]>([]);
  const revealSeenRef = useRef(new Set<string>());
  const revealTimerRef = useRef<number | null>(null);
  const revealPhaseTimerRef = useRef<number | null>(null);
  const lastCampaignRollSeqRef = useRef<number | null>(null);
  const selectedRegionId = viewState.regionId;

  const draftAction = content.actions[draft.actionId];
  const availableCards = focusedPlayer.resistanceHand
    .map((cardId) => content.cards[cardId])
    .filter((card) => card.deck === 'resistance' && (!draftAction.cardType || card.type === draftAction.cardType));
  const disabledReason = getSeatDisabledReason(state, content, focusedPlayer.seat, {
    ...draft,
    targetSeat: draft.targetSeat === focusedPlayer.seat ? undefined : draft.targetSeat,
  });

  const statusItems = getStatusRibbonItems(state, content);
  const frontRows = getFrontTrackRows(state, content);
  const playerSummaries = state.players.map((player) => getPlayerStripSummary(player, content, state));
  const actionItems = getActionDockItems(state, content, focusedPlayer.seat);
  const phasePresentation = getPhasePresentation(state.phase);
  const preparedMovePreview = buildIntentPreview(draft, draftAction, state, content, focusedPlayer.seat);
  const latestCampaignRoll = useMemo(() => getLatestCampaignRoll(state), [state]);
  const latestPublicCardReveal = useMemo(() => getLatestPublicCardReveal(state), [state]);
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
        message: nextDisabledReason.reason ?? t('ui.game.phaseLocked', 'Phase locked'),
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
    : state.phase === 'WIN' || state.phase === 'LOSS';
  const phaseInsights = getPhaseInsights(state, focusedPlayer.seat);
  const recentChangeSnapshots = useMemo(() => getRecentChangeSnapshots(state), [state]);
  const recentChangeSignatures = useMemo(
    () => Object.fromEntries(recentChangeSnapshots.map((item) => [`change:${item.id}`, item.id])),
    [recentChangeSnapshots],
  );
  const liveRecentChanges = useTransientHighlightKeys(recentChangeSignatures, 1900);
  const phaseActionLabel = state.phase === 'SYSTEM'
    ? t('ui.game.playSystemPhase', 'Play System')
    : getActionButtonLabel(state.phase);

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
          {disabledReason.disabled ? <span className="context-warning">{disabledReason.reason}</span> : null}
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
            {group.events.map((event) => (
              <div key={event.seq} className="context-list-row">
                <span>{event.emoji} {event.message}</span>
                <small>{event.sourceId}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const selectedDeckSummary = deckSummaries.find((summary) => summary.deckId === selectedDeckId) ?? deckSummaries[0];
  const selectedDeckCards = state.decks[selectedDeckId].discardPile.slice().reverse();
  const selectedDeckLatestCardId = getLatestRevealCardIdForDeck(state, selectedDeckId);
  const selectedDeckLatestCard = selectedDeckLatestCardId ? getRevealCopy(content, selectedDeckId, selectedDeckLatestCardId) : null;

  const decksContent = selectedDeckSummary ? (
    <div className="context-stack">
      <section className="context-card">
        <span className="context-eyebrow">{t('ui.game.latestReveal', 'Latest reveal')}</span>
        <strong>{selectedDeckSummary.label}</strong>
        <p>{t('ui.game.drawReviewHint', 'Review the latest reveal here, then inspect the discard pile for earlier cards.')}</p>
        {selectedDeckLatestCard ? (
          <CrisisCard
            title={selectedDeckLatestCard.title}
            body={selectedDeckLatestCard.body}
            tag={selectedDeckSummary.label}
            emoji={selectedDeckId === 'beacon' ? '🕯️' : '🃏'}
          />
        ) : (
          <p>{t('ui.game.noRevealYet', 'No card has been revealed for this deck yet.')}</p>
        )}
      </section>

      <section className="context-card">
        <span className="context-eyebrow">{t('ui.game.discardPile', 'Discard pile')}</span>
        <strong>{t('ui.game.cardsInDiscard', '{{count}} in discard', { count: selectedDeckSummary.discardCount })}</strong>
        {selectedDeckCards.length === 0 ? (
          <p>{t('ui.game.noDiscardYet', 'No discarded cards yet.')}</p>
        ) : (
          <div className="context-list">
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

  const openDeckPanel = (deckId: 'system' | 'resistance' | 'beacon') => {
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
  }, []);

  useEffect(() => {
    for (const event of state.eventLog) {
      const reveals = event.context?.cardReveals ?? [];
      reveals.forEach((reveal, revealIndex) => {
        if (!reveal.public) {
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
          deckId: reveal.deckId,
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
    setCardRevealStage('enter');

    if (motionMode === 'reduced') {
      revealTimerRef.current = window.setTimeout(() => {
        setActiveCardReveal(null);
        setActiveCardRevealSeq(null);
      }, 900);
      return;
    }

    revealPhaseTimerRef.current = window.setTimeout(() => setCardRevealStage('hold'), 250);
    revealTimerRef.current = window.setTimeout(() => setCardRevealStage('exit'), 1150);
    window.setTimeout(() => {
      setActiveCardReveal(null);
      setActiveCardRevealSeq(null);
      setCardRevealStage('enter');
    }, 1400);
  }, [activeCardReveal, motionMode, state.eventLog]);

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
    <TableSurface className="game-screen game-screen-compressed">
      <header className="game-header-shell">
        <div className="table-utility-bar">
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
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
              <p>{phasePresentation.copy}</p>
            </div>
            <button type="button" className="ledger-toggle" onClick={() => { setContextMode('ledger'); setContextOpen(true); }}>
              {t('ui.game.ledger', 'Ledger')}
            </button>
          </div>

          <PhaseProgress phase={state.phase} activeContent={phaseProgressControls} activeHint={phaseControlHint} />

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

          <section className="phase-brief-grid" aria-label={t('ui.game.phaseBrief', 'Phase brief')}>
            <article className="phase-brief-card">
              <span className="context-eyebrow">{t('ui.game.thisPhaseChanges', 'This phase changes')}</span>
              <strong>{t(`ui.phases.${state.phase}`, state.phase)}</strong>
              <div className="phase-brief-list">
                {phaseInsights.map((item) => (
                  <div key={item.id} className="phase-brief-item">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="phase-brief-card">
              <span className="context-eyebrow">{t('ui.game.latestChanges', 'Latest changes')}</span>
              <strong>{t('ui.game.whyBoardShifted', 'Why the board shifted')}</strong>
              <div className="phase-brief-list">
                {recentChangeSnapshots.length === 0 ? (
                  <div className="phase-brief-item">
                    <strong>{t('ui.game.noMajorChangeYet', 'No major board change yet')}</strong>
                    <span>{t('ui.game.noMajorChangeYetBody', 'Resolve the current phase to see the next material shifts on tracks, regions, and coalition resources.')}</span>
                  </div>
                ) : (
                  recentChangeSnapshots.map((item) => (
                    <div
                      key={item.id}
                      className={`phase-brief-item ${liveRecentChanges.has(`change:${item.id}`) ? 'is-live' : ''}`.trim()}
                    >
                      <strong>{item.emoji} {item.title}</strong>
                      <span>{item.reason}</span>
                      {item.changes.length > 0 ? <span>{item.changes.join(' • ')}</span> : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <StatusRibbon items={statusItems} />

          <div className="board-map-panel">
            <section className="board-deck-rail" aria-label={t('ui.game.decks', 'Decks')}>
              <div className="board-deck-rail-head">
                <strong>{t('ui.game.decks', 'Decks')}</strong>
                <span>{latestPublicCardReveal ? t('ui.game.drawsVisible', 'Draws reveal on the board before they settle into discard.') : t('ui.game.drawsWaiting', 'Draws will reveal here when the decks move.')}</span>
              </div>
              <div className="board-deck-rail-grid">
                {deckSummaries.map((summary) => (
                  <div
                    key={summary.deckId}
                    className={`board-deck-stack-shell ${selectedDeckId === summary.deckId ? 'is-selected' : ''}`.trim()}
                  >
                    <DeckStack
                      label={summary.label}
                      deckName={summary.label}
                      drawCount={summary.drawCount}
                      discardCount={summary.discardCount}
                      activeCount={summary.activeCount}
                      onClick={() => openDeckPanel(summary.deckId)}
                    />
                    {activeCardReveal?.deckId === summary.deckId ? (
                      <article
                        className={`board-card-reveal board-card-reveal-${cardRevealStage}`.trim()}
                        data-seq={activeCardRevealSeq ?? undefined}
                      >
                        <span className="context-eyebrow">{t('ui.game.drawReveal', 'Draw reveal')}</span>
                        <strong>{getRevealCopy(content, activeCardReveal.deckId, activeCardReveal.cardId).title}</strong>
                        <span>{t('ui.game.revealToDiscard', 'Revealed on the board, then moved to discard.')}</span>
                      </article>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
            <WorldMapBoard
              state={state}
              content={content}
              selectedRegionId={selectedRegionId}
              campaignRoll={animatedCampaignRoll}
              debugLayout={devMode}
              onSelectRegion={(regionId) => {
                onViewStateChange({ regionId });
              }}
            />
          </div>

          <FrontTrackBar rows={frontRows} />
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
    </TableSurface>
  );
}
