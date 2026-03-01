import type { CSSProperties } from 'react';
import {
  getEndingTierSummary,
  getScenarioRuleStatus,
  getTemperatureBand,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
} from '../../engine/index.ts';
import { ActionBoard } from './ActionBoard.tsx';
import { DebugOverlay } from './DebugOverlay.tsx';
import { DealModal } from './DealModal.tsx';
import { RegionDrawer } from './RegionDrawer.tsx';
import { TraceDrawer } from './TraceDrawer.tsx';
import { getCivicSpaceLabel, getEndingTierLabel, getRegionStrapline, getRoleName, t } from '../i18n/index.ts';
import { FRONT_ACCENTS, REGION_LAYOUT } from './worldMap.ts';
import type { GameViewState } from './urlState.ts';

interface GameScreenProps {
  surface: 'local' | 'room';
  roomId?: string | null;
  state: EngineState;
  content: CompiledContent;
  viewState: GameViewState;
  onViewStateChange: (patch: Partial<GameViewState>) => void;
  onCommand: (command: EngineCommand) => void;
  onBack: () => void;
  onExportSave: (serialized: string) => void;
}

const PHASE_LABELS: Array<EngineState['phase']> = ['WORLD', 'COALITION', 'COMPROMISE', 'END'];

function spotlightIs(viewState: GameViewState, prefix: string, id: string) {
  return viewState.spotlight === `${prefix}:${id}`;
}

export function GameScreen({
  surface,
  roomId,
  state,
  content,
  viewState,
  onViewStateChange,
  onCommand,
  onBack,
  onExportSave,
}: GameScreenProps) {
  const band = getTemperatureBand(state.temperature);
  const everyoneReady = state.players.every((player) => player.ready);
  const ending = getEndingTierSummary(state);
  const focusedPlayer = state.players[viewState.focusedSeat] ?? state.players[0];
  const selectedEvent = state.eventLog.find((event) => event.seq === viewState.eventSeq) ?? null;
  const focusedRegion = viewState.regionId ? state.regions[viewState.regionId] : null;
  const focusLabel = (() => {
    if (viewState.spotlight?.startsWith('front:')) {
      const frontId = viewState.spotlight.split(':', 2)[1] as keyof typeof content.fronts;
      return `Front focus: ${content.fronts[frontId]?.name ?? frontId}`;
    }

    if (viewState.spotlight?.startsWith('charter:')) {
      const clauseId = viewState.spotlight.split(':', 2)[1] as keyof typeof content.charter;
      return `Charter focus: ${content.charter[clauseId]?.title ?? clauseId}`;
    }

    if (viewState.spotlight?.startsWith('rule:')) {
      const ruleId = viewState.spotlight.split(':', 2)[1];
      const rule = content.scenario.specialRuleChips.find((chip) => chip.id === ruleId);
      return `Rule focus: ${rule?.label ?? ruleId}`;
    }

    if (viewState.spotlight?.startsWith('phase:')) {
      return `Phase focus: ${viewState.spotlight.split(':', 2)[1]}`;
    }

    if (focusedRegion) {
      return `Region focus: ${content.regions[focusedRegion.id].name}`;
    }

    if (selectedEvent) {
      return `Event focus: #${selectedEvent.seq}`;
    }

    return 'Table overview';
  })();

  return (
    <div className="game-shell premium-game-shell">
      <header className="game-header premium-game-header">
        <div className="title-stack">
          <span className="eyebrow">{t('ui.game.commandTable', 'Global Command Table')}</span>
          <h1>{content.scenario.name}</h1>
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

        <div className="phase-rail premium-phase-rail">
          {PHASE_LABELS.map((phase) => (
            <div key={phase} className={`phase-pill ${state.phase === phase ? 'active' : ''}`}>
              {t(`ui.phases.${phase}`, phase)}
            </div>
          ))}
        </div>

        <div className="header-kpi-grid">
          <div className="header-kpi">
            <span>{t('ui.game.temperature', 'Temperature')}</span>
            <strong>+{state.temperature}°C</strong>
            <small>
              {t('ui.game.temperatureBand', 'Band {{band}} | {{crisisCount}} crisis cards', {
                band: band.band,
                crisisCount: band.crisisCount,
              })}
            </small>
          </div>
          <div className="header-kpi">
            <span>{t('ui.game.civicSpace', 'Civic Space')}</span>
            <strong>{getCivicSpaceLabel(state.civicSpace)}</strong>
            <small>{t('ui.game.civicSpaceHelp', 'Pressure on public organizing capacity')}</small>
          </div>
          <div className="header-kpi">
            <span>{t('ui.game.charter', 'Charter')}</span>
            <strong>{ending.ratifiedClauses} ratified</strong>
            <small>{getEndingTierLabel(ending.tier)}</small>
          </div>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => onExportSave(serializeGame(state))}>
            {t('ui.game.exportSave', 'Export Save')}
          </button>
          <button
            className="secondary-button"
            onClick={() => onViewStateChange({ showDebug: !viewState.showDebug })}
          >
            {viewState.showDebug ? t('ui.game.hideDebug', 'Hide Debug') : t('ui.game.showDebug', 'Show Debug')}
          </button>
          <button className="secondary-button" onClick={onBack}>
            {t('ui.game.back', 'Back')}
          </button>
        </div>
      </header>

      <div className="resource-ribbon">
        <div className="resource-stat">
          <span>{t('ui.game.solidarity', 'Solidarity')}</span>
          <strong>{state.resources.solidarity}</strong>
        </div>
        <div className="resource-stat">
          <span>{t('ui.game.evidence', 'Evidence')}</span>
          <strong>{state.resources.evidence}</strong>
        </div>
        <div className="resource-stat">
          <span>{t('ui.game.capacity', 'Capacity')}</span>
          <strong>{state.resources.capacity}</strong>
        </div>
        <div className="resource-stat">
          <span>{t('ui.game.relief', 'Relief')}</span>
          <strong>{state.resources.relief}</strong>
        </div>
        <div className="resource-stat">
          <span>{t('ui.game.compromiseDebt', 'Compromise Debt')}</span>
          <strong>{state.globalTokens.compromise_debt ?? 0}</strong>
        </div>
      </div>

      <section className="focus-ribbon">
        <article className="focus-card">
          <span>Current focus</span>
          <strong>{focusLabel}</strong>
          <small>{selectedEvent ? selectedEvent.message : focusedRegion ? getRegionStrapline(focusedRegion.id, '') : 'The URL tracks the current room, scenario, and table state.'}</small>
        </article>
        <article className="focus-card">
          <span>Active seat</span>
          <strong>{getRoleName(focusedPlayer.roleId)}</strong>
          <small>{everyoneReady ? t('ui.status.ready', 'Ready') : t('ui.status.planning', 'Planning')}</small>
        </article>
        <article className="focus-card">
          <span>Outcome track</span>
          <strong>{getEndingTierLabel(ending.tier)}</strong>
          <small>{ending.ratifiedClauses} charter clauses ratified</small>
        </article>
      </section>

      <div className="board-grid premium-board-grid">
        <aside className="panel left-panel premium-panel">
          <div className="panel-toolbar">
            <div>
              <span className="eyebrow">{t('ui.game.scenarioDesk', 'Scenario Desk')}</span>
              <h2>{content.scenario.name}</h2>
            </div>
            <div className="segmented compact">
              <button className={viewState.leftTab === 'scenario' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'scenario' })}>
                {t('ui.game.brief', 'Brief')}
              </button>
              <button className={viewState.leftTab === 'fronts' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'fronts', spotlight: null })}>
                {t('ui.game.fronts', 'Fronts')}
              </button>
              <button className={viewState.leftTab === 'charter' ? 'active' : ''} onClick={() => onViewStateChange({ leftTab: 'charter', spotlight: null })}>
                {t('ui.game.charterPanel', 'Charter')}
              </button>
            </div>
          </div>

          <div className="panel-body">
            {viewState.leftTab === 'scenario' && (
              <section className="scenario-panel premium-stack">
                <div className="story-block">
                  <h3>{t('ui.game.situation', 'Situation')}</h3>
                  <p>{content.scenario.introduction}</p>
                </div>
                <div className="story-block">
                  <h3>{t('ui.game.moralCenter', 'Moral Center')}</h3>
                  <p>{content.scenario.moralCenter}</p>
                </div>
                <div className="story-block">
                  <h3>{t('ui.game.specialRules', 'Special Rules')}</h3>
                  <div className="scenario-rule-list">
                    {content.scenario.specialRuleChips.map((chip) => {
                      const status = getScenarioRuleStatus(state, chip.id);
                      return (
                        <article
                          key={chip.id}
                          className={`rule-feature ${status.active ? 'active' : ''} ${spotlightIs(viewState, 'rule', chip.id) ? 'spotlighted' : ''}`}
                        >
                          <div className="row-split">
                            <div>
                              <strong>{chip.label}</strong>
                              <p>{chip.description}</p>
                            </div>
                          </div>
                          <span className="rule-status">{status.value}</span>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {viewState.leftTab === 'fronts' && (
              <section className="premium-stack">
                <div className="section-heading">
                  <h3>{t('ui.game.systemicFronts', 'Systemic Fronts')}</h3>
                  <span className="muted">{t('ui.game.frontsSubtitle', 'Pressure, protection, and impact')}</span>
                </div>
                <div className="front-list">
                  {Object.values(state.fronts).map((front) => (
                    <article
                      key={front.id}
                      className={`front-card premium-front-card ${front.collapsed ? 'collapsed' : ''} ${spotlightIs(viewState, 'front', front.id) ? 'spotlighted' : ''}`}
                      style={{ '--front-accent': FRONT_ACCENTS[front.id] } as CSSProperties}
                    >
                      <div className="row-split">
                        <div>
                          <strong>{content.fronts[front.id].name}</strong>
                          <p>
                            {front.collapsed
                              ? t('ui.status.collapsedFront', 'Collapsed front')
                              : t('ui.status.contestableFront', 'Still contestable')}
                          </p>
                        </div>
                      </div>
                      <div className="front-meter-grid">
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
                  ))}
                </div>
              </section>
            )}

            {viewState.leftTab === 'charter' && (
              <section className="premium-stack">
                <div className="section-heading">
                  <h3>{t('ui.game.peoplesCharter', "People's Charter")}</h3>
                  <span className="muted">
                    {t('ui.game.clausesRatified', '{{count}} clauses ratified', { count: ending.ratifiedClauses })}
                  </span>
                </div>
                <div className="charter-list">
                  {Object.values(state.charter).map((clause) => (
                    <article
                      key={clause.id}
                      className={`charter-card premium-charter-card ${clause.status} ${spotlightIs(viewState, 'charter', clause.id) ? 'spotlighted' : ''}`}
                    >
                      <div className="row-split">
                        <div>
                          <strong>{content.charter[clause.id].title}</strong>
                          <p>{content.charter[clause.id].description}</p>
                        </div>
                      </div>
                      <span className={`status-pill ${clause.status}`}>{clause.status}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        <main className="panel center-panel premium-panel map-panel">
          <div className="map-header">
            <div>
              <span className="eyebrow">{t('ui.game.worldTheatre', 'World Theatre')}</span>
              <h2>{t('ui.game.regionalPressureBoard', 'Regional pressure board')}</h2>
            </div>
            <div className="map-legend">
              <span>{t('ui.game.displacement', 'Displacement')}</span>
              <span>{t('ui.game.disinfo', 'Disinfo')}</span>
              <span>{t('ui.game.locks', 'Locks')}</span>
              <span>{t('ui.game.institutions', 'Institutions')}</span>
            </div>
          </div>

          <div className="world-map-stage">
            <div className="map-atmosphere" />
            <div className="world-map-grid">
              {Object.values(state.regions).map((region) => {
                const layout = REGION_LAYOUT[region.id];
                const totalPressure = region.tokens.displacement + region.tokens.disinfo + region.locks.length;
                const name = content.regions[region.id].name;

                return (
                  <button
                    key={region.id}
                    type="button"
                    className={`region-node ${viewState.regionId === region.id ? 'active' : ''}`}
                    style={{ gridArea: layout.area, '--region-accent': layout.accent } as CSSProperties}
                    onClick={() => onViewStateChange({ regionId: region.id, spotlight: null })}
                  >
                    <div className="region-node-header">
                      <div>
                        <span className="region-overline">
                          {t('ui.game.risk', 'Risk {{count}}', { count: totalPressure })}
                        </span>
                        <strong>{name}</strong>
                      </div>
                    </div>
                    <p>{getRegionStrapline(region.id, layout.strapline)}</p>
                    <div className="region-metrics">
                      <span>{t('ui.game.displacement', 'Displacement')} {region.tokens.displacement}</span>
                      <span>{t('ui.game.disinfo', 'Disinfo')} {region.tokens.disinfo}</span>
                      <span>{t('ui.game.locks', 'Locks')} {region.locks.length}</span>
                      <span>{t('ui.game.institutions', 'Institutions')} {region.institutions.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="map-footer-card">
              <div>
                <span className="eyebrow">{t('ui.game.roundControl', 'Round Control')}</span>
                <h3>{t('ui.game.phaseLabel', '{{phase}} phase', { phase: t(`ui.phases.${state.phase}`, state.phase) })}</h3>
                <p>{t('ui.game.roundControlBody', 'Advance only when the table is ready. The URL updates with the current session state.')}</p>
              </div>
              <div className="phase-panel">
                {state.phase === 'WORLD' && (
                  <button className="primary-button" onClick={() => onCommand({ type: 'ResolveWorldPhase' })}>
                    {t('ui.game.resolveWorldPhase', 'Resolve World Phase')}
                  </button>
                )}
                {state.phase === 'COALITION' && (
                  <button
                    className="primary-button"
                    disabled={!everyoneReady}
                    onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}
                  >
                    {everyoneReady
                      ? t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent')
                      : t('ui.status.waitingForAllSeats', 'Waiting for All Seats')}
                  </button>
                )}
                {state.phase === 'COMPROMISE' && (
                  <div className="phase-note">
                    {t('ui.status.compromiseVoteLive', 'Compromise vote is live. Resolve the modal to continue.')}
                  </div>
                )}
                {state.phase === 'END' && (
                  <button className="primary-button" onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
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
            </div>
          </div>
        </main>

        <aside className="panel right-panel premium-panel">
          <div className="panel-toolbar">
            <div>
              <span className="eyebrow">{t('ui.game.coalitionDesk', 'Coalition Desk')}</span>
              <h2>
                {viewState.rightTab === 'actions'
                  ? t('ui.game.intentWorkspace', 'Intent workspace')
                  : t('ui.game.effectTraceLog', 'Effect trace log')}
              </h2>
            </div>
            <div className="segmented compact">
              <button className={viewState.rightTab === 'actions' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'actions' })}>
                {t('ui.game.actions', 'Actions')}
              </button>
              <button className={viewState.rightTab === 'log' ? 'active' : ''} onClick={() => onViewStateChange({ rightTab: 'log' })}>
                {t('ui.game.log', 'Log')}
              </button>
            </div>
          </div>

          <div className="panel-body">
            {viewState.rightTab === 'actions' && focusedPlayer && (
              <section className="intent-workspace">
                <div className="seat-tabs">
                  {state.players.map((player) => (
                    <div key={player.seat} className={`seat-tab ${focusedPlayer.seat === player.seat ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="seat-tab-main"
                        onClick={() => onViewStateChange({ focusedSeat: player.seat, rightTab: 'actions' })}
                      >
                        <strong>{t('ui.game.seat', 'Seat {{seat}}', { seat: player.seat + 1 })}</strong>
                        <span>{content.roles[player.roleId].name}</span>
                      </button>
                    </div>
                  ))}
                </div>

                <ActionBoard
                  seat={focusedPlayer.seat}
                  state={state}
                  content={content}
                  player={focusedPlayer}
                  focused
                  onFocus={() => onViewStateChange({ focusedSeat: focusedPlayer.seat })}
                  onCommand={onCommand}
                />
              </section>
            )}

            {viewState.rightTab === 'log' && (
              <section className="log-section">
                <div className="section-heading">
                  <h3>{t('ui.game.effectTraceLog', 'Effect trace log')}</h3>
                  <span className="muted">{t('ui.game.eventsCount', '{{count}} events', { count: state.eventLog.length })}</span>
                </div>
                <div className="event-log">
                  {state.eventLog
                    .slice()
                    .reverse()
                    .map((event) => (
                      <article key={event.seq} className={`log-entry premium-log-entry ${viewState.eventSeq === event.seq ? 'active' : ''}`}>
                        <button type="button" className="log-entry-main" onClick={() => onViewStateChange({ eventSeq: event.seq, rightTab: 'log' })}>
                          <span className="log-entry-icon">{event.emoji}</span>
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
        onCommand={onCommand}
      />

      <TraceDrawer
        event={selectedEvent}
        onClose={() => onViewStateChange({ eventSeq: null })}
      />

      <DealModal
        state={state}
        content={content}
        onCommand={onCommand}
      />
      {viewState.showDebug && <DebugOverlay state={state} roomId={roomId} />}
    </div>
  );
}
