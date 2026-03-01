import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  getAvailableFronts,
  getAvailableRegions,
  getEndingTierSummary,
  getScenarioRuleStatus,
  getSeatActions,
  getSeatDisabledReason,
  getTemperatureBand,
  serializeGame,
  type ActionTarget,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type Phase,
  type PlayerState,
  type RegionId,
  type ResourceType,
} from '../../engine/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import type { Locale } from '../i18n/index.ts';
import { formatNumber, formatTemperature, getCivicSpaceLabel, getEndingTierLabel, getRoleName, t } from '../i18n/index.ts';
import { ActionBoard } from './ActionBoard.tsx';
import { BOARD_FRONT_RAIL, BOARD_PHASE_RAIL, BOARD_REGION_BLUEPRINT } from './boardBlueprint.ts';
import { DebugOverlay, type AutoPlaySpeedLevel } from './DebugOverlay.tsx';
import { DealModal } from './DealModal.tsx';
import { getActiveCoalitionSeat } from './gameUiHelpers.ts';
import { RegionDrawer } from './RegionDrawer.tsx';
import { TraceDrawer } from './TraceDrawer.tsx';
import type { ToastMessage } from './ToastStack.tsx';
import {
  CivicBoard,
  CommitMarker,
  CrisisCard,
  DeckStack,
  DocumentFolio,
  EngravedHeader,
  NotesPad,
  PaperSheet,
  RotateHint,
  TableSurface,
  TabletopControls,
  TokenStack,
  ThemePlate,
  WaxSealLock,
} from './tabletop.tsx';
import type { GameViewState } from './urlState.ts';

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
  onToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onBack: () => void;
  onExportSave: (serialized: string) => void;
}

const RESOURCE_KEYS: ResourceType[] = ['solidarity', 'evidence', 'capacity', 'relief'];
const RESOURCE_META: Record<ResourceType, { icon: string; shape: 'disc' | 'cube' | 'bar' | 'marker' }> = {
  solidarity: { icon: '◎', shape: 'disc' },
  evidence: { icon: '▣', shape: 'cube' },
  capacity: { icon: '▭', shape: 'bar' },
  relief: { icon: '◆', shape: 'marker' },
};
const AUTOPLAY_SPEED_DELAYS: Record<AutoPlaySpeedLevel, number> = {
  1: 1800,
  2: 1300,
  3: 900,
  4: 600,
  5: 320,
};
const TERMINAL_PHASES: Phase[] = ['WIN', 'LOSS'];
const WORLD_MAP_ASSET_URL = `${import.meta.env.BASE_URL}assets/world-map-board.svg`;

function seatTone(seat: number) {
  return `seat-${seat + 1}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parsePercent(value: string) {
  return Number.parseFloat(value);
}

function parsePixelOffset(value: string) {
  return Number.parseFloat(value);
}

function renderRegionStack(count: number, className: string, keyPrefix: string) {
  if (count <= 0) {
    return null;
  }

  return <span key={keyPrefix} className={className} data-depth={Math.min(count, 3)} />;
}

const MAP_FOCUS_REFERENCE_WIDTH = 980;
const MAP_FOCUS_REFERENCE_HEIGHT = 560;
const MAP_FOCUS_MARGIN_X = 4.5;
const MAP_FOCUS_MARGIN_Y = 6.5;
const MAP_FOCUS_MIN_WIDTH = 28;
const MAP_FOCUS_MAX_WIDTH = 74;
const MAP_FOCUS_MIN_HEIGHT = 26;
const MAP_FOCUS_MAX_HEIGHT = 64;

function pxToPercentX(px: number) {
  return (px / MAP_FOCUS_REFERENCE_WIDTH) * 100;
}

function pxToPercentY(px: number) {
  return (px / MAP_FOCUS_REFERENCE_HEIGHT) * 100;
}

function estimateLabelHalfWidth(label: string) {
  return clamp(20 + label.length * 4.2, 34, 84);
}

function getRegionMarkerBounds(regionId: RegionId) {
  const blueprint = BOARD_REGION_BLUEPRINT[regionId];
  const anchorX = parsePercent(blueprint.mapPoint.x);
  const anchorY = parsePercent(blueprint.mapPoint.y);
  const labelHalfWidth = estimateLabelHalfWidth(blueprint.shortLabel);
  const labelHalfHeight = 12;
  const anchorRadius = 8;
  const clusterHalfWidth = 28;
  const clusterBottom = 28;

  let minX = anchorX - pxToPercentX(anchorRadius);
  let maxX = anchorX + pxToPercentX(anchorRadius);
  let minY = anchorY - pxToPercentY(anchorRadius);
  let maxY = anchorY + pxToPercentY(clusterBottom);

  for (const callout of [blueprint.desktopCallout, blueprint.compactCallout]) {
    const labelCenterX = anchorX + pxToPercentX(parsePixelOffset(callout.labelX));
    const labelCenterY = anchorY + pxToPercentY(parsePixelOffset(callout.labelY));

    minX = Math.min(minX, labelCenterX - pxToPercentX(labelHalfWidth), anchorX - pxToPercentX(clusterHalfWidth));
    maxX = Math.max(maxX, labelCenterX + pxToPercentX(labelHalfWidth), anchorX + pxToPercentX(clusterHalfWidth));
    minY = Math.min(minY, labelCenterY - pxToPercentY(labelHalfHeight));
    maxY = Math.max(maxY, labelCenterY + pxToPercentY(labelHalfHeight), anchorY + pxToPercentY(clusterBottom));
  }

  return { minX, maxX, minY, maxY };
}

function getScenarioMapFocus(regionIds: RegionId[]) {
  const focusRegions = regionIds.length > 0 ? regionIds : (Object.keys(BOARD_REGION_BLUEPRINT) as RegionId[]);
  const bounds = focusRegions.map(getRegionMarkerBounds);
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));

  const visibleWidth = clamp(maxX - minX + MAP_FOCUS_MARGIN_X * 2, MAP_FOCUS_MIN_WIDTH, MAP_FOCUS_MAX_WIDTH);
  const visibleHeight = clamp(maxY - minY + MAP_FOCUS_MARGIN_Y * 2, MAP_FOCUS_MIN_HEIGHT, MAP_FOCUS_MAX_HEIGHT);
  const centerX = clamp((minX + maxX) / 2, visibleWidth / 2, 100 - visibleWidth / 2);
  const centerY = clamp((minY + maxY) / 2, visibleHeight / 2, 100 - visibleHeight / 2);
  const left = centerX - visibleWidth / 2;
  const top = centerY - visibleHeight / 2;
  const widthScale = 100 / visibleWidth;
  const heightScale = 100 / visibleHeight;

  return {
    width: `${widthScale * 100}%`,
    height: `${heightScale * 100}%`,
    left: `${left * -widthScale}%`,
    top: `${top * -heightScale}%`,
  };
}

function getBoardActionLabel(state: EngineState) {
  if (state.phase === 'WORLD') {
    return state.stagedWorldPhase.status === 'drawn'
      ? t('ui.game.adoptResolution', 'Adopt Resolution')
      : t('ui.game.drawWorldCards', 'Draw World Cards');
  }

  if (state.phase === 'COALITION') {
    return t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent');
  }

  if (state.phase === 'END') {
    return t('ui.game.closeRound', 'Close Round');
  }

  return t('ui.game.civicTheatre', 'Civic Theatre');
}

function getBoardActionDisabled(state: EngineState) {
  if (state.phase === 'WORLD') {
    return false;
  }

  if (state.phase === 'COALITION') {
    return !state.players.every((player) => player.ready);
  }

  if (state.phase === 'END') {
    return false;
  }

  return true;
}

function runBoardAction(state: EngineState, onCommand: (command: EngineCommand) => void) {
  if (state.phase === 'WORLD') {
    if (state.stagedWorldPhase.status === 'drawn') {
      onCommand({ type: 'AdoptResolution' });
      return;
    }

    onCommand({ type: 'DrawWorldCards' });
    return;
  }

  if (state.phase === 'COALITION') {
    onCommand({ type: 'CommitCoalitionIntent' });
    return;
  }

  if (state.phase === 'END') {
    onCommand({ type: 'ResolveEndPhase' });
  }
}

function getOpenTrayTitle(viewState: GameViewState) {
  switch (viewState.openTray) {
    case 'scenario':
      return t('ui.game.scenarioDeskSections', 'Scenario desk sections');
    case 'actions':
      return t('ui.game.plannedMoves', 'Planned Moves');
    case 'player':
      return t('ui.game.playerMat', 'Player Mat');
    case 'notes':
      return t('ui.game.meetingNotes', 'Meeting Notes');
    case 'deck':
      return t('ui.game.crisisDeck', 'Crisis Deck');
    default:
      return t('ui.game.civicTheatre', 'Civic Theatre');
  }
}

function buildAutoPlayTargets(targetKind: 'NONE' | 'REGION' | 'FRONT'): ActionTarget[] {
  if (targetKind === 'REGION') {
    return getAvailableRegions().map((regionId) => ({ kind: 'REGION', regionId }));
  }

  if (targetKind === 'FRONT') {
    return getAvailableFronts().map((frontId) => ({ kind: 'FRONT', frontId }));
  }

  return [{ kind: 'NONE' }];
}

function findAutoPlayQueueCommand(
  state: EngineState,
  content: CompiledContent,
  player: PlayerState,
): EngineCommand | null {
  const actions = getSeatActions(state, content, player.seat);

  for (const action of [...actions.standard, ...actions.breakthroughs]) {
    for (const target of buildAutoPlayTargets(action.targetKind)) {
      const disabled = getSeatDisabledReason(state, content, player.seat, action.id, target);
      if (!disabled.disabled) {
        return { type: 'QueueIntent', seat: player.seat, actionId: action.id, target };
      }
    }
  }

  return null;
}

function getNextAutoPlayCommand(state: EngineState, content: CompiledContent): EngineCommand | null {
  if (state.phase === 'WORLD') {
    return state.stagedWorldPhase.status === 'drawn'
      ? { type: 'AdoptResolution' }
      : { type: 'DrawWorldCards' };
  }

  if (state.phase === 'COALITION') {
    for (const player of state.players) {
      if (player.actionsRemaining > 0) {
        return findAutoPlayQueueCommand(state, content, player);
      }

      if (!player.ready) {
        return { type: 'SetReady', seat: player.seat, ready: true };
      }
    }

    return state.players.every((player) => player.ready) ? { type: 'CommitCoalitionIntent' } : null;
  }

  if (state.phase === 'COMPROMISE' && state.activeCompromise) {
    const undecidedSeat = state.players.find((player) => state.activeCompromise?.votes[player.seat] === undefined)?.seat;
    return undecidedSeat === undefined ? null : { type: 'VoteCompromise', seat: undecidedSeat, accept: true };
  }

  if (state.phase === 'END') {
    return { type: 'ResolveEndPhase' };
  }

  return null;
}

export function GameScreen({
  locale,
  onLocaleChange,
  devMode,
  surface,
  state,
  content,
  viewState,
  onViewStateChange,
  onCommand,
  onToast,
  onBack,
  onExportSave,
  roomId,
}: GameScreenProps) {
  const band = getTemperatureBand(state.temperature);
  const ending = getEndingTierSummary(state);
  const useOfflineSeatOrder = surface === 'local' && state.phase === 'COALITION';
  const activeCoalitionSeat = getActiveCoalitionSeat(state.players);
  const effectiveFocusedSeat = useOfflineSeatOrder ? activeCoalitionSeat : viewState.focusedSeat;
  const focusedPlayer = state.players[effectiveFocusedSeat] ?? state.players[0];
  const selectedEvent = state.eventLog.find((event) => event.seq === viewState.eventSeq) ?? null;
  const visibleEvents = state.eventLog.slice().reverse().slice(0, 6);
  const archivedEventCount = Math.max(0, state.eventLog.length - visibleEvents.length);
  const previousStateRef = useRef<EngineState | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const [pulsedResources, setPulsedResources] = useState<ResourceType[]>([]);
  const [showDebugSnapshot, setShowDebugSnapshot] = useState(false);
  const [autoPlayRounds, setAutoPlayRounds] = useState('1');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<AutoPlaySpeedLevel>(3);
  const [autoPlayTargetRound, setAutoPlayTargetRound] = useState<number | null>(null);
  const [autoPlayRunning, setAutoPlayRunning] = useState(false);
  const [autoPlayStatus, setAutoPlayStatus] = useState<string | null>(null);
  const [inspectedRegionId, setInspectedRegionId] = useState<RegionId | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const activeSeatTone = seatTone(focusedPlayer.seat);
  const activeCrisis = state.stagedWorldPhase.activeCrisisId ? content.cards[state.stagedWorldPhase.activeCrisisId] : null;
  const stagedCaptureCard = state.stagedWorldPhase.captureCardId ? content.cards[state.stagedWorldPhase.captureCardId] : null;
  const frontEntries = BOARD_FRONT_RAIL.map(({ id, shortLabel }) => ({
    id,
    shortLabel,
    front: state.fronts[id],
    name: content.fronts[id].name,
  }));

  const pulseResources = (resources: ResourceType[]) => {
    const uniqueResources = Array.from(new Set(resources));
    if (uniqueResources.length === 0) {
      return;
    }

    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }

    setPulsedResources([]);
    window.setTimeout(() => setPulsedResources(uniqueResources), 0);
    pulseTimerRef.current = window.setTimeout(() => {
      setPulsedResources([]);
      pulseTimerRef.current = null;
    }, 260);
  };

  useEffect(() => {
    const previousState = previousStateRef.current;

    if (previousState) {
      const changedResources = RESOURCE_KEYS.filter(
        (resource) => previousState.resources[resource] !== state.resources[resource],
      );

      if (changedResources.length > 0) {
        pulseResources(changedResources);
      }

      if (previousState.phase !== state.phase || previousState.round !== state.round) {
        onToast({
          tone: state.phase === 'LOSS' ? 'error' : 'success',
          title:
            state.phase === 'LOSS'
              ? t('ui.toast.roundCollapsedTitle', 'Round collapsed')
              : t('ui.toast.phaseAdvancedTitle', 'Phase advanced'),
          message: `Round ${state.round} is now in ${t(`ui.phases.${state.phase}`, state.phase)}.`,
          dismissAfterMs: 2600,
        });
      }
    }

    previousStateRef.current = state;
  }, [onToast, state]);

  useEffect(() => () => {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (autoPlayTimerRef.current !== null) {
      window.clearTimeout(autoPlayTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!autoPlayRunning) {
      if (autoPlayTimerRef.current !== null) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    const queueAutoPlayStop = (message: string) => {
      autoPlayTimerRef.current = window.setTimeout(() => {
        setAutoPlayRunning(false);
        setAutoPlayTargetRound(null);
        setAutoPlayStatus(message);
      }, 0);
    };

    if (TERMINAL_PHASES.includes(state.phase)) {
      queueAutoPlayStop(
        state.phase === 'WIN'
          ? t('ui.debug.autoplayWon', 'Autoplay stopped because the coalition reached a win state.')
          : t('ui.debug.autoplayLost', 'Autoplay stopped because the coalition collapsed.'),
      );
      return;
    }

    if (autoPlayTargetRound !== null && state.round >= autoPlayTargetRound && state.phase === 'WORLD') {
      queueAutoPlayStop(t('ui.debug.autoplayComplete', 'Finished the requested rounds.'));
      return;
    }

    const command = getNextAutoPlayCommand(state, content);
    if (!command) {
      queueAutoPlayStop(t('ui.debug.autoplayStalled', 'Autoplay stopped because no legal next command was available.'));
      return;
    }

    autoPlayTimerRef.current = window.setTimeout(() => {
      void Promise.resolve(onCommand(command)).catch((error) => {
        console.error(error);
        setAutoPlayRunning(false);
        setAutoPlayTargetRound(null);
        setAutoPlayStatus(t('ui.debug.autoplayFailed', 'Autoplay stopped because the next command failed.'));
      });
    }, AUTOPLAY_SPEED_DELAYS[autoPlaySpeed]);

    return () => {
      if (autoPlayTimerRef.current !== null) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayRunning, autoPlaySpeed, autoPlayTargetRound, content, onCommand, state]);

  const queueAction = (command: EngineCommand, resources: ResourceType[], toast: Omit<ToastMessage, 'id'>) => {
    pulseResources(resources);
    onToast(toast);
    onCommand(command);
  };

  const startAutoPlay = () => {
    const parsedRounds = Number.parseInt(autoPlayRounds, 10);
    const roundsToPlay = Number.isFinite(parsedRounds) && parsedRounds > 0 ? parsedRounds : 1;
    setAutoPlayRounds(String(roundsToPlay));
    setAutoPlayTargetRound(state.round + roundsToPlay);
    setAutoPlayRunning(true);
    setAutoPlayStatus(
      t('ui.debug.autoplayQueued', 'Queued {{count}} round{{plural}} at speed {{speed}}.', {
        count: roundsToPlay,
        plural: roundsToPlay === 1 ? '' : 's',
        speed: autoPlaySpeed,
      }),
    );
  };

  const stopAutoPlay = () => {
    setAutoPlayRunning(false);
    setAutoPlayTargetRound(null);
    setAutoPlayStatus(t('ui.debug.autoplayStopped', 'Autoplay stopped.'));
  };

  const boardActionDisabled = getBoardActionDisabled(state);
  const autoPlayStatusText = autoPlayRunning
    ? t('ui.debug.autoplayProgress', 'Executing {{phase}}. {{count}} round{{plural}} left in the queue.', {
      phase: t(`ui.phases.${state.phase}`, state.phase),
      count: autoPlayTargetRound === null ? 0 : Math.max(autoPlayTargetRound - state.round, 0),
      plural: autoPlayTargetRound !== null && Math.max(autoPlayTargetRound - state.round, 0) === 1 ? '' : 's',
    })
    : autoPlayStatus;
  const inspectedRegion = inspectedRegionId ? state.regions[inspectedRegionId] : null;
  const inspectedRegionDefinition = inspectedRegionId ? content.regions[inspectedRegionId] : null;
  const inspectedRegionBlueprint = inspectedRegionId ? BOARD_REGION_BLUEPRINT[inspectedRegionId] : null;
  const inspectedVulnerabilities = inspectedRegion
    ? Object.entries(inspectedRegion.vulnerability)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 3)
    : [];
  const scenarioRegionIds = Object.keys(content.scenario.setup.regionOverrides) as RegionId[];
  const mapFocus = getScenarioMapFocus(scenarioRegionIds);

  return (
    <TableSurface className="tabletop-game board-first-table" data-seat={activeSeatTone} data-open-tray={viewState.openTray}>
      <header className="tabletop-game-header board-top-strip">
        <EngravedHeader
          eyebrow={surface === 'local' ? t('ui.game.localSurface', 'Local Table') : t('ui.game.roomSurface', 'Room {{roomId}}', { roomId: roomId ?? '—' })}
          title={content.scenario.name}
          detail={content.scenario.moralCenter}
          actions={
            <div className="header-control-stack board-strip-actions">
              <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
              <TabletopControls />
              <div className="header-action-plates">
                <ThemePlate label={t('ui.game.exportSave', 'Export Save')} onClick={() => onExportSave(serializeGame(state))} />
                <ThemePlate label={t('ui.game.back', 'Back')} onClick={onBack} />
              </div>
            </div>
          }
        />
      </header>

      <main className="board-first-stage">
        <CivicBoard className="civic-board-replica">
          <div className="board-identity-ribbon">
            <span>{t('ui.game.civicTheatre', 'Civic Theatre')}</span>
            <span>
              {t('ui.game.roundSummary', 'Round {{round}} of {{roundLimit}} | {{surface}} | {{description}}', {
                round: state.round,
                roundLimit: state.roundLimit,
                surface:
                  surface === 'local'
                    ? t('ui.game.localSurface', 'Local Table')
                    : t('ui.game.roomSurface', 'Room {{roomId}}', { roomId: roomId ?? '—' }),
                description: getBoardActionLabel(state),
              })}
            </span>
          </div>

          <div className="board-rail board-rail-phase" aria-label={t('ui.game.turnProgress', 'Turn progress')}>
            {BOARD_PHASE_RAIL.map((label, index) => {
              const activeLabel =
                state.phase === 'WORLD'
                  ? 'World'
                  : state.phase === 'COALITION'
                    ? 'Coalition'
                    : state.phase === 'COMPROMISE'
                      ? 'Compromise'
                      : 'Resolve';
              const activeIndex = BOARD_PHASE_RAIL.indexOf(activeLabel);
              return (
                <div
                  key={label}
                  className={`board-rail-step ${index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : ''}`}
                >
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          <div className="board-rail board-rail-fronts" aria-label={t('ui.game.fronts', 'Fronts')}>
            {frontEntries.map(({ id, front, name, shortLabel }) => (
              <button
                key={id}
                type="button"
                className={`front-rail-chip ${front.collapsed ? 'is-collapsed' : ''}`}
                onClick={() => onViewStateChange({ openTray: 'scenario', scenarioSection: 'fronts' })}
              >
                <span>{shortLabel}</span>
                <strong>{[front.pressure, front.protection, front.impact].map((value) => formatNumber(value)).join('/')}</strong>
                <small>{name}</small>
              </button>
            ))}
          </div>

          <div className="board-side-well board-side-well-left">
            <DeckStack
              label={t('ui.game.crisisDeck', 'Crisis Deck')}
              deckName={t('ui.game.crisisDeck', 'Crisis Deck')}
              drawCount={state.decks.crisis.drawPile.length}
              activeCount={state.stagedWorldPhase.crisisCardIds.length}
              locked={state.phase !== 'WORLD'}
              disabled={state.phase !== 'WORLD' || state.stagedWorldPhase.status === 'drawn'}
              onClick={() => runBoardAction(state, onCommand)}
            />
            <PaperSheet tone="docket" className="board-mini-docket">
              <span className="engraved-eyebrow">{t('ui.game.captureDocket', 'Capture Docket')}</span>
              <strong>{stagedCaptureCard?.name ?? t('ui.game.pendingDraw', 'Awaiting draw')}</strong>
              <p>{stagedCaptureCard?.text ?? t('ui.game.pendingDrawBody', 'Draw the world cards to place the current capture docket on the board.')}</p>
            </PaperSheet>
          </div>

          <section className="board-map-theatre" aria-label={t('ui.game.civicTheatre', 'Civic Theatre')}>
            <div className="board-metric-cluster">
              <article className="printed-meter">
                <span className="engraved-eyebrow">{t('ui.game.temperature', 'Temperature')}</span>
                <strong>{formatTemperature(state.temperature)}</strong>
                <small>
                  {t('ui.game.temperatureDetail', 'Band {{band}}. {{count}} crisis card{{plural}} on the next world resolution.', {
                    band: band.band,
                    count: band.crisisCount,
                    plural: band.crisisCount === 1 ? '' : 's',
                  })}
                </small>
              </article>
              <article className="printed-meter">
                <span className="engraved-eyebrow">{t('ui.game.civicSpace', 'Civic Space')}</span>
                <strong>{getCivicSpaceLabel(state.civicSpace)}</strong>
                <small>{t('ui.game.charter', 'Charter')}: {formatNumber(ending.ratifiedClauses)}</small>
              </article>
            </div>

            <div className="tabletop-map-grid board-replica-grid">
              <div className="board-map-viewport">
                <div
                  className="board-map-canvas"
                  style={
                    {
                      '--map-canvas-width': mapFocus.width,
                      '--map-canvas-height': mapFocus.height,
                      '--map-canvas-left': mapFocus.left,
                      '--map-canvas-top': mapFocus.top,
                    } as CSSProperties
                  }
                >
                  <img
                    src={WORLD_MAP_ASSET_URL}
                    alt={t('ui.game.worldMapBackground', 'Illustrated world map background')}
                    className="board-world-map"
                    aria-hidden="true"
                  />
                  {Object.values(state.regions).map((region) => {
                    const blueprint = BOARD_REGION_BLUEPRINT[region.id];
                    const totalPressure = region.tokens.displacement + region.tokens.disinfo + region.locks.length;
                    const severity = totalPressure <= 1 ? 'low' : totalPressure <= 3 ? 'medium' : totalPressure <= 5 ? 'high' : 'critical';
                    return (
                      <button
                        key={region.id}
                        type="button"
                        className={`tabletop-region-card region-map-marker ${viewState.regionId === region.id ? 'is-active' : ''} ${blueprint.themeClass}`}
                        style={
                          {
                            '--territory-accent': blueprint.accent,
                            '--territory-tilt': `${blueprint.tilt}deg`,
                            '--map-point-x': blueprint.mapPoint.x,
                            '--map-point-y': blueprint.mapPoint.y,
                            '--label-offset-x': blueprint.desktopCallout.labelX,
                            '--label-offset-y': blueprint.desktopCallout.labelY,
                            '--tooltip-offset-x': blueprint.desktopCallout.tooltipX,
                            '--tooltip-offset-y': blueprint.desktopCallout.tooltipY,
                            '--label-offset-x-compact': blueprint.compactCallout.labelX,
                            '--label-offset-y-compact': blueprint.compactCallout.labelY,
                            '--tooltip-offset-x-compact': blueprint.compactCallout.tooltipX,
                            '--tooltip-offset-y-compact': blueprint.compactCallout.tooltipY,
                          } as CSSProperties
                        }
                        data-pressure={severity}
                        onMouseEnter={() => setInspectedRegionId(region.id)}
                        onMouseLeave={() => setInspectedRegionId((current) => (current === region.id ? null : current))}
                        onFocus={() => setInspectedRegionId(region.id)}
                        onBlur={() => setInspectedRegionId((current) => (current === region.id ? null : current))}
                        onClick={() => onViewStateChange({ regionId: region.id })}
                        aria-label={t(
                          'ui.game.regionTokenLabel',
                          '{{region}}. {{displacement}} displacement, {{disinfo}} disinfo, {{locks}} locks, {{institutions}} institutions.',
                          {
                            region: content.regions[region.id].name,
                            displacement: region.tokens.displacement,
                            disinfo: region.tokens.disinfo,
                            locks: region.locks.length,
                            institutions: region.institutions.length,
                          },
                        )}
                      >
                        <span className="region-map-anchor" aria-hidden="true" />
                        <span className="region-map-label">{blueprint.shortLabel}</span>
                        <span className="region-map-piece-cluster" aria-hidden="true">
                          {renderRegionStack(region.tokens.displacement, 'region-state-stack region-state-stack-disc', `${region.id}-displacement`)}
                          {renderRegionStack(region.tokens.disinfo, 'region-state-stack region-state-stack-cube', `${region.id}-disinfo`)}
                          {renderRegionStack(region.locks.length, 'region-state-stack region-state-stack-lock', `${region.id}-locks`)}
                          {renderRegionStack(region.institutions.length, 'region-state-stack region-state-stack-mat', `${region.id}-institutions`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {inspectedRegion && inspectedRegionDefinition && inspectedRegionBlueprint ? (
                <article
                  className="printed-territory region-state-tooltip"
                  style={
                    {
                      '--territory-accent': inspectedRegionBlueprint.accent,
                      '--territory-tilt': `${inspectedRegionBlueprint.tilt}deg`,
                      '--map-point-x': inspectedRegionBlueprint.mapPoint.x,
                      '--map-point-y': inspectedRegionBlueprint.mapPoint.y,
                      '--tooltip-offset-x': inspectedRegionBlueprint.desktopCallout.tooltipX,
                      '--tooltip-offset-y': inspectedRegionBlueprint.desktopCallout.tooltipY,
                      '--tooltip-offset-x-compact': inspectedRegionBlueprint.compactCallout.tooltipX,
                      '--tooltip-offset-y-compact': inspectedRegionBlueprint.compactCallout.tooltipY,
                    } as CSSProperties
                  }
                >
                  <div className="printed-territory-button">
                    <span className="printed-territory-caption">{inspectedRegionBlueprint.shortLabel}</span>
                    <strong>{inspectedRegionDefinition.name}</strong>
                    <p>{inspectedRegionBlueprint.strapline}</p>
                    <div className="territory-token-cluster" aria-hidden="true">
                      <span className="token-glyph token-glyph-disc">{formatNumber(inspectedRegion.tokens.displacement)}</span>
                      <span className="token-glyph token-glyph-cube">{formatNumber(inspectedRegion.tokens.disinfo)}</span>
                      <span className="token-glyph token-glyph-bar">{formatNumber(inspectedRegion.locks.length)}</span>
                      <span className="token-glyph token-glyph-mat">{formatNumber(inspectedRegion.institutions.length)}</span>
                    </div>
                    <div className="region-tooltip-ledger">
                      <span>{t('ui.regionTooltip.locks', 'Locks')}: {inspectedRegion.locks.length === 0 ? t('ui.status.none', 'None') : inspectedRegion.locks.join(', ')}</span>
                      <span>
                        {t('ui.regionTooltip.vulnerability', 'Highest vulnerability')}: {inspectedVulnerabilities.length === 0
                          ? t('ui.status.none', 'None')
                          : inspectedVulnerabilities
                            .map(([front, value]) => `${content.fronts[front as keyof CompiledContent['fronts']].name} ${value}`)
                            .join(' • ')}
                      </span>
                      <span>{t('ui.regionTooltip.openDetails', 'Click to open full regional dossier.')}</span>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>

            <div className={`board-bottom-cards ${useOfflineSeatOrder ? 'is-offline-turn-order' : ''}`.trim()}>
              {(useOfflineSeatOrder ? [focusedPlayer] : state.players).map((player) => (
                <button
                  key={player.seat}
                  type="button"
                  className={`program-rail-card ${player.seat === focusedPlayer.seat ? 'is-active' : ''}`}
                  onClick={() => onViewStateChange({ openTray: 'player' })}
                >
                  <span className="engraved-eyebrow">
                    {useOfflineSeatOrder
                      ? t('ui.game.activeSeat', 'Active seat')
                      : t('ui.home.seatLabel', 'Seat {{seat}}', { seat: player.seat + 1 })}
                  </span>
                  <strong>{getRoleName(player.roleId)}</strong>
                  <small>{t('ui.actionBoard.queued', 'Planned {{count}}', { count: player.queuedIntents.length })}</small>
                </button>
              ))}
            </div>
          </section>

          <aside className="board-side-well board-side-well-right">
            {activeCrisis ? (
              <CrisisCard
                title={activeCrisis.name}
                body={activeCrisis.text}
                tag={t('ui.game.activeCrisis', 'Active Crisis')}
                emoji={activeCrisis.emoji}
                className="active-crisis-card"
              />
            ) : (
              <PaperSheet tone="docket" className="board-mini-docket">
                <span className="engraved-eyebrow">{t('ui.game.activeCrisis', 'Active Crisis')}</span>
                <strong>{t('ui.game.pendingDraw', 'Awaiting draw')}</strong>
                <p>{t('ui.game.drawResolutionLead', 'Open the crisis deck, reveal the current draw, and place the active card on the board.')}</p>
              </PaperSheet>
            )}

            <PaperSheet tone="docket" className="board-mini-docket">
              <span className="engraved-eyebrow">{t('ui.game.charter', 'Charter')}</span>
              <strong>{t('ui.game.ratifiedCount', '{{count}} ratified', { count: ending.ratifiedClauses })}</strong>
              <p>{t('ui.game.charterDetail', 'Outcome track: {{tier}}.', { tier: getEndingTierLabel(ending.tier) })}</p>
            </PaperSheet>

            <button
              type="button"
              className="board-resolve-well"
              disabled={boardActionDisabled}
              onClick={() => runBoardAction(state, onCommand)}
            >
              <span className="engraved-eyebrow">{t('ui.game.resolve', 'Resolve')}</span>
              <strong>{getBoardActionLabel(state)}</strong>
              {boardActionDisabled ? <WaxSealLock label={t('ui.game.sealed', 'Sealed')} /> : null}
            </button>
          </aside>
        </CivicBoard>

        <aside className="board-drawer-shell" aria-label={getOpenTrayTitle(viewState)}>
          <div className="board-drawer-tabs" role="tablist" aria-label={t('ui.game.coalitionDeskSections', 'Coalition desk sections')}>
            <button
              type="button"
              role="tab"
              aria-selected={viewState.openTray === 'scenario'}
              className={viewState.openTray === 'scenario' ? 'is-active' : ''}
              onClick={() => onViewStateChange({ openTray: viewState.openTray === 'scenario' ? 'none' : 'scenario' })}
            >
              {t('ui.game.brief', 'Brief')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewState.openTray === 'actions'}
              className={viewState.openTray === 'actions' ? 'is-active' : ''}
              onClick={() => onViewStateChange({ openTray: viewState.openTray === 'actions' ? 'none' : 'actions' })}
            >
              {t('ui.game.plannedMoves', 'Planned Moves')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewState.openTray === 'player'}
              className={viewState.openTray === 'player' ? 'is-active' : ''}
              onClick={() => onViewStateChange({ openTray: viewState.openTray === 'player' ? 'none' : 'player' })}
            >
              {t('ui.game.playerMat', 'Player Mat')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewState.openTray === 'notes'}
              className={viewState.openTray === 'notes' ? 'is-active' : ''}
              onClick={() => onViewStateChange({ openTray: viewState.openTray === 'notes' ? 'none' : 'notes' })}
            >
              {t('ui.game.meetingNotes', 'Meeting Notes')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewState.openTray === 'deck'}
              className={viewState.openTray === 'deck' ? 'is-active' : ''}
              onClick={() => onViewStateChange({ openTray: viewState.openTray === 'deck' ? 'none' : 'deck' })}
            >
              {t('ui.game.crisisDeck', 'Crisis Deck')}
            </button>
          </div>

          {viewState.openTray === 'scenario' ? (
            <DocumentFolio
              title={t('ui.game.scenarioDeskSections', 'Scenario desk sections')}
              activeId={viewState.scenarioSection}
              sections={[
                { id: 'brief', label: t('ui.game.brief', 'Brief') },
                { id: 'fronts', label: t('ui.game.fronts', 'Fronts') },
                { id: 'charter', label: t('ui.game.charterPanel', 'Charter') },
              ]}
              onSelect={(scenarioSection) => onViewStateChange({ scenarioSection, openTray: 'scenario' })}
            >
              {viewState.scenarioSection === 'brief' ? (
                <div className="folio-stack">
                  <PaperSheet tone="slip">
                    <span className="engraved-eyebrow">{t('ui.game.situation', 'Situation')}</span>
                    <h3>{content.scenario.name}</h3>
                    <p>{content.scenario.introduction}</p>
                  </PaperSheet>
                  <PaperSheet tone="slip">
                    <span className="engraved-eyebrow">{t('ui.game.specialRules', 'Special Rules')}</span>
                    <div className="rule-slip-list">
                      {content.scenario.specialRuleChips.map((chip) => {
                        const status = getScenarioRuleStatus(state, chip.id);
                        return (
                          <article key={chip.id} className={`rule-slip ${status.active ? 'is-active' : ''}`}>
                            <strong>{chip.label}</strong>
                            <p>{chip.description}</p>
                            <span>{status.value}</span>
                          </article>
                        );
                      })}
                    </div>
                  </PaperSheet>
                </div>
              ) : null}

              {viewState.scenarioSection === 'fronts' ? (
                <div className="folio-stack">
                  {frontEntries.map(({ id, front, name }) => (
                    <PaperSheet key={id} tone="slip" className="front-ledger">
                      <div className="front-ledger-header">
                        <div>
                          <span className="engraved-eyebrow">{name}</span>
                          <h3>{id}</h3>
                        </div>
                        <span>{front.collapsed ? t('ui.game.collapse', 'Collapse') : t('ui.game.coalitionHolds', 'Coalition Holds')}</span>
                      </div>
                      <div className="front-ledger-stats">
                        <div><span>{t('ui.game.pressure', 'Pressure')}</span><strong>{formatNumber(front.pressure)}</strong></div>
                        <div><span>{t('ui.game.protection', 'Protection')}</span><strong>{formatNumber(front.protection)}</strong></div>
                        <div><span>{t('ui.game.impact', 'Impact')}</span><strong>{formatNumber(front.impact)}</strong></div>
                      </div>
                    </PaperSheet>
                  ))}
                </div>
              ) : null}

              {viewState.scenarioSection === 'charter' ? (
                <div className="folio-stack">
                  {Object.values(state.charter).map((clause) => (
                    <PaperSheet key={clause.id} tone="slip" className={`charter-slip charter-${clause.status}`}>
                      <span className="engraved-eyebrow">{clause.status}</span>
                      <h3>{content.charter[clause.id].title}</h3>
                      <p>{content.charter[clause.id].description}</p>
                    </PaperSheet>
                  ))}
                </div>
              ) : null}
            </DocumentFolio>
          ) : null}

          {viewState.openTray === 'actions' ? (
            <ActionBoard
              seat={focusedPlayer.seat}
              state={state}
              content={content}
              player={focusedPlayer}
              onCommand={onCommand}
              onQueueAction={queueAction}
            />
          ) : null}

          {viewState.openTray === 'player' ? (
            <PaperSheet tone="mat" className="player-mat-sheet board-player-mat" aria-describedby="player-mat-passive">
              <div className="player-mat-header">
                <div>
                  <span className="engraved-eyebrow">
                    {useOfflineSeatOrder ? t('ui.game.activeSeat', 'Active seat') : t('ui.game.playerMat', 'Player Mat')}
                  </span>
                  <h3>{getRoleName(focusedPlayer.roleId)}</h3>
                </div>
                {useOfflineSeatOrder ? (
                  <div className="seat-selector-row" aria-label={t('ui.game.activeSeat', 'Active seat')}>
                    <span className={`seat-selector is-active ${focusedPlayer.ready ? 'is-ready' : ''}`.trim()}>
                      {formatNumber(focusedPlayer.seat + 1)}
                    </span>
                  </div>
                ) : (
                  <div className="seat-selector-row" aria-label={t('ui.game.activeSeat', 'Active seat')}>
                    {state.players.map((player) => (
                      <button
                        key={player.seat}
                        type="button"
                        className={`seat-selector ${player.seat === focusedPlayer.seat ? 'is-active' : ''} ${player.ready ? 'is-ready' : ''}`}
                        onClick={() => onViewStateChange({ focusedSeat: player.seat, openTray: 'player' })}
                      >
                        {formatNumber(player.seat + 1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p id="player-mat-passive" className="player-mat-passive">{content.roles[focusedPlayer.roleId].passive}</p>

              <div className="player-mat-resources" aria-label={t('ui.game.sharedResources', 'Shared resources')}>
                {RESOURCE_KEYS.map((resource) => (
                  <div key={resource} className={pulsedResources.includes(resource) ? 'is-pulsed' : ''}>
                    <TokenStack
                      label={t(`ui.game.${resource}`, resource)}
                      count={state.resources[resource]}
                      shape={RESOURCE_META[resource].shape}
                      icon={RESOURCE_META[resource].icon}
                    />
                  </div>
                ))}
                <TokenStack
                  label={t('ui.game.compromiseDebt', 'Compromise Debt')}
                  count={state.globalTokens.compromise_debt ?? 0}
                  shape="disc"
                  icon="◉"
                />
              </div>

              <div className="player-mat-wells">
                <PaperSheet tone="slip" className="player-mat-well">
                  <span className="engraved-eyebrow">{t('ui.actionBoard.burnout', 'Burnout {{current}}/{{max}}', { current: focusedPlayer.burnout, max: focusedPlayer.maxBurnout })}</span>
                  <strong>{focusedPlayer.burnoutState}</strong>
                </PaperSheet>
                <PaperSheet tone="slip" className="player-mat-well">
                  <span className="engraved-eyebrow">{t('ui.actionBoard.slotsLeft', 'Slots left {{count}}', { count: focusedPlayer.actionsRemaining })}</span>
                  <strong>{t('ui.game.plannedMoves', 'Planned Moves')}</strong>
                </PaperSheet>
              </div>

              <CommitMarker
                label={focusedPlayer.ready ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning')}
                active={focusedPlayer.ready}
                disabled={state.phase !== 'COALITION' || focusedPlayer.actionsRemaining !== 0}
                onClick={() => onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready: !focusedPlayer.ready })}
              />
            </PaperSheet>
          ) : null}

          {viewState.openTray === 'notes' ? (
            <NotesPad title={t('ui.game.meetingNotes', 'Meeting Notes')} overflowCount={archivedEventCount}>
              {visibleEvents.map((event) => (
                <button
                  key={event.seq}
                  type="button"
                  className={`meeting-note-slip ${viewState.eventSeq === event.seq ? 'is-active' : ''}`}
                  onClick={() => onViewStateChange({ eventSeq: event.seq, openTray: 'notes' })}
                >
                  <span className="engraved-eyebrow">
                    {t('ui.game.phaseLabel', '{{phase}} phase', { phase: t(`ui.phases.${event.phase}`, event.phase) })}
                  </span>
                  <strong>{event.emoji} {event.message}</strong>
                  <span>{event.causedBy.slice(-1)[0]}</span>
                </button>
              ))}
            </NotesPad>
          ) : null}

          {viewState.openTray === 'deck' ? (
            <div className="board-deck-drawer">
              <PaperSheet tone="docket" className="board-mini-docket">
                <span className="engraved-eyebrow">{t('ui.game.crisisDeck', 'Crisis Deck')}</span>
                <strong>{formatNumber(state.decks.crisis.drawPile.length)}</strong>
                <p>{t('ui.game.turnProgress', 'Turn progress')}</p>
              </PaperSheet>
              <PaperSheet tone="docket" className="board-mini-docket">
                <span className="engraved-eyebrow">{t('ui.game.activeCrisis', 'Active Crisis')}</span>
                <strong>{activeCrisis?.name ?? t('ui.game.pendingDraw', 'Awaiting draw')}</strong>
                <p>{activeCrisis?.text ?? t('ui.game.pendingDrawBody', 'Draw the world cards to place the current capture docket on the board.')}</p>
              </PaperSheet>
            </div>
          ) : null}
        </aside>
      </main>

      <div className="mobile-tray-dock board-mobile-dock">
        <button type="button" onClick={() => onViewStateChange({ openTray: viewState.openTray === 'scenario' ? 'none' : 'scenario' })}>
          {t('ui.game.brief', 'Brief')}
        </button>
        <button type="button" onClick={() => onViewStateChange({ openTray: viewState.openTray === 'deck' ? 'none' : 'deck' })}>
          {t('ui.game.crisisDeck', 'Crisis Deck')}
        </button>
        <button type="button" onClick={() => onViewStateChange({ openTray: viewState.openTray === 'actions' ? 'none' : 'actions' })}>
          {t('ui.game.plannedMoves', 'Planned Moves')}
        </button>
        <button type="button" onClick={() => onViewStateChange({ openTray: viewState.openTray === 'player' ? 'none' : 'player' })}>
          {t('ui.game.playerMat', 'Player Mat')}
        </button>
      </div>

      <RotateHint />

      <RegionDrawer
        regionId={viewState.regionId}
        focusedSeat={effectiveFocusedSeat}
        state={state}
        content={content}
        onClose={() => onViewStateChange({ regionId: null })}
        onQueueAction={queueAction}
      />

      <TraceDrawer event={selectedEvent} onClose={() => onViewStateChange({ eventSeq: null })} />
      <DealModal state={state} content={content} onCommand={onCommand} />
      {devMode ? (
        <button
          type="button"
          className={`dev-panel-toggle ${viewState.showDebug ? 'is-active' : ''}`}
          onClick={() => onViewStateChange({ showDebug: !viewState.showDebug })}
          aria-expanded={viewState.showDebug}
          aria-controls="debug-panel-title"
        >
          {viewState.showDebug ? t('ui.debug.hidePanel', 'Hide Dev Panel') : t('ui.debug.showPanel', 'Dev Panel')}
        </button>
      ) : null}
      {devMode && viewState.showDebug ? (
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
          onAutoPlayStart={startAutoPlay}
          onAutoPlayStop={stopAutoPlay}
          onClose={() => onViewStateChange({ showDebug: false })}
        />
      ) : null}
    </TableSurface>
  );
}
