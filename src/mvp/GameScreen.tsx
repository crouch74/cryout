import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  getAvailableDomains,
  getAvailableRegions,
  getMandateStatus,
  getPhaseSummary,
  getPlayerBodyTotal,
  getSeatActions,
  getSeatDisabledReason,
  getSeatFaction,
  getVictoryModeSummary,
  serializeGame,
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
  localizeBeaconField,
  localizeCardField,
  localizeDomainField,
  localizeFactionField,
  localizeRegionField,
  localizeRulesetField,
  t,
  type Locale,
} from '../i18n/index.ts';
import { DebugOverlay, type AutoPlaySpeedLevel } from './DebugOverlay.tsx';
import {
  buildIntentPreview,
  GAME_A11Y_LABELS,
  getActiveCoalitionSeat,
  getDomainPresentation,
  getEventSourcePresentation,
  getPhasePresentation,
  getPhaseProgressSteps,
  getSeatPresentation,
  getTrackPresentation,
} from './gameUiHelpers.ts';
import { LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from './tabletop.tsx';
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

type DraftState = Omit<QueuedIntent, 'slot'>;

function createDraft(actionId: DraftState['actionId']): DraftState {
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
      return t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent');
    case 'RESOLUTION':
      return t('ui.game.resolveResolutionPhase', 'Resolve Resolution Phase');
    default:
      return t('ui.game.tableClosed', 'Table Closed');
  }
}

function getAutoPlayDelay(speed: AutoPlaySpeedLevel) {
  return {
    1: 1100,
    2: 720,
    3: 420,
    4: 220,
    5: 90,
  }[speed];
}

function getLocalizedDisabledReason(reason: string | undefined) {
  switch (reason) {
    case 'Phase locked':
      return t('ui.game.phaseLocked', 'Phase locked');
    case 'Unknown seat':
      return t('ui.game.unknownSeat', 'Unknown seat');
    case 'Seat already ready':
      return t('ui.game.seatAlreadyReady', 'Seat already ready');
    case 'No actions remaining':
      return t('ui.game.noActionsRemaining', 'No actions remaining');
    case 'Select a region':
      return t('ui.game.selectRegion', 'Select a region');
    case 'Select a domain':
      return t('ui.game.selectDomain', 'Select a domain');
    case 'Select another seat':
      return t('ui.game.selectAnotherSeat', 'Select another seat');
    case 'Need 3 Bodies in region':
      return t('ui.game.needThreeBodies', 'Need 3 Bodies in region');
    case 'Not enough Evidence':
      return t('ui.game.notEnoughEvidence', 'Not enough Evidence');
    case 'No Evidence to move':
      return t('ui.game.noEvidenceToMove', 'No Evidence to move');
    case 'Need 1 Body in region':
      return t('ui.game.needOneBody', 'Need 1 Body in region');
    case 'Commit at least 1 Body':
      return t('ui.game.commitOneBody', 'Commit at least 1 Body');
    case 'Not enough Bodies in region':
      return t('ui.game.notEnoughBodies', 'Not enough Bodies in region');
    case 'Support card unavailable':
      return t('ui.game.supportCardUnavailable', 'Support card unavailable');
    case 'Action card unavailable':
      return t('ui.game.actionCardUnavailable', 'Action card unavailable');
    case 'Select a card':
      return t('ui.game.selectCard', 'Select a card');
    default:
      return reason;
  }
}

function getPreferredDomain(state: EngineState, regionId: RegionId): DomainId {
  const top = Object.entries(state.regions[regionId].vulnerability)
    .sort((left, right) => right[1] - left[1])[0]?.[0] as DomainId | undefined;
  return top ?? DOMAIN_IDS[0];
}

function getActionCardIntent(state: EngineState, content: CompiledContent, seat: number): DraftState | null {
  const player = state.players[seat];
  const actionCard = player.resistanceHand
    .map((cardId) => content.cards[cardId])
    .find((card) => card.deck === 'resistance' && card.type === 'action');
  if (!actionCard) {
    return null;
  }
  const regionId = REGION_IDS.slice().sort((left, right) => state.regions[right].extractionTokens - state.regions[left].extractionTokens)[0];
  return {
    actionId: 'play_card',
    regionId,
    domainId: getPreferredDomain(state, regionId),
    targetSeat: undefined,
    bodiesCommitted: 1,
    evidenceCommitted: 0,
    cardId: actionCard.id,
  };
}

function getCampaignIntent(state: EngineState, content: CompiledContent, seat: number): DraftState | null {
  const player = state.players[seat];
  const faction = content.factions[player.factionId];
  const regionId = REGION_IDS
    .filter((candidate) => (state.regions[candidate].bodiesPresent[seat] ?? 0) > 0)
    .sort((left, right) => {
      const extractionDelta = state.regions[right].extractionTokens - state.regions[left].extractionTokens;
      if (extractionDelta !== 0) {
        return extractionDelta;
      }
      if (left === faction.homeRegion) {
        return 1;
      }
      if (right === faction.homeRegion) {
        return -1;
      }
      return 0;
    })[0];

  if (!regionId) {
    return null;
  }

  const bodiesAvailable = state.regions[regionId].bodiesPresent[seat] ?? 0;
  const domainId = faction.campaignDomainBonus ?? getPreferredDomain(state, regionId);
  const supportCard = player.resistanceHand
    .map((cardId) => content.cards[cardId])
    .find(
      (card) =>
        card.deck === 'resistance'
        && card.type === 'support'
        && (!card.domainBonus || card.domainBonus === domainId)
        && (!card.regionBonus || card.regionBonus === 'ANY' || card.regionBonus === regionId),
    );

  return {
    actionId: 'launch_campaign',
    regionId,
    domainId,
    targetSeat: undefined,
    bodiesCommitted: Math.max(1, Math.min(3, bodiesAvailable >= 4 ? 3 : bodiesAvailable >= 2 ? 2 : 1)),
    evidenceCommitted: Math.min(2, player.evidence),
    cardId: supportCard?.id,
  };
}

function getDefendIntent(state: EngineState, content: CompiledContent, seat: number): DraftState | null {
  const faction = content.factions[state.players[seat].factionId];
  const regionId = REGION_IDS
    .filter((candidate) => (state.regions[candidate].bodiesPresent[seat] ?? 0) > 0)
    .sort((left, right) => {
      const extractionDelta = state.regions[right].extractionTokens - state.regions[left].extractionTokens;
      if (extractionDelta !== 0) {
        return extractionDelta;
      }
      if (left === faction.homeRegion) {
        return -1;
      }
      if (right === faction.homeRegion) {
        return 1;
      }
      return 0;
    })[0];

  if (!regionId || state.regions[regionId].extractionTokens < 3) {
    return null;
  }

  return {
    actionId: 'defend',
    regionId,
    domainId: getPreferredDomain(state, regionId),
    targetSeat: undefined,
    bodiesCommitted: Math.min(2, state.regions[regionId].bodiesPresent[seat] ?? 1),
    evidenceCommitted: 0,
    cardId: undefined,
  };
}

function getBuildSolidarityIntent(state: EngineState, seat: number): DraftState | null {
  const regionId = REGION_IDS
    .filter((candidate) => (state.regions[candidate].bodiesPresent[seat] ?? 0) >= 3)
    .sort((left, right) => (state.regions[right].bodiesPresent[seat] ?? 0) - (state.regions[left].bodiesPresent[seat] ?? 0))[0];

  if (!regionId) {
    return null;
  }

  return {
    actionId: 'build_solidarity',
    regionId,
    domainId: getPreferredDomain(state, regionId),
    targetSeat: undefined,
    bodiesCommitted: 3,
    evidenceCommitted: 0,
    cardId: undefined,
  };
}

function getSmuggleIntent(state: EngineState, seat: number): DraftState | null {
  const player = state.players[seat];
  const regionId = REGION_IDS.find((candidate) => (state.regions[candidate].bodiesPresent[seat] ?? 0) >= 1);
  const targetSeat = state.players
    .filter((candidate) => candidate.seat !== seat)
    .sort((left, right) => left.evidence - right.evidence)[0]?.seat;

  if (!regionId || targetSeat === undefined || player.evidence <= 0) {
    return null;
  }

  return {
    actionId: 'smuggle_evidence',
    regionId,
    domainId: getPreferredDomain(state, regionId),
    targetSeat,
    bodiesCommitted: 1,
    evidenceCommitted: 0,
    cardId: undefined,
  };
}

function getNextAutoPlayIntent(state: EngineState, content: CompiledContent, seat: number): DraftState {
  const player = state.players[seat];
  const faction = content.factions[player.factionId];
  const homeRegion = faction.homeRegion;
  const outreachCost = 2 + faction.outreachPenalty;
  const candidates: DraftState[] = [];

  const actionCardIntent = getActionCardIntent(state, content, seat);
  if (actionCardIntent) {
    candidates.push(actionCardIntent);
  }

  const defendIntent = getDefendIntent(state, content, seat);
  if (defendIntent) {
    candidates.push(defendIntent);
  }

  const campaignIntent = getCampaignIntent(state, content, seat);
  if (campaignIntent) {
    candidates.push(campaignIntent);
  }

  const buildSolidarityIntent = getBuildSolidarityIntent(state, seat);
  if (buildSolidarityIntent) {
    candidates.push(buildSolidarityIntent);
  }

  if (player.evidence < 2 || player.resistanceHand.length === 0) {
    candidates.push({
      actionId: 'investigate',
      regionId: homeRegion,
      domainId: getPreferredDomain(state, homeRegion),
      targetSeat: undefined,
      bodiesCommitted: 1,
      evidenceCommitted: 0,
      cardId: undefined,
    });
  }

  if (player.evidence >= outreachCost && state.globalGaze < 12) {
    candidates.push({
      actionId: 'international_outreach',
      regionId: homeRegion,
      domainId: getPreferredDomain(state, homeRegion),
      targetSeat: undefined,
      bodiesCommitted: 1,
      evidenceCommitted: 0,
      cardId: undefined,
    });
  }

  const smuggleIntent = getSmuggleIntent(state, seat);
  if (smuggleIntent) {
    candidates.push(smuggleIntent);
  }

  candidates.push({
    actionId: 'organize',
    regionId: homeRegion,
    domainId: getPreferredDomain(state, homeRegion),
    targetSeat: undefined,
    bodiesCommitted: 1,
    evidenceCommitted: 0,
    cardId: undefined,
  });

  for (const candidate of candidates) {
    const disabled = getSeatDisabledReason(state, content, seat, candidate);
    if (!disabled.disabled) {
      return candidate;
    }
  }

  return {
    actionId: 'organize',
    regionId: REGION_IDS[0],
    domainId: DOMAIN_IDS[0],
    targetSeat: undefined,
    bodiesCommitted: 1,
    evidenceCommitted: 0,
    cardId: undefined,
  };
}

function getNextAutoPlayCommand(state: EngineState, content: CompiledContent): EngineCommand | null {
  if (state.phase === 'SYSTEM') {
    return { type: 'ResolveSystemPhase' };
  }

  if (state.phase === 'COALITION') {
    const nextPlayer = state.players.find((player) => !player.ready);
    if (!nextPlayer) {
      return { type: 'CommitCoalitionIntent' };
    }
    if (nextPlayer.actionsRemaining > 0) {
      return {
        type: 'QueueIntent',
        seat: nextPlayer.seat,
        action: getNextAutoPlayIntent(state, content, nextPlayer.seat),
      };
    }
    return { type: 'SetReady', seat: nextPlayer.seat, ready: true };
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
  const useOfflineSeatOrder = surface === 'local' && state.phase === 'COALITION';
  const activeSeat = useOfflineSeatOrder ? getActiveCoalitionSeat(state.players) : (authorizedSeat ?? viewState.focusedSeat);
  const focusedSeat = surface === 'room' && authorizedSeat !== null && authorizedSeat !== undefined
    ? authorizedSeat
    : activeSeat;
  const focusedPlayer = state.players[focusedSeat] ?? state.players[0];
  const faction = getSeatFaction(state, content, focusedPlayer.seat);
  const mandate = getMandateStatus(state, content, focusedPlayer.seat);
  const universalActions = getSeatActions(content);
  const [draft, setDraft] = useState<DraftState>(() => createDraft('organize'));
  const [copied, setCopied] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showDebugSnapshot, setShowDebugSnapshot] = useState(false);
  const [autoPlayRounds, setAutoPlayRounds] = useState('3');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<AutoPlaySpeedLevel>(3);
  const [autoPlayRunning, setAutoPlayRunning] = useState(false);
  const [autoPlayStatus, setAutoPlayStatus] = useState<string | null>(null);
  const [autoPlayTargetRound, setAutoPlayTargetRound] = useState<number | null>(null);
  const [pulsedStats, setPulsedStats] = useState<string[]>([]);
  const previousFocusedSnapshotRef = useRef<{
    seat: number;
    comrades: number;
    witness: number;
    moves: number;
    globalGaze: number;
    northernWarMachine: number;
  } | null>(null);

  const draftAction = content.actions[draft.actionId];
  const availableCards = focusedPlayer.resistanceHand
    .map((cardId) => content.cards[cardId])
    .filter((card) => card.deck === 'resistance' && (!draftAction.cardType || card.type === draftAction.cardType));
  const disabledReason = state.phase === 'COALITION'
    ? getSeatDisabledReason(state, content, focusedPlayer.seat, {
        ...draft,
        targetSeat: draft.targetSeat === focusedPlayer.seat ? undefined : draft.targetSeat,
      })
    : { disabled: true, reason: 'Phase locked', actionId: draft.actionId };

  const visibleEvents = useMemo(() => state.eventLog.slice().reverse().slice(0, 8), [state.eventLog]);
  const selectedRegionId = viewState.regionId
    ?? REGION_IDS.slice().sort((left, right) => state.regions[right].extractionTokens - state.regions[left].extractionTokens)[0];
  const comradesTotal = getPlayerBodyTotal(state, focusedPlayer.seat);

  const stopAutoPlay = useEffectEvent((message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAutoPlayRunning(false);
    setAutoPlayTargetRound(null);
    setAutoPlayStatus(message);
    onToast({
      tone,
      title: t('ui.game.developerTools', 'Developer Tools'),
      message,
      dismissAfterMs: 2600,
    });
  });

  const sendAutoPlayCommand = useEffectEvent(async (command: EngineCommand) => {
    try {
      await onCommand(command);
    } catch {
      stopAutoPlay(t('ui.debug.autoplayCommandError', 'Autoplay stopped after a command error.'), 'error');
    }
  });

  useEffect(() => {
    if (!autoPlayRunning) {
      return;
    }

    if (state.phase === 'WIN') {
      stopAutoPlay(t('ui.debug.autoplayWon', 'Autoplay stopped because the coalition won.'), 'success');
      return;
    }

    if (state.phase === 'LOSS') {
      stopAutoPlay(t('ui.debug.autoplayLost', 'Autoplay stopped because the coalition lost.'), 'warning');
      return;
    }

    if (autoPlayTargetRound !== null && state.round >= autoPlayTargetRound && state.phase === 'SYSTEM') {
      stopAutoPlay(
        t('ui.debug.autoplayFinished', 'Autoplay finished at the requested round mark.'),
        'success',
      );
      return;
    }

    const nextCommand = getNextAutoPlayCommand(state, content);
    if (!nextCommand) {
      stopAutoPlay(t('ui.debug.autoplayNoCommand', 'Autoplay found no legal command and stopped.'), 'warning');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAutoPlayStatus(
        t('ui.debug.autoplayTick', 'Autoplay: round {{round}}, phase {{phase}}.', {
          round: state.round,
          phase: t(`ui.phases.${state.phase}`, state.phase),
        }),
      );
      void sendAutoPlayCommand(nextCommand);
    }, getAutoPlayDelay(autoPlaySpeed));

    return () => window.clearTimeout(timeoutId);
  }, [autoPlayRunning, autoPlaySpeed, autoPlayTargetRound, content, sendAutoPlayCommand, state, stopAutoPlay]);

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

  const queueIntent = () => {
    if (disabledReason.disabled) {
      return;
    }
    void onCommand({
      type: 'QueueIntent',
      seat: focusedPlayer.seat,
      action: {
        ...draft,
        targetSeat: draft.targetSeat === focusedPlayer.seat ? undefined : draft.targetSeat,
      },
    });
    setDraft((current) => createDraft(current.actionId));
  };

  const phaseActionDisabled = state.phase === 'COALITION'
    ? !state.players.every((player) => player.ready)
    : state.phase === 'WIN' || state.phase === 'LOSS';

  const startAutoPlay = () => {
    const rounds = Number(autoPlayRounds);
    if (!Number.isFinite(rounds) || rounds < 1) {
      setAutoPlayStatus(t('ui.debug.autoplayInvalid', 'Enter a valid round count before starting autoplay.'));
      return;
    }
    setShowDebugPanel(true);
    setAutoPlayTargetRound(state.round + rounds);
    setAutoPlayRunning(true);
    setAutoPlayStatus(
      t('ui.debug.autoplayArmed', 'Autoplay armed for {{count}} rounds.', { count: rounds }),
    );
  };

  const activeBeacons = state.activeBeaconIds.map((beaconId) => ({
    id: beaconId,
    title: localizeBeaconField(beaconId, 'title', content.beacons[beaconId].title),
    description: localizeBeaconField(beaconId, 'description', content.beacons[beaconId].description),
    complete: state.beacons[beaconId]?.complete ?? false,
  }));
  const phasePresentation = getPhasePresentation(state.phase);
  const phaseSteps = getPhaseProgressSteps(state.phase);
  const trackPresentation = getTrackPresentation(state);
  const seatPresentation = getSeatPresentation(focusedPlayer, content, state);
  const seatSummaries = state.players.map((player) => getSeatPresentation(player, content, state));
  const domainFronts = DOMAIN_IDS.map((domainId) => ({
    id: domainId,
    name: localizeDomainField(domainId, 'name', content.domains[domainId].name),
    presentation: getDomainPresentation(domainId, state, content),
    progress: state.domains[domainId].progress,
  }));
  const preparedMovePreview = buildIntentPreview(draft, draftAction, state, content, focusedPlayer.seat);
  const liberationThresholdCount = REGION_IDS.filter((regionId) => state.regions[regionId].extractionTokens <= 1).length;
  const regionsAboveThreshold = REGION_IDS.length - liberationThresholdCount;
  const criticalRegions = REGION_IDS.filter((regionId) => state.regions[regionId].extractionTokens >= 4).length;
  const pressureCardSeverity = criticalRegions > 0 ? 'critical' : regionsAboveThreshold > 0 ? 'danger' : 'steady';
  const symbolicOpenBeacons = activeBeacons.filter((beacon) => !beacon.complete).length;
  const symbolicCompleteBeacons = activeBeacons.length - symbolicOpenBeacons;
  const ledgerGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      round: number;
      phase: EngineState['phase'];
      events: typeof visibleEvents;
    }> = [];

    for (const event of visibleEvents) {
      const key = `${event.round}-${event.phase}`;
      const current = groups.at(-1);
      if (current && current.key === key) {
        current.events.push(event);
      } else {
        groups.push({
          key,
          round: event.round,
          phase: event.phase,
          events: [event],
        });
      }
    }

    return groups;
  }, [visibleEvents]);

  useEffect(() => {
    const snapshot = {
      seat: focusedPlayer.seat,
      comrades: comradesTotal,
      witness: focusedPlayer.evidence,
      moves: focusedPlayer.actionsRemaining,
      globalGaze: state.globalGaze,
      northernWarMachine: state.northernWarMachine,
    };
    const previous = previousFocusedSnapshotRef.current;
    previousFocusedSnapshotRef.current = snapshot;

    if (!previous || previous.seat !== snapshot.seat) {
      return;
    }

    const changed = [
      previous.comrades !== snapshot.comrades ? 'comrades' : null,
      previous.witness !== snapshot.witness ? 'witness' : null,
      previous.moves !== snapshot.moves ? 'moves' : null,
      previous.globalGaze !== snapshot.globalGaze ? 'globalGaze' : null,
      previous.northernWarMachine !== snapshot.northernWarMachine ? 'northernWarMachine' : null,
    ].filter((value): value is string => Boolean(value));

    if (changed.length === 0) {
      return;
    }

    setPulsedStats(changed);
    const timeoutId = window.setTimeout(() => setPulsedStats([]), 900);
    return () => window.clearTimeout(timeoutId);
  }, [
    comradesTotal,
    focusedPlayer.actionsRemaining,
    focusedPlayer.evidence,
    focusedPlayer.seat,
    state.globalGaze,
    state.northernWarMachine,
  ]);

  return (
    <TableSurface className="game-table">
      <header className="game-header">
        <PaperSheet tone="board" className="command-folio">
          <div className="minutes-header">
            <div className="minutes-masthead">
              <span className="engraved-eyebrow">
                {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
              </span>
              <h1>{state.mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic')}</h1>
              <p>
                {state.mode === 'LIBERATION'
                  ? t('ui.mode.liberationSummary', getVictoryModeSummary(state.mode))
                  : t('ui.mode.symbolicSummary', getVictoryModeSummary(state.mode))}
              </p>
            </div>
            <div className="minutes-utility-strip">
              <div className="header-action-plates">
                <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
                <ThemePlate
                  label={surface === 'room' && roomId
                    ? t('ui.game.room', 'Room {{roomId}}', { roomId })
                    : t('ui.game.localTable', 'Local Table')}
                  onClick={() => {}}
                />
                {devMode ? (
                  <ThemePlate
                    label={showDebugPanel ? t('ui.game.hideDebug', 'Hide Debug') : t('ui.game.showDebug', 'Show Debug')}
                    active={showDebugPanel}
                    onClick={() => setShowDebugPanel((current) => !current)}
                  />
                ) : null}
                <ThemePlate
                  label={copied ? t('ui.game.saveCopied', 'Save Copied') : t('ui.game.exportSave', 'Export Save')}
                  onClick={() => {
                    onExportSave(serializeGame(state));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  }}
                />
                <ThemePlate label={t('ui.game.backHome', 'Back Home')} onClick={onBack} />
              </div>
            </div>
          </div>
          <div className="command-deck">
            <section className="priority-column priority-now">
              <span className="engraved-eyebrow">{t('ui.game.now', 'Now')}</span>
              <article className="priority-card phase-command-card" data-urgency="active">
                <div className="phase-command-head">
                  <div className="phase-identity-mark">{phasePresentation.icon}</div>
                  <div>
                    <span className="priority-label">{t(`ui.phases.${state.phase}`, state.phase)}</span>
                    <strong>{phasePresentation.verb}</strong>
                    <p>{t(`ui.phaseSummary.${state.phase}`, getPhaseSummary(state.phase))}</p>
                  </div>
                  <span className="urgency-badge">{phasePresentation.urgency}</span>
                </div>
                <div className="phase-progress" aria-label={GAME_A11Y_LABELS.phaseProgress}>
                  {phaseSteps.map((step) => (
                    <div key={step.step} className={`phase-chip ${step.state}`} aria-current={step.current}>
                      <span>{step.icon}</span>
                      <div>
                        <strong>{t(`ui.phases.${step.step}`, step.step)}</strong>
                        <small>{step.verb}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="phase-command-foot">
                  <p>{phasePresentation.copy}</p>
                  <ThemePlate label={getActionButtonLabel(state.phase)} disabled={phaseActionDisabled} onClick={runPhaseAction} />
                </div>
              </article>
            </section>

            <section className="priority-column priority-soon">
              <span className="engraved-eyebrow">{t('ui.game.soon', 'Soon')}</span>
              <article className="priority-card mission-card">
                <span className="priority-label">{t('ui.game.currentObjective', 'Current Objective')}</span>
                <strong>
                  {state.mode === 'LIBERATION'
                    ? t('ui.mode.liberationSummary', getVictoryModeSummary(state.mode))
                    : t('ui.mode.symbolicSummary', getVictoryModeSummary(state.mode))}
                </strong>
                <p>
                  {state.mode === 'LIBERATION'
                    ? t('ui.mode.liberationProgress', '{{count}} regions already sit at the threshold.', {
                        count: liberationThresholdCount,
                      })
                    : t('ui.mode.symbolicProgress', '{{count}} of {{total}} active Beacons are complete.', {
                        count: symbolicCompleteBeacons,
                        total: activeBeacons.length,
                      })}
                </p>
              </article>
              <article className="priority-card mission-card" data-severity={pressureCardSeverity}>
                <div className="mission-card-head">
                  <span className="priority-label">{t('ui.game.pressureWatch', 'Pressure Watch')}</span>
                  <span className="urgency-badge">
                    {state.mode === 'LIBERATION'
                      ? criticalRegions > 0
                        ? t('ui.game.breachNear', 'Breach Near')
                        : t('ui.game.thresholdWatch', 'Threshold Watch')
                      : symbolicOpenBeacons === 0
                        ? t('ui.game.beaconsAligned', 'Beacons Aligned')
                        : t('ui.game.openBeacons', 'Open Beacons')}
                  </span>
                </div>
                <strong>
                  {state.mode === 'LIBERATION'
                    ? t('ui.mode.liberationStatus', 'Keep every theatre below the breach line while preserving all solemn charges.')
                    : t('ui.game.beaconPressureSummary', '{{count}} beacon objectives still need to be completed.', {
                        count: symbolicOpenBeacons,
                      })}
                </strong>
                <p>
                  {state.mode === 'LIBERATION'
                    ? t('ui.game.regionsAboveThreshold', '{{count}} regions remain above the liberation threshold.', {
                        count: regionsAboveThreshold,
                      })
                    : activeBeacons.map((beacon) => `${beacon.complete ? '✓' : '•'} ${beacon.title}`).join(' • ')}
                </p>
              </article>
            </section>

            <section className="priority-column priority-reference">
              <span className="engraved-eyebrow">{t('ui.game.reference', 'Reference')}</span>
              <div className="reference-grid" aria-label={GAME_A11Y_LABELS.sharedResources}>
                <article className="reference-card">
                  <span>{t('ui.game.round', 'Round')}</span>
                  <strong>{formatNumber(state.round)}</strong>
                </article>
                <article className="reference-card">
                  <span>{t('ui.game.extractionPool', 'Extraction Pool')}</span>
                  <strong>{formatNumber(state.extractionPool)}</strong>
                </article>
                {Object.values(trackPresentation).map((track) => (
                  <article
                    key={track.id}
                    className={`reference-card track-reference-card ${pulsedStats.includes(track.id) ? 'is-pulsed' : ''}`.trim()}
                    data-severity={track.severity}
                  >
                    <div className="track-reference-head">
                      <span>{track.id === 'globalGaze'
                        ? t('ui.game.globalGaze', 'Global Gaze')
                        : t('ui.game.northernWarMachine', 'Northern War Machine')}
                      </span>
                      <strong>{formatNumber(track.value)} / {formatNumber(track.max)}</strong>
                    </div>
                    <div className="track-meter" aria-hidden="true">
                      <div className="track-meter-fill" style={{ width: `${track.percent}%` }} />
                      {track.thresholds.map((threshold) => (
                        <span
                          key={threshold}
                          className="track-threshold"
                          style={{ left: `${(threshold / track.max) * 100}%` }}
                        />
                      ))}
                    </div>
                    <p>{track.status}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </PaperSheet>
      </header>

      <main className="game-main-grid">
        <section className="game-board-column">
          <PaperSheet tone="board" className="game-map-panel">
            <WorldMapBoard
              state={state}
              content={content}
              selectedRegionId={selectedRegionId}
              onSelectRegion={(regionId) => onViewStateChange({ regionId })}
            />
          </PaperSheet>

          <PaperSheet tone="board" className="domain-fronts-panel">
            <div className="panel-heading">
              <span className="engraved-eyebrow">{t('ui.game.domains', 'Domains')}</span>
              <strong>{t('ui.game.frontsUnderStrain', 'Fronts under strain')}</strong>
            </div>
            <div className="domain-front-grid">
              {domainFronts.map((domain) => (
                <article
                  key={domain.id}
                  className={`domain-front-card ${domain.presentation.accentClass}`.trim()}
                  data-severity={domain.presentation.severity}
                >
                  <div className="domain-front-head">
                    <span className="domain-front-icon">{domain.presentation.icon}</span>
                    <div>
                      <strong>{domain.name}</strong>
                      <p>{domain.presentation.summary}</p>
                    </div>
                  </div>
                  <div className="domain-front-meter" aria-hidden="true">
                    <div className="domain-front-meter-fill" style={{ width: `${domain.presentation.percent}%` }} />
                  </div>
                  <div className="domain-front-pips" aria-hidden="true">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <span key={`${domain.id}-${index}`} className={index < domain.progress ? 'is-filled' : ''} />
                    ))}
                  </div>
                  <small>{t('ui.game.progress', 'Progress')}: {formatNumber(domain.progress)} / 12</small>
                </article>
              ))}
            </div>
          </PaperSheet>
        </section>

        <aside className="game-side-column" aria-label={GAME_A11Y_LABELS.coalitionDesk}>
          <PaperSheet tone="tray" className={`seat-mat ${seatPresentation.ribbonClass}`.trim()} data-urgency={seatPresentation.urgency}>
            <span className="engraved-eyebrow">{t('ui.game.focusedSeat', 'Focused Seat')}</span>
            {surface === 'local' ? (
              <div className="seat-crest-row">
                {state.players.map((player, index) => (
                  <button
                    key={player.seat}
                    type="button"
                    className={`seat-crest-button ${focusedSeat === player.seat ? 'is-active' : ''} ${seatSummaries[index]?.ribbonClass ?? ''}`.trim()}
                    onClick={() => onViewStateChange({ focusedSeat: player.seat })}
                  >
                    <span>{t('ui.game.seat', 'Seat {{seat}}', { seat: player.seat + 1 })}</span>
                    <strong>{seatSummaries[index]?.crestLabel}</strong>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="seat-mat-header">
              <div>
                <h2>{localizeFactionField(faction.id, 'name', faction.name)}</h2>
                <p>{seatPresentation.crestSubline}</p>
              </div>
              <span className="seat-status-tag">{seatPresentation.readiness}</span>
            </div>
            <p>{localizeFactionField(faction.id, 'passive', faction.passive)}</p>
            <p><strong>{t('ui.game.weakness', 'Weakness')}:</strong> {localizeFactionField(faction.id, 'weakness', faction.weakness)}</p>
            <div className="resource-piece-row">
              <article className={`resource-piece ${pulsedStats.includes('comrades') ? 'is-pulsed' : ''}`.trim()}>
                <span className="resource-piece-label">{t('ui.game.comrades', 'Comrades')}</span>
                <strong>{formatNumber(comradesTotal)}</strong>
              </article>
              <article className={`resource-piece ${pulsedStats.includes('witness') ? 'is-pulsed' : ''}`.trim()}>
                <span className="resource-piece-label">{t('ui.game.witness', 'Witness')}</span>
                <strong>{formatNumber(focusedPlayer.evidence)}</strong>
              </article>
              <article className={`resource-piece ${pulsedStats.includes('moves') ? 'is-pulsed' : ''}`.trim()}>
                <span className="resource-piece-label">{t('ui.game.moves', 'Moves')}</span>
                <strong>{formatNumber(focusedPlayer.actionsRemaining)}</strong>
              </article>
            </div>
            <div className="solemn-charge-card">
              <div>
                <span>{t('ui.game.solemnCharge', 'Solemn Charge')}</span>
                <strong>{localizeFactionField(faction.id, 'mandateTitle', mandate.title)}</strong>
                <p>{localizeFactionField(faction.id, 'mandateDescription', mandate.description)}</p>
              </div>
            </div>
          </PaperSheet>

          <PaperSheet tone="tray" className="prepared-moves-panel">
            <span className="engraved-eyebrow">{t('ui.game.preparedMoves', 'Prepared Moves')}</span>
            {focusedPlayer.queuedIntents.length === 0 ? (
              <div className="prepared-moves-empty">
                <strong>{t('ui.game.noPreparedMoves', 'No prepared moves yet.')}</strong>
                <p>{t('ui.game.suggestedNextMove', 'Suggested next move.')}</p>
                <div className="ghost-slot-row" aria-hidden="true">
                  <span className="ghost-slot" />
                  <span className="ghost-slot" />
                </div>
                <div className="suggestion-list">
                  <span>{t('ui.game.organizeHomeRegion', 'Organize in home region')}</span>
                  <span>{t('ui.game.investigateForWitness', 'Investigate for witness')}</span>
                </div>
              </div>
            ) : null}
            {focusedPlayer.queuedIntents.map((intent) => (
              <article key={`${intent.actionId}-${intent.slot}`} className="prepared-move-card">
                <span className="prepared-move-order">{formatNumber(intent.slot + 1)}</span>
                <span>{localizeActionField(intent.actionId, 'name', content.actions[intent.actionId].name)}</span>
                <strong>
                  {intent.regionId ? localizeRegionField(intent.regionId, 'name', content.regions[intent.regionId].name) : t('ui.game.noRegion', 'No region')}
                  {intent.domainId ? ` • ${localizeDomainField(intent.domainId, 'name', content.domains[intent.domainId].name)}` : ''}
                </strong>
                <button
                  type="button"
                  className="mini-plate"
                  onClick={() => void onCommand({ type: 'RemoveQueuedIntent', seat: focusedPlayer.seat, slot: intent.slot })}
                >
                  {t('ui.game.remove', 'Remove')}
                </button>
              </article>
            ))}
            {state.phase === 'COALITION' ? (
              <ThemePlate
                label={focusedPlayer.ready ? t('ui.game.seatReady', 'Seat Ready') : t('ui.game.markSeatReady', 'Mark Seat Ready')}
                active={focusedPlayer.ready}
                disabled={focusedPlayer.actionsRemaining > 0}
                onClick={() => void onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready: !focusedPlayer.ready })}
              />
            ) : null}
          </PaperSheet>

          <PaperSheet tone="tray" className="move-module">
            <div className="panel-heading">
              <span className="engraved-eyebrow">{t('ui.game.playMove', 'Play Move')}</span>
              <strong>{localizeActionField(draftAction.id, 'name', draftAction.name)}</strong>
            </div>
            <label>
              <span>{t('ui.game.move', 'Move')}</span>
              <select
                value={draft.actionId}
                onChange={(event) => setDraft(createDraft(event.target.value as DraftState['actionId']))}
              >
                {universalActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {localizeActionField(action.id, 'name', action.name)}
                  </option>
                ))}
              </select>
            </label>
            {draftAction.needsRegion ? (
              <label>
                <span>{t('ui.game.region', 'Region')}</span>
                <select value={draft.regionId} onChange={(event) => setDraft((current) => ({ ...current, regionId: event.target.value as DraftState['regionId'] }))}>
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
                <select value={draft.domainId} onChange={(event) => setDraft((current) => ({ ...current, domainId: event.target.value as DraftState['domainId'] }))}>
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
                <span>{t('ui.game.comradesCommitted', 'Comrades Committed')}</span>
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
                <span>{t('ui.game.witnessCommitted', 'Witness Committed')}</span>
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
            <p>{localizeActionField(draftAction.id, 'description', draftAction.description)}</p>
            <div className="move-preview-strip">
              {preparedMovePreview.map((chip) => (
                <span key={chip.id} className={`preview-chip tone-${chip.tone}`.trim()}>
                  <strong>{chip.label}:</strong> {chip.value}
                </span>
              ))}
            </div>
            {disabledReason.disabled && disabledReason.reason ? (
              <p className="move-module-warning">{getLocalizedDisabledReason(disabledReason.reason)}</p>
            ) : null}
            <ThemePlate
              label={getLocalizedDisabledReason(disabledReason.reason) ?? t('ui.game.prepareMove', 'Prepare Move')}
              disabled={disabledReason.disabled}
              onClick={queueIntent}
            />
          </PaperSheet>

          <PaperSheet tone="tray" className="ledger-book" aria-label={GAME_A11Y_LABELS.liveUpdates}>
            <span className="engraved-eyebrow">{t('ui.game.latestLedger', 'Latest Ledger')}</span>
            <div className="ledger-spine">
              {ledgerGroups.map((group) => (
                <section key={group.key} className="ledger-group">
                  <header className="ledger-group-header">
                    <strong>{t('ui.game.round', 'Round')} {formatNumber(group.round)}</strong>
                    <span>{t(`ui.phases.${group.phase}`, group.phase)}</span>
                  </header>
                  {group.events.map((event) => {
                    const source = getEventSourcePresentation(event.sourceType);
                    return (
                      <article key={event.seq} className="ledger-entry-card">
                        <span className="ledger-entry-source">{source.icon}</span>
                        <div>
                          <span>{event.emoji} {event.message}</span>
                          <strong>{source.label} • {event.sourceId}</strong>
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          </PaperSheet>
        </aside>
      </main>

      {devMode && showDebugPanel ? (
        <DebugOverlay
          state={state}
          roomId={roomId}
          showDebugSnapshot={showDebugSnapshot}
          autoPlayRounds={autoPlayRounds}
          autoPlaySpeed={autoPlaySpeed}
          autoPlayRunning={autoPlayRunning}
          autoPlayStatus={autoPlayStatus}
          onToggleDebugSnapshot={() => setShowDebugSnapshot((current) => !current)}
          onAutoPlayRoundsChange={setAutoPlayRounds}
          onAutoPlaySpeedChange={setAutoPlaySpeed}
          onAutoPlayStart={startAutoPlay}
          onAutoPlayStop={() => stopAutoPlay(t('ui.debug.autoplayStopped', 'Autoplay stopped.'), 'info')}
          onClose={() => {
            if (autoPlayRunning) {
              stopAutoPlay(t('ui.debug.autoplayStopped', 'Autoplay stopped.'), 'info');
            }
            setShowDebugPanel(false);
          }}
        />
      ) : null}
    </TableSurface>
  );
}
