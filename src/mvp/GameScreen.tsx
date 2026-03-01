import { useEffect, useEffectEvent, useMemo, useState } from 'react';
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
import { GAME_A11Y_LABELS, getActiveCoalitionSeat, getPhaseProgressSteps } from './gameUiHelpers.ts';
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

  return (
    <TableSurface className="game-table">
      <header className="game-header">
        <PaperSheet tone="board">
          <div className="minutes-header">
            <div>
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
        </PaperSheet>
      </header>

      <main className="game-main-grid">
        <section className="game-board-column">
          <PaperSheet tone="board">
            <div className="phase-progress" aria-label={GAME_A11Y_LABELS.phaseProgress}>
              {getPhaseProgressSteps(state.phase).map((step) => (
                <div key={step.step} className={`phase-chip ${step.state}`} aria-current={step.current}>
                  <span>{step.number}</span>
                  <strong>{t(`ui.phases.${step.step}`, step.step)}</strong>
                </div>
              ))}
            </div>
            <p>{t(`ui.phaseSummary.${state.phase}`, getPhaseSummary(state.phase))}</p>
            <div className="header-action-plates">
              <ThemePlate label={getActionButtonLabel(state.phase)} disabled={phaseActionDisabled} onClick={runPhaseAction} />
            </div>
          </PaperSheet>

          <PaperSheet tone="board">
            <div className="setup-stat-ribbon" aria-label={GAME_A11Y_LABELS.sharedResources}>
              <div><span>{t('ui.game.round', 'Round')}</span><strong>{formatNumber(state.round)}</strong></div>
              <div><span>{t('ui.game.extractionPool', 'Extraction Pool')}</span><strong>{formatNumber(state.extractionPool)}</strong></div>
              <div><span>{t('ui.game.globalGaze', 'Global Gaze')}</span><strong>{formatNumber(state.globalGaze)} / 20</strong></div>
              <div><span>{t('ui.game.northernWarMachine', 'Northern War Machine')}</span><strong>{formatNumber(state.northernWarMachine)} / 12</strong></div>
            </div>
          </PaperSheet>

          <PaperSheet tone="board" className="game-map-panel">
            <WorldMapBoard
              state={state}
              content={content}
              selectedRegionId={selectedRegionId}
              onSelectRegion={(regionId) => onViewStateChange({ regionId })}
            />
          </PaperSheet>

          <PaperSheet tone="board">
            <span className="engraved-eyebrow">{t('ui.game.domains', 'Domains')}</span>
            <div className="scenario-card-grid">
              {DOMAIN_IDS.map((domainId) => (
                <div key={domainId} className="scenario-dossier-card is-active">
                  <strong>{localizeDomainField(domainId, 'name', content.domains[domainId].name)}</strong>
                  <p>{localizeDomainField(domainId, 'description', content.domains[domainId].description)}</p>
                  <p><strong>{t('ui.game.progress', 'Progress')}:</strong> {formatNumber(state.domains[domainId].progress)} / 12</p>
                </div>
              ))}
            </div>
          </PaperSheet>

          {state.mode === 'SYMBOLIC' ? (
            <PaperSheet tone="board">
              <span className="engraved-eyebrow">{t('ui.game.liveBeaconStatus', 'Beacon / threshold status')}</span>
              <div className="scenario-card-grid">
                {activeBeacons.map((beacon) => (
                  <div key={beacon.id} className={`scenario-dossier-card ${beacon.complete ? 'is-active' : ''}`}>
                    <strong>{beacon.title}</strong>
                    <p>{beacon.description}</p>
                    <p><strong>{beacon.complete ? '✓' : '•'}</strong> {beacon.complete ? t('ui.game.beaconComplete', 'Complete') : t('ui.game.beaconOpen', 'Open')}</p>
                  </div>
                ))}
              </div>
            </PaperSheet>
          ) : null}
        </section>

        <aside className="game-side-column" aria-label={GAME_A11Y_LABELS.coalitionDesk}>
          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.game.focusedSeat', 'Focused Seat')}</span>
            {surface === 'local' ? (
              <div className="plate-toggle-row">
                {state.players.map((player) => (
                  <ThemePlate
                    key={player.seat}
                    label={t('ui.game.focusSeat', 'Seat {{seat}}', { seat: player.seat + 1 })}
                    active={focusedSeat === player.seat}
                    onClick={() => onViewStateChange({ focusedSeat: player.seat })}
                  />
                ))}
              </div>
            ) : null}
            <h2>{localizeFactionField(faction.id, 'name', faction.name)}</h2>
            <p>{localizeFactionField(faction.id, 'passive', faction.passive)}</p>
            <p><strong>{t('ui.game.weakness', 'Weakness')}:</strong> {localizeFactionField(faction.id, 'weakness', faction.weakness)}</p>
            <div className="setup-stat-ribbon">
              <div><span>{t('ui.game.bodies', 'Bodies')}</span><strong>{formatNumber(getPlayerBodyTotal(state, focusedPlayer.seat))}</strong></div>
              <div><span>{t('ui.game.evidence', 'Evidence')}</span><strong>{formatNumber(focusedPlayer.evidence)}</strong></div>
              <div><span>{t('ui.game.actions', 'Actions')}</span><strong>{formatNumber(focusedPlayer.actionsRemaining)}</strong></div>
            </div>
            <div className="paper-form-grid">
              <div>
                <span>{t('ui.game.secretMandate', 'Secret Mandate')}</span>
                <strong>{localizeFactionField(faction.id, 'mandateTitle', mandate.title)}</strong>
                <p>{localizeFactionField(faction.id, 'mandateDescription', mandate.description)}</p>
              </div>
            </div>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.game.queuedMoves', 'Queued Moves')}</span>
            {focusedPlayer.queuedIntents.length === 0 ? <p>{t('ui.game.noQueuedMoves', 'No queued moves.')}</p> : null}
            {focusedPlayer.queuedIntents.map((intent) => (
              <article key={`${intent.actionId}-${intent.slot}`} className="seat-placard">
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

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.game.actionTray', 'Action Tray')}</span>
            <label>
              <span>{t('ui.game.action', 'Action')}</span>
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
                <span>{t('ui.game.bodiesCommitted', 'Bodies Committed')}</span>
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
            <p>{localizeActionField(draftAction.id, 'description', draftAction.description)}</p>
            <ThemePlate
              label={getLocalizedDisabledReason(disabledReason.reason) ?? t('ui.game.queueMove', 'Queue Move')}
              disabled={disabledReason.disabled}
              onClick={queueIntent}
            />
          </PaperSheet>

          <PaperSheet tone="tray" aria-label={GAME_A11Y_LABELS.liveUpdates}>
            <span className="engraved-eyebrow">{t('ui.game.latestLedger', 'Latest Ledger')}</span>
            {visibleEvents.map((event) => (
              <article key={event.seq} className="seat-placard">
                <span>{event.emoji} {event.message}</span>
                <strong>{t('ui.game.round', 'Round')} {formatNumber(event.round)} • {t(`ui.phases.${event.phase}`, event.phase)}</strong>
              </article>
            ))}
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
