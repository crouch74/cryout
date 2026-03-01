import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  getEndingTierSummary,
  getScenarioRuleStatus,
  getTemperatureBand,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type ResourceType,
} from '../../engine/index.ts';
import { ActionBoard } from './ActionBoard.tsx';
import { DebugOverlay } from './DebugOverlay.tsx';
import { DealModal } from './DealModal.tsx';
import { KpiChips } from './KpiChips.tsx';
import { LegendKey } from './LegendKey.tsx';
import { PhaseProgress } from './PhaseProgress.tsx';
import { RegionDrawer } from './RegionDrawer.tsx';
import { TraceDrawer } from './TraceDrawer.tsx';
import type { ToastMessage } from './ToastStack.tsx';
import { getCivicSpaceLabel, getEndingTierLabel, getRegionStrapline, getRoleName, t, type Locale } from '../i18n/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { FRONT_THEMES, REGION_THEMES } from './worldMap.ts';
import type { GameViewState } from './urlState.ts';

interface GameScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  surface: 'local' | 'room';
  roomId?: string | null;
  state: EngineState;
  content: CompiledContent;
  viewState: GameViewState;
  onViewStateChange: (patch: Partial<GameViewState>) => void;
  onCommand: (command: EngineCommand) => void;
  onToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onBack: () => void;
  onExportSave: (serialized: string) => void;
}

const RESOURCE_KEYS: ResourceType[] = ['solidarity', 'evidence', 'capacity', 'relief'];

function seatTone(seat: number) {
  return `seat-${seat + 1}`;
}

function getCoalitionHelper(state: EngineState) {
  const readySeats = state.players.filter((player) => player.ready).length;
  const remaining = state.players.length - readySeats;

  if (remaining === 0) {
    return t('ui.game.everySeatReady', 'Every seat is ready. Commit the coalition queue to resolve action effects.');
  }

  return t(
    'ui.game.seatsStillPlanning',
    '{{count}} seat{{plural}} still planning. Set every seat ready to unlock coalition commitment.',
    {
      count: remaining,
      plural: remaining === 1 ? '' : 's',
    },
  );
}

function getPhaseOutlook(state: EngineState) {
  if (state.phase === 'WORLD') {
    const band = getTemperatureBand(state.temperature);
    return t(
      'ui.game.worldPhaseOutlook',
      'World resolution will draw {{count}} crisis card{{plural}} at band {{band}}.',
      {
        count: band.crisisCount,
        plural: band.crisisCount === 1 ? '' : 's',
        band: band.band,
      },
    );
  }

  if (state.phase === 'COALITION') {
    const queued = state.players.reduce((total, player) => total + player.queuedIntents.length, 0);
    return t(
      'ui.game.coalitionPhaseOutlook',
      '{{count}} queued action{{plural}} will resolve once every seat is ready.',
      {
        count: queued,
        plural: queued === 1 ? '' : 's',
      },
    );
  }

  if (state.phase === 'COMPROMISE') {
    return t('ui.game.compromisePhaseOutlook', 'A compromise vote is live. Resolve the offer to continue the round.');
  }

  if (state.phase === 'END') {
    return t(
      'ui.game.endPhaseOutlook',
      'End phase resolution advances delayed effects, checks outcomes, and starts the next round.',
    );
  }

  return state.phase === 'WIN'
    ? t('ui.game.winOutlook', 'The coalition held. Review the charter outcome and export a shareable state.')
    : state.lossReason ?? t('ui.game.lossOutlook', 'The coalition collapsed before the charter could hold.');
}

export function GameScreen({
  locale,
  onLocaleChange,
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
}: GameScreenProps) {
  const isDev = Boolean(import.meta.env?.DEV);
  const band = getTemperatureBand(state.temperature);
  const everyoneReady = state.players.every((player) => player.ready);
  const ending = getEndingTierSummary(state);
  const focusedPlayer = state.players[viewState.focusedSeat] ?? state.players[0];
  const selectedEvent = state.eventLog.find((event) => event.seq === viewState.eventSeq) ?? null;
  const previousStateRef = useRef<EngineState | null>(null);
  const [pulsedResources, setPulsedResources] = useState<ResourceType[]>([]);
  const pulseTimerRef = useRef<number | null>(null);
  const activeSeatTone = seatTone(focusedPlayer.seat);

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

  const queueAction = (command: EngineCommand, resources: ResourceType[], toast: Omit<ToastMessage, 'id'>) => {
    pulseResources(resources);
    onToast(toast);
    onCommand(command);
  };

  const kpiItems = [
    {
      id: 'temperature',
      label: t('ui.game.temperature', 'Temperature'),
      value: `+${state.temperature}°C`,
      detail: t(
        'ui.game.temperatureDetail',
        'Band {{band}}. {{count}} crisis card{{plural}} on the next world resolution.',
        {
          band: band.band,
          count: band.crisisCount,
          plural: band.crisisCount === 1 ? '' : 's',
        },
      ),
    },
    {
      id: 'civic-space',
      label: t('ui.game.civicSpace', 'Civic Space'),
      value: getCivicSpaceLabel(state.civicSpace),
      detail: t('ui.game.civicSpaceDetail', 'Tracks how much organizing room remains for the coalition.'),
    },
    {
      id: 'charter',
      label: t('ui.game.charter', 'Charter'),
      value: `${ending.ratifiedClauses} ratified`,
      detail: t('ui.game.charterDetail', 'Outcome track: {{tier}}.', { tier: getEndingTierLabel(ending.tier) }),
    },
  ];

  return (
    <div className="game-screen">
      <header className="game-header-shell shell-panel shell-panel-glass" aria-labelledby="game-title">
        <div className="game-header-copy">
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
          <span className="eyebrow">{t('ui.game.commandTable', 'Global Command Table')}</span>
          <h1 id="game-title">{content.scenario.name}</h1>
          <p>
            {t('ui.game.roundSummary', 'Round {{round}} of {{roundLimit}} | {{surface}} | {{description}}', {
              round: state.round,
              roundLimit: state.roundLimit,
              surface:
                surface === 'local'
                  ? t('ui.game.localSurface', 'Local Table')
                  : t('ui.game.roomSurface', 'Room {{roomId}}', { roomId: roomId ?? '' }),
              description: content.scenario.description,
            })}
          </p>
        </div>

        <div className="game-header-status">
          <div className="game-active-seat" data-seat={activeSeatTone}>
            <span className="eyebrow">{t('ui.game.activeSeat', 'Active seat')}</span>
            <strong>{getRoleName(focusedPlayer.roleId)}</strong>
            <p>
              {t('ui.game.activeSeatStatus', 'Seat {{seat}} · {{status}}', {
                seat: focusedPlayer.seat + 1,
                status: focusedPlayer.ready ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning'),
              })}
            </p>
          </div>
          <div className="game-header-actions">
            <button className="secondary-button" onClick={() => onExportSave(serializeGame(state))}>
              {t('ui.game.exportSave', 'Export Save')}
            </button>
            <button className="secondary-button" onClick={onBack}>
              {t('ui.game.back', 'Back')}
            </button>
          </div>
        </div>

        <PhaseProgress phase={state.phase} />
        <KpiChips items={kpiItems} />

        {isDev && (
          <details className="game-dev-tools">
            <summary>{t('ui.game.developerTools', 'Developer tools')}</summary>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onViewStateChange({ showDebug: !viewState.showDebug })}
            >
              {viewState.showDebug ? t('ui.game.hideDebug', 'Hide Debug') : t('ui.game.showDebug', 'Show Debug')}
            </button>
          </details>
        )}
      </header>

      <section className="game-resource-bar shell-panel" aria-label={t('ui.game.sharedResources', 'Shared resources')}>
        {RESOURCE_KEYS.map((resource) => (
          <article
            key={resource}
            className={`game-resource-card ${pulsedResources.includes(resource) ? 'is-pulsed' : ''}`}
          >
            <span className="eyebrow">{t(`ui.game.${resource}`, resource)}</span>
            <strong>{state.resources[resource]}</strong>
          </article>
        ))}
        <article className="game-resource-card">
          <span className="eyebrow">{t('ui.game.compromiseDebt', 'Compromise Debt')}</span>
          <strong>{state.globalTokens.compromise_debt ?? 0}</strong>
        </article>
      </section>

      <div className="game-layout">
        <aside className="game-sidebar shell-panel" aria-labelledby="game-left-panel-title">
          <div className="game-panel-header">
            <div>
              <span className="eyebrow">{t('ui.game.scenarioDesk', 'Scenario Desk')}</span>
              <h2 id="game-left-panel-title">
                {viewState.leftTab === 'scenario'
                  ? t('ui.game.brief', 'Brief')
                  : viewState.leftTab === 'fronts'
                    ? t('ui.game.fronts', 'Fronts')
                    : t('ui.game.charterPanel', 'Charter')}
              </h2>
            </div>
            <nav className="segmented" aria-label={t('ui.game.scenarioDeskSections', 'Scenario desk sections')}>
              <button className={viewState.leftTab === 'scenario' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'scenario' })}>
                {t('ui.game.brief', 'Brief')}
              </button>
              <button className={viewState.leftTab === 'fronts' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'fronts', spotlight: null })}>
                {t('ui.game.fronts', 'Fronts')}
              </button>
              <button className={viewState.leftTab === 'charter' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'charter', spotlight: null })}>
                {t('ui.game.charterPanel', 'Charter')}
              </button>
            </nav>
          </div>

          <div className="game-panel-body">
            {viewState.leftTab === 'scenario' && (
              <section className="game-stack" aria-labelledby="scenario-brief-title">
                <article className="shell-card">
                  <h3 id="scenario-brief-title">{t('ui.game.situation', 'Situation')}</h3>
                  <p>{content.scenario.introduction}</p>
                </article>
                <article className="shell-card">
                  <h3>{t('ui.game.moralCenter', 'Moral Center')}</h3>
                  <p>{content.scenario.moralCenter}</p>
                </article>
                <section className="game-stack" aria-labelledby="scenario-rules-title">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{t('ui.game.specialRules', 'Special Rules')}</span>
                      <h3 id="scenario-rules-title">{t('ui.game.pressureTriggers', 'Pressure triggers')}</h3>
                    </div>
                  </div>
                  {content.scenario.specialRuleChips.map((chip) => {
                    const status = getScenarioRuleStatus(state, chip.id);
                    return (
                      <article key={chip.id} className={`shell-card game-rule-card ${status.active ? 'is-active' : ''}`}>
                        <div className="row-split">
                          <div>
                            <strong>{chip.label}</strong>
                            <p>{chip.description}</p>
                          </div>
                          <span className="status-pill neutral">{status.value}</span>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </section>
            )}

            {viewState.leftTab === 'fronts' && (
              <section className="game-stack" aria-labelledby="fronts-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{t('ui.game.systemicFronts', 'Systemic Fronts')}</span>
                    <h3 id="fronts-title">{t('ui.game.frontsSubtitle', 'Pressure, protection, and impact')}</h3>
                  </div>
                </div>
                {Object.values(state.fronts).map((front) => {
                  const frontTheme = FRONT_THEMES[front.id];

                  return (
                    <article key={front.id} className={`shell-card game-front-card ${frontTheme.themeClass} ${front.collapsed ? 'is-collapsed' : ''}`}>
                      <div className="game-front-header">
                        <div>
                          <span className="game-front-icon" aria-hidden="true">
                            {frontTheme.icon}
                          </span>
                          <strong>{content.fronts[front.id].name}</strong>
                        </div>
                        <span className="status-pill neutral">{t(`ui.frontPatterns.${front.id}`, frontTheme.pattern)}</span>
                      </div>
                      <p>
                        {front.collapsed
                          ? t('ui.status.collapsedFront', 'Collapsed front')
                          : t('ui.status.contestableFront', 'Still contestable')}
                      </p>
                      <div className="game-front-metrics">
                        <div>
                          <span>{t('ui.game.pressure', 'Pressure')}</span>
                          <strong>{front.pressure}</strong>
                        </div>
                        <div>
                          <span>{t('ui.game.protection', 'Protection')}</span>
                          <strong>{front.protection}</strong>
                        </div>
                        <div>
                          <span>{t('ui.game.impact', 'Impact')}</span>
                          <strong>{front.impact}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {viewState.leftTab === 'charter' && (
              <section className="game-stack" aria-labelledby="charter-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{t('ui.game.peoplesCharter', "People's Charter")}</span>
                    <h3 id="charter-title">{getEndingTierLabel(ending.tier)}</h3>
                  </div>
                  <span className="status-pill neutral">
                    {t('ui.game.clausesRatified', '{{count}} clauses ratified', { count: ending.ratifiedClauses })}
                  </span>
                </div>
                {Object.values(state.charter).map((clause) => (
                  <article key={clause.id} className={`shell-card game-charter-card status-${clause.status}`}>
                    <div className="row-split">
                      <div>
                        <strong>{content.charter[clause.id].title}</strong>
                        <p>{content.charter[clause.id].description}</p>
                      </div>
                      <span className={`status-pill ${clause.status}`}>{clause.status}</span>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        </aside>

        <main className="game-map-panel shell-panel" aria-labelledby="game-map-title">
          <div className="game-panel-header">
            <div>
              <span className="eyebrow">{t('ui.game.worldTheatre', 'World Theatre')}</span>
              <h2 id="game-map-title">{t('ui.game.regionalPressureBoard', 'Regional pressure board')}</h2>
            </div>
            <div className="map-legend" aria-label={t('ui.game.mapLegend', 'Map legend')}>
              <LegendKey icon="🧍" label={t('ui.game.displacement', 'Displacement')} />
              <LegendKey icon="🛰️" label={t('ui.game.disinfo', 'Disinfo')} />
              <LegendKey icon="🔒" label={t('ui.game.locks', 'Locks')} />
              <LegendKey icon="🏛" label={t('ui.game.institutions', 'Institutions')} />
            </div>
          </div>

          <div className="map-stage">
            <div className="map-silhouette" aria-hidden="true" />
            <div className="map-grid">
              {Object.values(state.regions).map((region) => {
                const regionTheme = REGION_THEMES[region.id];
                const totalPressure = region.tokens.displacement + region.tokens.disinfo + region.locks.length;
                const name = content.regions[region.id].name;

                return (
                  <article
                    key={region.id}
                    className={`map-region-card shell-card ${regionTheme.themeClass} ${viewState.regionId === region.id ? 'is-active' : ''}`}
                    style={{ gridArea: regionTheme.area } as CSSProperties}
                  >
                    <div className="map-region-header">
                      <div>
                        <span className="region-overline">{t('ui.game.risk', 'Risk {{count}}', { count: totalPressure })}</span>
                        <strong>{name}</strong>
                      </div>
                    </div>
                    <p>{getRegionStrapline(region.id, regionTheme.strapline)}</p>
                    <div className="map-region-metrics">
                      <span>{t('ui.game.displacement', 'Displacement')} {region.tokens.displacement}</span>
                      <span>{t('ui.game.disinfo', 'Disinfo')} {region.tokens.disinfo}</span>
                      <span>{t('ui.game.locks', 'Locks')} {region.locks.length}</span>
                      <span>{t('ui.game.institutions', 'Institutions')} {region.institutions.length}</span>
                    </div>
                    <button
                      type="button"
                      className="map-region-cta"
                      onClick={() => onViewStateChange({ regionId: region.id, spotlight: null })}
                    >
                      {t('ui.game.openRegion', 'Open region')}
                    </button>
                  </article>
                );
              })}
            </div>

            <section className="map-footer shell-card" aria-labelledby="phase-control-title">
              <div className="map-footer-copy">
                <span className="eyebrow">{t('ui.game.roundControl', 'Round Control')}</span>
                <h3 id="phase-control-title">{t('ui.game.phaseLabel', '{{phase}} phase', { phase: t(`ui.phases.${state.phase}`, state.phase) })}</h3>
                <p>{getPhaseOutlook(state)}</p>
              </div>

              <div className="map-footer-actions">
                {state.phase === 'WORLD' && (
                  <button className="primary-button map-primary-action" onClick={() => onCommand({ type: 'ResolveWorldPhase' })}>
                    {t('ui.game.resolveWorldPhase', 'Resolve World Phase')}
                  </button>
                )}
                {state.phase === 'COALITION' && (
                  <>
                    <button
                      className="primary-button map-primary-action"
                      disabled={!everyoneReady}
                      aria-describedby="coalition-phase-helper"
                      onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}
                    >
                      {everyoneReady
                        ? t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent')
                        : t('ui.status.waitingForAllSeats', 'Waiting for All Seats')}
                    </button>
                    <p id="coalition-phase-helper" className="helper-text">
                      {getCoalitionHelper(state)}
                    </p>
                  </>
                )}
                {state.phase === 'COMPROMISE' && (
                  <p className="phase-note">{t('ui.status.compromiseVoteLive', 'Compromise vote is live. Resolve the modal to continue.')}</p>
                )}
                {state.phase === 'END' && (
                  <button className="primary-button map-primary-action" onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
                    {t('ui.game.resolveEndPhase', 'Resolve End Phase')}
                  </button>
                )}
                {(state.phase === 'WIN' || state.phase === 'LOSS') && (
                  <div className="ending-card">
                    <h2>{state.phase === 'WIN' ? t('ui.game.coalitionHolds', 'Coalition Holds') : t('ui.game.collapse', 'Collapse')}</h2>
                    <p>
                      {state.phase === 'WIN'
                        ? t('ui.game.endingTier', 'Ending tier: {{tier}}', { tier: getEndingTierLabel(ending.tier) })
                        : state.lossReason}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>

        <aside className="game-sidebar shell-panel" aria-labelledby="game-right-panel-title">
          <div className="game-panel-header">
            <div>
              <span className="eyebrow">{t('ui.game.coalitionDesk', 'Coalition Desk')}</span>
              <h2 id="game-right-panel-title">
                {viewState.rightTab === 'actions'
                  ? t('ui.game.intentWorkspace', 'Intent workspace')
                  : t('ui.game.effectTraceLog', 'Effect trace log')}
              </h2>
            </div>
            <nav className="segmented" aria-label={t('ui.game.coalitionDeskSections', 'Coalition desk sections')}>
              <button className={viewState.rightTab === 'actions' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'actions' })}>
                {t('ui.game.actions', 'Actions')}
              </button>
              <button className={viewState.rightTab === 'log' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'log' })}>
                {t('ui.game.log', 'Log')}
              </button>
            </nav>
          </div>

          <div className="game-panel-body">
            {viewState.rightTab === 'actions' && focusedPlayer && (
              <section className="coalition-workspace" aria-labelledby="coalition-actions-title">
                <div className="visually-hidden">
                  <h3 id="coalition-actions-title">{t('ui.game.coalitionActionPlanning', 'Coalition action planning')}</h3>
                </div>
                <div className="coalition-seat-tabs" role="tablist" aria-label={t('ui.home.coalitionSeats', 'Coalition Seats')}>
                  {state.players.map((player) => {
                    const isActive = focusedPlayer.seat === player.seat;
                    const tone = seatTone(player.seat);

                    return (
                      <div key={player.seat} className={`coalition-seat-card ${isActive ? 'is-active' : ''}`} data-seat={tone}>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className="coalition-seat-trigger"
                          onClick={() => onViewStateChange({ focusedSeat: player.seat, rightTab: 'actions' })}
                        >
                          <strong>{t('ui.game.seat', 'Seat {{seat}}', { seat: player.seat + 1 })}</strong>
                          <span>{content.roles[player.roleId].name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <ActionBoard
                  seat={focusedPlayer.seat}
                  state={state}
                  content={content}
                  player={focusedPlayer}
                  focused
                  onFocus={() => onViewStateChange({ focusedSeat: focusedPlayer.seat })}
                  onQueueAction={queueAction}
                />
              </section>
            )}

            {viewState.rightTab === 'log' && (
              <section className="game-log-section" aria-labelledby="effect-log-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{t('ui.game.effectTraceLog', 'Effect trace log')}</span>
                    <h3 id="effect-log-title">{t('ui.game.recentEvents', 'Recent events')}</h3>
                  </div>
                  <span className="status-pill neutral">{t('ui.game.eventsCount', '{{count}} events', { count: state.eventLog.length })}</span>
                </div>
                <div className="game-log-list">
                  {state.eventLog
                    .slice()
                    .reverse()
                    .map((event) => (
                      <article key={event.seq} className={`shell-card game-log-entry ${viewState.eventSeq === event.seq ? 'is-active' : ''}`}>
                        <button type="button" className="game-log-entry-main" onClick={() => onViewStateChange({ eventSeq: event.seq, rightTab: 'log' })}>
                          <span className="game-log-icon">{event.emoji}</span>
                          <div>
                            <strong>{event.message}</strong>
                            <p>{event.causedBy.join(' -> ')}</p>
                          </div>
                        </button>
                      </article>
                    ))}
                </div>
              </section>
            )}
          </div>
        </aside>
      </div>

      <RegionDrawer
        regionId={viewState.regionId}
        focusedSeat={viewState.focusedSeat}
        state={state}
        content={content}
        onClose={() => onViewStateChange({ regionId: null })}
        onQueueAction={queueAction}
      />

      <TraceDrawer event={selectedEvent} onClose={() => onViewStateChange({ eventSeq: null })} />

      <DealModal state={state} content={content} onCommand={onCommand} />

      {viewState.showDebug && <DebugOverlay state={state} roomId={roomId} />}
    </div>
  );
}
