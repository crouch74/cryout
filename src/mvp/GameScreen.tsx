import { useState } from 'react';
import {
  getEndingTierSummary,
  getScenarioRuleStatus,
  getTemperatureBand,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type RegionId,
} from '../../engine/index.ts';
import { ActionBoard } from './ActionBoard.tsx';
import { DebugOverlay } from './DebugOverlay.tsx';
import { DealModal } from './DealModal.tsx';
import { RegionDrawer } from './RegionDrawer.tsx';
import { TraceDrawer } from './TraceDrawer.tsx';

interface GameScreenProps {
  surface: 'local' | 'room';
  roomId?: string | null;
  state: EngineState;
  content: CompiledContent;
  onCommand: (command: EngineCommand) => void;
  onBack: () => void;
  onExportSave: (serialized: string) => void;
}

export function GameScreen({ surface, roomId, state, content, onCommand, onBack, onExportSave }: GameScreenProps) {
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [eventSeq, setEventSeq] = useState<number | null>(null);
  const [focusedSeat, setFocusedSeat] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [leftTab, setLeftTab] = useState<'scenario' | 'fronts' | 'charter'>('fronts');
  const [rightTab, setRightTab] = useState<'actions' | 'log'>('actions');

  const band = getTemperatureBand(state.temperature);
  const selectedEvent = state.eventLog.find((event) => event.seq === eventSeq) ?? null;
  const everyoneReady = state.players.every((player) => player.ready);
  const ending = getEndingTierSummary(state);
  const focusedPlayer = state.players.find((player) => player.seat === focusedSeat) ?? state.players[0];

  return (
    <div className="game-shell">
      <header className="game-header">
        <div>
          <span className="eyebrow">Dignity Rising</span>
          <h1>Witness &amp; Dignity</h1>
          <p>
            Round {state.round} / {state.roundLimit} • {surface === 'local' ? 'Local Table' : `Room Play ${roomId ?? ''}`}
          </p>
        </div>

        <div className="phase-rail">
          {['WORLD', 'COALITION', 'COMPROMISE', 'END'].map((phase) => (
            <span key={phase} className={`phase-pill ${state.phase === phase ? 'active' : ''}`}>
              {phase}
            </span>
          ))}
        </div>

        <div className="header-stats">
          <span>🌡️ +{state.temperature}°C / band {band.band}</span>
          <span>⚖️ {state.civicSpace}</span>
          <span>🤝 {state.resources.solidarity}</span>
          <span>🛰️ {state.resources.evidence}</span>
          <span>🧱 {state.resources.capacity}</span>
          <span>🩹 {state.resources.relief}</span>
          <span>🧾 Debt {state.globalTokens.compromise_debt ?? 0}</span>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => onExportSave(serializeGame(state))}>
            Export Save
          </button>
          <button className="secondary-button" onClick={() => setShowDebug((value) => !value)}>
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
          <button className="secondary-button" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <div className="board-grid">
        <aside className="panel left-panel">
          <div className="panel-toolbar">
            <div>
              <span className="eyebrow">Scenario Desk</span>
              <h2>{content.scenario.name}</h2>
            </div>
            <div className="segmented compact">
              <button className={leftTab === 'scenario' ? 'active' : ''} onClick={() => setLeftTab('scenario')}>
                Brief
              </button>
              <button className={leftTab === 'fronts' ? 'active' : ''} onClick={() => setLeftTab('fronts')}>
                Fronts
              </button>
              <button className={leftTab === 'charter' ? 'active' : ''} onClick={() => setLeftTab('charter')}>
                Charter
              </button>
            </div>
          </div>

          <div className="panel-body">
            {leftTab === 'scenario' && (
              <section className="scenario-panel">
                <p>{content.scenario.description}</p>
                <div className="chip-row">
                  {content.scenario.specialRuleChips.map((chip) => {
                    const status = getScenarioRuleStatus(state, chip.id);
                    return (
                      <div key={chip.id} className={`rule-chip ${status.active ? 'active' : ''}`}>
                        <strong>{chip.label}</strong>
                        <span>{status.value}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {leftTab === 'fronts' && (
              <section>
                <div className="section-heading">
                  <h3>Fronts</h3>
                  <span className="muted">Pressure / Protection / Impact</span>
                </div>
                <div className="front-list">
                  {Object.values(state.fronts).map((front) => (
                    <div key={front.id} className={`front-card ${front.collapsed ? 'collapsed' : ''}`}>
                      <div className="row-split">
                        <strong>{content.fronts[front.id].name}</strong>
                        <span>{front.collapsed ? 'Collapsed' : 'Standing'}</span>
                      </div>
                      <div className="meter-row">
                        <span>Pressure</span>
                        <strong>{front.pressure}</strong>
                      </div>
                      <div className="meter-row">
                        <span>Protection</span>
                        <strong>{front.protection}</strong>
                      </div>
                      <div className="meter-row">
                        <span>Impact</span>
                        <strong>{front.impact}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {leftTab === 'charter' && (
              <section>
                <div className="section-heading">
                  <h3>People&apos;s Charter</h3>
                  <span className="muted">{ending.ratifiedClauses} ratified</span>
                </div>
                <div className="charter-list">
                  {Object.values(state.charter).map((clause) => (
                    <div key={clause.id} className={`charter-card ${clause.status}`}>
                      <div className="row-split">
                        <strong>{content.charter[clause.id].title}</strong>
                        <span>{clause.status}</span>
                      </div>
                      <p>{content.charter[clause.id].description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        <main className="panel center-panel">
          <div className="map-header">
            <div>
              <span className="eyebrow">Global Map</span>
              <h2>Regional pressure board</h2>
            </div>
            <div className="map-legend">
              <span>🧍 Displacement</span>
              <span>🛰️ Disinfo</span>
              <span>🔒 Locks</span>
              <span>🏛 Institutions</span>
            </div>
          </div>

          <div className="region-grid">
            {Object.values(state.regions).map((region) => (
              <button key={region.id} className="region-card" onClick={() => setRegionId(region.id)}>
                <div className="row-split">
                  <strong>{region.id}</strong>
                  <span>{region.institutions.length} 🏛</span>
                </div>
                <div className="chip-row compact">
                  <span>🧍 {region.tokens.displacement}</span>
                  <span>🛰️ {region.tokens.disinfo}</span>
                  <span>🔒 {region.locks.length}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="phase-panel">
            {state.phase === 'WORLD' && (
              <button className="primary-button" onClick={() => onCommand({ type: 'ResolveWorldPhase' })}>
                🌍 Resolve World Phase
              </button>
            )}
            {state.phase === 'COALITION' && (
              <button
                className="primary-button"
                disabled={!everyoneReady}
                onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}
              >
                🤝 Commit Coalition Intent
              </button>
            )}
            {state.phase === 'END' && (
              <button className="primary-button" onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
                🧩 Resolve End Phase
              </button>
            )}
            {(state.phase === 'WIN' || state.phase === 'LOSS') && (
              <div className="ending-card">
                <h2>{state.phase === 'WIN' ? 'Coalition Holds' : 'Collapse'}</h2>
                <p>{state.phase === 'WIN' ? `Ending tier: ${ending.tier}` : state.lossReason}</p>
              </div>
            )}
          </div>
        </main>

        <aside className="panel right-panel">
          <div className="panel-toolbar">
            <div>
              <span className="eyebrow">Coalition Desk</span>
              <h2>{rightTab === 'actions' ? 'Intent workspace' : 'Effect trace log'}</h2>
            </div>
            <div className="segmented compact">
              <button className={rightTab === 'actions' ? 'active' : ''} onClick={() => setRightTab('actions')}>
                Actions
              </button>
              <button className={rightTab === 'log' ? 'active' : ''} onClick={() => setRightTab('log')}>
                Log
              </button>
            </div>
          </div>

          <div className="panel-body">
            {rightTab === 'actions' && focusedPlayer && (
              <section className="intent-workspace">
                <div className="seat-tabs">
                  {state.players.map((player) => (
                    <button
                      key={player.seat}
                      className={`seat-tab ${focusedPlayer.seat === player.seat ? 'active' : ''}`}
                      onClick={() => setFocusedSeat(player.seat)}
                    >
                      <strong>Seat {player.seat + 1}</strong>
                      <span>{content.roles[player.roleId].name}</span>
                    </button>
                  ))}
                </div>

                <ActionBoard
                  seat={focusedPlayer.seat}
                  state={state}
                  content={content}
                  player={focusedPlayer}
                  focused
                  onFocus={() => setFocusedSeat(focusedPlayer.seat)}
                  onCommand={onCommand}
                />
              </section>
            )}

            {rightTab === 'log' && (
              <section className="log-section">
                <div className="section-heading">
                  <h3>Effect Trace Log</h3>
                  <span className="muted">{state.eventLog.length} events</span>
                </div>
                <div className="event-log">
                  {state.eventLog
                    .slice()
                    .reverse()
                    .map((event) => (
                      <button key={event.seq} className="log-entry" onClick={() => setEventSeq(event.seq)}>
                        <span>{event.emoji}</span>
                        <div>
                          <strong>{event.message}</strong>
                          <p>{event.causedBy.join(' → ')}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            )}
          </div>
        </aside>
      </div>

      <RegionDrawer
        regionId={regionId}
        focusedSeat={focusedSeat}
        state={state}
        content={content}
        onClose={() => setRegionId(null)}
        onCommand={onCommand}
      />

      <TraceDrawer event={selectedEvent} onClose={() => setEventSeq(null)} />
      <DealModal state={state} content={content} onCommand={onCommand} />
      {showDebug && <DebugOverlay state={state} roomId={roomId} />}
    </div>
  );
}
