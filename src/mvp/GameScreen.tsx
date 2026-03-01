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
import { NowBar } from './NowBar.tsx';
import { PhaseProgress } from './PhaseProgress.tsx';
import { RegionDrawer } from './RegionDrawer.tsx';
import { TraceDrawer } from './TraceDrawer.tsx';
import type { ToastMessage } from './ToastStack.tsx';
import { getCivicSpaceLabel, getEndingTierLabel, getRoleName, t, type Locale } from '../i18n/index.ts';
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
  const everyoneReady = state.players.every((player) => player.ready);
  const ending = getEndingTierSummary(state);
  const focusedPlayer = state.players[viewState.focusedSeat] ?? state.players[0];
  const selectedEvent = state.eventLog.find((event) => event.seq === viewState.eventSeq) ?? null;
  const previousStateRef = useRef<EngineState | null>(null);
  const [pulsedResources, setPulsedResources] = useState<ResourceType[]>([]);
  const [worldPhaseSelected, setWorldPhaseSelected] = useState(false);
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
        setWorldPhaseSelected(false);
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

  const tempSeverity = state.temperature <= 3 ? 'normal' as const : state.temperature <= 5 ? 'elevated' as const : state.temperature <= 7 ? 'high' as const : 'critical' as const;
  const civicSeverityMap: Record<string, 'normal' | 'elevated' | 'high' | 'critical'> = { OPEN: 'normal', NARROWED: 'elevated', OBSTRUCTED: 'high', REPRESSED: 'critical', CLOSED: 'critical' };
  const civicGaugeMap: Record<string, number> = { OPEN: 10, NARROWED: 35, OBSTRUCTED: 60, REPRESSED: 85, CLOSED: 100 };
  const civicSeverity = civicSeverityMap[state.civicSpace] ?? 'normal';
  const charterSeverity = ending.ratifiedClauses >= 4 ? 'normal' as const : ending.ratifiedClauses >= 2 ? 'elevated' as const : 'high' as const;

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
      severity: tempSeverity,
      gaugePercent: Math.min(100, (state.temperature / 10) * 100),
    },
    {
      id: 'civic-space',
      label: t('ui.game.civicSpace', 'Civic Space'),
      value: getCivicSpaceLabel(state.civicSpace),
      detail: t('ui.game.civicSpaceDetail', 'Tracks how much organizing room remains for the coalition.'),
      severity: civicSeverity,
      gaugePercent: civicGaugeMap[state.civicSpace] ?? 50,
    },
    {
      id: 'charter',
      label: t('ui.game.charter', 'Charter'),
      value: `${ending.ratifiedClauses} ratified`,
      detail: t('ui.game.charterDetail', 'Outcome track: {{tier}}.', { tier: getEndingTierLabel(ending.tier) }),
      severity: charterSeverity,
      gaugePercent: Math.min(100, (ending.ratifiedClauses / 6) * 100),
    },
  ];

  return (
    <div className="game-screen" data-seat={activeSeatTone}>
      <header className="game-header-shell" aria-labelledby="game-title">
        <div className="row-split">
          <div className="game-header-copy">
            <h1 id="game-title">{content.scenario.name}</h1>
            <PhaseProgress phase={state.phase} />
          </div>

          <div className="game-header-status">
            <KpiChips items={kpiItems} />
            <div className="game-header-actions">
              <button className="secondary-button compact-button" onClick={() => onExportSave(serializeGame(state))}>
                {t('ui.game.exportSave', 'Export Save')}
              </button>
              <button className="secondary-button compact-button" onClick={onBack}>
                {t('ui.game.back', 'Back')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <NowBar
        state={state}
        onCommand={onCommand}
        worldPhaseSelected={worldPhaseSelected}
        setWorldPhaseSelected={setWorldPhaseSelected}
      />

      <div className="game-layout">
        <aside className="game-sidebar shell-panel" aria-labelledby="game-left-panel-title">
          <div className="game-panel-header">
            <nav className="segmented compact" aria-label={t('ui.game.scenarioDeskSections', 'Scenario desk sections')}>
              <button className={viewState.leftTab === 'scenario' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'scenario' })}>
                {t('ui.game.brief', 'Brief')}
              </button>
              <button className={viewState.leftTab === 'fronts' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'fronts' })}>
                {t('ui.game.fronts', 'Fronts')}
              </button>
              <button className={viewState.leftTab === 'charter' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'charter' })}>
                {t('ui.game.charterPanel', 'Charter')}
              </button>
            </nav>
          </div>

          <div className="game-panel-body">
            {viewState.leftTab === 'scenario' && (
              <section className="game-stack">
                <article className="shell-card compact">
                  <h3>{t('ui.game.situation', 'Situation')}</h3>
                  <p>{content.scenario.introduction}</p>
                </article>
                <article className="shell-card compact">
                  <h3>{t('ui.game.moralCenter', 'Moral Center')}</h3>
                  <p>{content.scenario.moralCenter}</p>
                </article>
                <div className="section-divider" />
                <div className="game-stack">
                  {content.scenario.specialRuleChips.map((chip) => {
                    const status = getScenarioRuleStatus(state, chip.id);
                    return (
                      <article key={chip.id} className={`shell-card game-rule-card compact ${status.active ? 'is-active' : ''}`}>
                        <strong>{chip.label}</strong>
                        <p>{chip.description}</p>
                        <span className="status-pill neutral">{status.value}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {viewState.leftTab === 'fronts' && (
              <section className="game-stack">
                {Object.values(state.fronts).map((front) => {
                  const frontTheme = FRONT_THEMES[front.id];
                  return (
                    <article key={front.id} className={`shell-card game-front-card compact ${frontTheme.themeClass} ${front.collapsed ? 'is-collapsed' : ''}`}>
                      <div className="game-front-header">
                        <strong>{content.fronts[front.id].name}</strong>
                      </div>
                      <div className="game-front-stats-strip">
                        <div className="stat-item"><span>🔥</span><strong>{front.pressure}</strong></div>
                        <div className="stat-item"><span>🛡️</span><strong>{front.protection}</strong></div>
                        <div className="stat-item"><span>💎</span><strong>{front.impact}</strong></div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {viewState.leftTab === 'charter' && (
              <section className="game-stack">
                {Object.values(state.charter).map((clause) => (
                  <article key={clause.id} className={`shell-card game-charter-card compact status-${clause.status}`}>
                    <strong>{content.charter[clause.id].title}</strong>
                    <span className={`status-pill ${clause.status}`}>{clause.status}</span>
                  </article>
                ))}
              </section>
            )}
          </div>
        </aside>

        <main className="game-map-panel" aria-labelledby="game-map-title">
          <div className="map-stage">
            <div className="map-silhouette" aria-hidden="true" />
            <div className="map-compass" aria-hidden="true">
              <svg viewBox="0 0 100 100" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="0.5" style={{ opacity: 0.15 }}>
                <circle cx="50" cy="50" r="45" />
                <path d="M50 5 L50 95 M5 50 L95 50" />
                <path d="M20 20 L80 80 M80 20 L20 80" />
                <path d="M50 15 L55 35 L50 45 L45 35 Z" fill="currentColor" stroke="none" />
                <text x="47" y="12" fill="currentColor" style={{ fontSize: '6px', fontWeight: 'bold' }}>N</text>
              </svg>
            </div>

            <svg className="map-connections" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
              <g stroke="white" strokeWidth="1" strokeDasharray="4 6" opacity="0.1">
                {/* NA to EU */}
                <path d="M250,150 L650,150" />
                {/* NA to LatAm */}
                <path d="M250,150 L300,400" />
                {/* EU to MENA */}
                <path d="M650,150 L850,250" />
                {/* MENA to SSA */}
                <path d="M850,250 L550,400" />
                {/* MENA to SouthAsia */}
                <path d="M850,250 L950,350" />
                {/* SouthAsia to SEAsia */}
                <path d="M950,350 L1100,250" />
                {/* SEAsia to Pacific */}
                <path d="M1100,250 L1100,450" />
              </g>
            </svg>

            <div className="map-grid">
              {Object.values(state.regions).length === 0 && (
                <div className="map-empty-placeholder tier-b-panel">
                  <p>{t('ui.game.noActiveCrises', 'No active crises yet.')}</p>
                </div>
              )}
              {Object.values(state.regions).map((region) => {
                const regionTheme = REGION_THEMES[region.id];
                const totalPressure = region.tokens.displacement + region.tokens.disinfo + region.locks.length;
                return (
                  <article
                    key={region.id}
                    className={`map-region-card shell-card compact ${regionTheme.themeClass} ${viewState.regionId === region.id ? 'is-active' : ''}`}
                    style={{ gridArea: regionTheme.area } as CSSProperties}
                    data-pressure={totalPressure <= 1 ? 'low' : totalPressure <= 3 ? 'medium' : totalPressure <= 5 ? 'high' : 'critical'}
                    onClick={() => onViewStateChange({ regionId: region.id })}
                  >
                    <div className="map-region-header">
                      <strong>{content.regions[region.id].name}</strong>
                      <span className="pressure-chip">{totalPressure}</span>
                    </div>
                    <div className="map-region-metrics">
                      <span>🧍{region.tokens.displacement}</span>
                      <span>🛰️{region.tokens.disinfo}</span>
                      <span>🔒{region.locks.length}</span>
                      <span>🏛{region.institutions.length}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="map-footer shell-card" aria-labelledby="phase-control-title">
              <div className="map-footer-copy">
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
                  <button
                    className="primary-button map-primary-action"
                    disabled={!everyoneReady}
                    onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}
                  >
                    {everyoneReady ? t('ui.game.commitCoalitionIntent', 'Commit Coalition') : t('ui.status.waiting', 'Waiting...')}
                  </button>
                )}
                {state.phase === 'END' && (
                  <button className="primary-button map-primary-action" onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
                    {t('ui.game.resolveEndPhase', 'Resolve End Phase')}
                  </button>
                )}
              </div>
            </section>
          </div>
        </main>

        <aside className="game-sidebar shell-panel">
          <div className="game-panel-header">
            <nav className="segmented compact">
              <button className={viewState.rightTab === 'actions' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'actions' })}>
                {t('ui.game.actions', 'Actions')}
              </button>
              <button className={viewState.rightTab === 'log' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'log' })}>
                {t('ui.game.log', 'Log')}
              </button>
            </nav>
          </div>

          <div className="game-panel-body">
            {viewState.rightTab === 'actions' && (
              <ActionBoard
                seat={focusedPlayer.seat}
                state={state}
                content={content}
                player={focusedPlayer}
                onQueueAction={queueAction}
              />
            )}

            {viewState.rightTab === 'log' && (
              <div className="game-log-list">
                {state.eventLog.slice().reverse().map((event) => (
                  <article key={event.seq} className={`shell-card game-log-entry compact ${viewState.eventSeq === event.seq ? 'is-active' : ''}`}>
                    <button type="button" className="game-log-entry-main" onClick={() => onViewStateChange({ eventSeq: event.seq })}>
                      <span className="game-log-icon">{event.emoji}</span>
                      <div>
                        <strong>{event.message}</strong>
                        <p>{event.causedBy.slice(-1)}</p>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="game-console">
        <div className="console-player-info">
          <span className="eyebrow">{t('ui.game.activeSeat', 'Command Seat')}</span>
          <strong>{getRoleName(focusedPlayer.roleId)}</strong>
          <div className="coalition-seat-tabs mini">
            {state.players.map((p) => (
              <button
                key={p.seat}
                className={`mini-seat-dot ${p.seat === focusedPlayer.seat ? 'active' : ''} ${p.ready ? 'ready' : ''}`}
                data-seat={seatTone(p.seat)}
                onClick={() => onViewStateChange({ focusedSeat: p.seat })}
                title={getRoleName(p.roleId)}
              />
            ))}
          </div>
        </div>

        <div className="console-resources-center">
          <div className="console-resources">
            {RESOURCE_KEYS.map((resource) => (
              <div key={resource} className={`console-resource-chip ${pulsedResources.includes(resource) ? 'is-pulsed' : ''}`}>
                <span className="icon">{resource === 'solidarity' ? '🤝' : resource === 'evidence' ? '🛰️' : resource === 'capacity' ? '🧱' : '🩹'}</span>
                <strong>{state.resources[resource]}</strong>
              </div>
            ))}
            <div className="console-resource-chip">
              <span className="icon">⚖️</span>
              <strong>{state.globalTokens.compromise_debt ?? 0}</strong>
            </div>
          </div>
        </div>

        <div className="console-actions">
          <button
            className={`secondary-button compact-button ${focusedPlayer.ready ? 'active' : ''}`}
            disabled={state.phase !== 'COALITION' || focusedPlayer.actionsRemaining !== 0}
            onClick={() => onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready: !focusedPlayer.ready })}
          >
            {focusedPlayer.ready ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning')}
          </button>
        </div>
      </footer>

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
