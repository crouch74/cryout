import { useEffect, useMemo, useState, useTransition } from 'react';
import type { CompiledContent, EngineState, QueuedIntent } from '../../engine/index.ts';
import { formatNumber, localizeActionField, localizeCardField, localizeDomainField, localizeRegionField, t } from '../../i18n/index.ts';
import { getTerminalStateLabel, presentHistoryEvent } from '../../game/presentation/historyPresentation.ts';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';
import {
  buildConformanceChecks,
  buildReplayTimeline,
  buildTrackCausality,
  createDefaultLegalityIntent,
  getTrackOptions,
  inspectActionLegality,
  lintNarrativeContent,
  normalizeReplayIndex,
  runProbabilitySandbox,
  summarizeReplaySelection,
  type ProbabilitySandboxReport,
} from '../analysis.ts';

export type AutoPlaySpeedLevel = 1 | 2 | 3 | 4 | 5;

interface DebugOverlayProps {
  state: EngineState;
  content: CompiledContent;
  roomId?: string | null;
  showDebugSnapshot: boolean;
  autoPlayRounds: string;
  autoPlaySpeed: AutoPlaySpeedLevel;
  autoPlayRunning: boolean;
  autoPlayStatus: string | null;
  onToggleDebugSnapshot: () => void;
  onAutoPlayRoundsChange: (value: string) => void;
  onAutoPlaySpeedChange: (value: AutoPlaySpeedLevel) => void;
  onAutoPlayStart: () => void;
  onAutoPlayStop: () => void;
  onClose: () => void;
}

const AUTO_PLAY_SPEED_OPTIONS: Array<{ value: AutoPlaySpeedLevel; label: string }> = [
  { value: 1, label: t('ui.debug.autoplaySpeed1', '1 - Slow study') },
  { value: 2, label: t('ui.debug.autoplaySpeed2', '2 - Measured') },
  { value: 3, label: t('ui.debug.autoplaySpeed3', '3 - Standard') },
  { value: 4, label: t('ui.debug.autoplaySpeed4', '4 - Quick') },
  { value: 5, label: t('ui.debug.autoplaySpeed5', '5 - Fast-forward') },
];

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function getCheckTone(status: 'pass' | 'warn' | 'fail') {
  switch (status) {
    case 'pass':
      return 'debug-chip-pass';
    case 'warn':
      return 'debug-chip-warn';
    case 'fail':
      return 'debug-chip-fail';
    default:
      return '';
  }
}

export function DebugOverlay({
  state,
  content,
  roomId,
  showDebugSnapshot,
  autoPlayRounds,
  autoPlaySpeed,
  autoPlayRunning,
  autoPlayStatus,
  onToggleDebugSnapshot,
  onAutoPlayRoundsChange,
  onAutoPlaySpeedChange,
  onAutoPlayStart,
  onAutoPlayStop,
  onClose,
}: DebugOverlayProps) {
  const [replayIndex, setReplayIndex] = useState(Math.max(0, state.commandLog.length - 1));
  const [legalitySeat, setLegalitySeat] = useState(0);
  const [legalityDraft, setLegalityDraft] = useState<Omit<QueuedIntent, 'slot'>>(
    createDefaultLegalityIntent(state, content, 0, content.ruleset.actions[0]?.id ?? 'organize'),
  );
  const [selectedTrackId, setSelectedTrackId] = useState('global_gaze');
  const [simulationRuns, setSimulationRuns] = useState('24');
  const [simulationReport, setSimulationReport] = useState<ProbabilitySandboxReport | null>(null);
  const [isSimulationPending, startSimulationTransition] = useTransition();

  const replayTimeline = useMemo(() => buildReplayTimeline(state, content), [state, content]);
  const conformanceChecks = useMemo(() => buildConformanceChecks(state, content), [state, content]);
  const trackOptions = useMemo(() => getTrackOptions(content), [content]);
  const trackCausality = useMemo(() => buildTrackCausality(state, selectedTrackId), [state, selectedTrackId]);
  const narrativeFindings = useMemo(() => lintNarrativeContent(content), [content]);
  const legalityReport = useMemo(
    () => inspectActionLegality(state, content, legalitySeat, legalityDraft),
    [state, content, legalitySeat, legalityDraft],
  );

  const selectedReplay = replayTimeline[normalizeReplayIndex(replayIndex, replayTimeline.length)];
  const replaySummary = summarizeReplaySelection(selectedReplay);
  const currentAction = content.actions[legalityDraft.actionId];
  const currentPlayer = state.players[legalitySeat];
  const filteredCards = currentPlayer
    ? currentPlayer.resistanceHand.filter((cardId) => {
      const card = content.cards[cardId];
      if (!card || card.deck !== 'resistance') {
        return false;
      }
      if (currentAction.id === 'launch_campaign') {
        return card.type === 'support';
      }
      if (currentAction.id === 'play_card') {
        return card.type === 'action';
      }
      return true;
    })
    : [];

  useEffect(() => {
    setReplayIndex((current) => normalizeReplayIndex(current, state.commandLog.length));
  }, [state.commandLog.length]);

  useEffect(() => {
    if (!trackOptions.some((option) => option.id === selectedTrackId)) {
      setSelectedTrackId(trackOptions[0]?.id ?? 'global_gaze');
    }
  }, [selectedTrackId, trackOptions]);

  useEffect(() => {
    const fallbackActionId = content.ruleset.actions[0]?.id ?? 'organize';
    if (!state.players[legalitySeat]) {
      setLegalitySeat(0);
      setLegalityDraft(createDefaultLegalityIntent(state, content, 0, fallbackActionId));
      return;
    }

    if (!content.actions[legalityDraft.actionId]) {
      setLegalityDraft(createDefaultLegalityIntent(state, content, legalitySeat, fallbackActionId));
    }
  }, [state, content, legalitySeat, legalityDraft.actionId]);

  let lastAttentionEvent = null;
  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.eventLog[index];
    if (event?.sourceId === 'public_attention') {
      lastAttentionEvent = event;
      break;
    }
  }

  const terminalStateLabel = getTerminalStateLabel(state, content);

  return (
    <aside className="debug-ledger" aria-label={t('ui.debug.devPanel', 'Development panel')}>
      <PaperSheet tone="folio">
        <div className="debug-panel-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.developerTools', 'Developer Tools')}</span>
            <h4 id="debug-panel-title">{t('ui.debug.title', 'Debug')}</h4>
          </div>
          <button type="button" className="mini-plate" onClick={onClose}>
            {t('ui.debug.closePanel', 'Close Panel')}
          </button>
        </div>

        <section className="debug-panel-section" aria-labelledby="debug-autoplay-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">{t('ui.debug.autoplayEyebrow', 'Autoplay')}</span>
              <h5 id="debug-autoplay-title">{t('ui.debug.autoplayTitle', 'Run rounds automatically')}</h5>
            </div>
            {autoPlayRunning ? <span className="engraved-eyebrow">{t('ui.debug.running', 'Running')}</span> : null}
          </div>

          <div className="debug-panel-form">
            <label className="debug-panel-field">
              <span>{t('ui.debug.autoplayRounds', 'Rounds to play')}</span>
              <input
                type="number"
                min="1"
                max="24"
                value={autoPlayRounds}
                onChange={(event) => onAutoPlayRoundsChange(event.target.value)}
                disabled={autoPlayRunning}
              />
            </label>

            <label className="debug-panel-field">
              <span>{t('ui.debug.autoplaySpeed', 'Execution speed')}</span>
              <select
                value={String(autoPlaySpeed)}
                onChange={(event) => onAutoPlaySpeedChange(Number(event.target.value) as AutoPlaySpeedLevel)}
                disabled={autoPlayRunning}
              >
                {AUTO_PLAY_SPEED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="debug-panel-actions">
            <button type="button" className="mini-plate" onClick={onAutoPlayStart} disabled={autoPlayRunning}>
              {t('ui.debug.startAutoplay', 'Start Autoplay')}
            </button>
            <button type="button" className="mini-plate mini-plate-danger" onClick={onAutoPlayStop} disabled={!autoPlayRunning}>
              {t('ui.debug.stopAutoplay', 'Stop')}
            </button>
          </div>

          <p className="debug-panel-status">
            {autoPlayStatus ?? t('ui.debug.autoplayIdle', 'Ready to run scripted rounds through the normal game flow.')}
          </p>
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-snapshot-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">{t('ui.debug.snapshot', 'Snapshot')}</span>
              <h5 id="debug-snapshot-title">{t('ui.debug.snapshotTitle', 'Engine debug snapshot')}</h5>
            </div>
            <button type="button" className="mini-plate" onClick={onToggleDebugSnapshot}>
              {showDebugSnapshot ? t('ui.game.hideDebug', 'Hide Debug') : t('ui.game.showDebug', 'Show Debug')}
            </button>
          </div>

          {showDebugSnapshot ? (
            <div className="ledger-list">
              <div className="ledger-row"><span>{t('ui.debug.round', 'Round')}</span><strong>{formatNumber(state.round)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.phase', 'Phase')}</span><strong>{t(`ui.phases.${state.phase}`, state.phase)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.seed', 'Seed')}</span><strong>{state.seed}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.rngCalls', 'RNG Calls')}</span><strong>{formatNumber(state.rng.calls)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.extractionPool', 'Extraction Pool')}</span><strong>{formatNumber(state.extractionPool)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.gaze', 'Global Gaze')}</span><strong>{formatNumber(state.globalGaze)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.warMachine', 'War Machine')}</span><strong>{formatNumber(state.northernWarMachine)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.activeBeacons', 'Active Beacons')}</span><strong>{state.activeBeaconIds.length || t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.systemCards', 'Last system cards')}</span><strong>{state.lastSystemCardIds.join(', ') || t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.attentionFeed', 'Attention feed')}</span><strong>{lastAttentionEvent ? presentHistoryEvent(lastAttentionEvent, content).title : t('ui.debug.none', 'none')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.commandLog', 'Command log')}</span><strong>{formatNumber(state.commandLog.length)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.eventLog', 'Event log')}</span><strong>{formatNumber(state.eventLog.length)}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.winner', 'Winner')}</span><strong>{state.phase === 'WIN' ? (terminalStateLabel ?? t('ui.debug.na', 'n/a')) : t('ui.debug.na', 'n/a')}</strong></div>
              <div className="ledger-row"><span>{t('ui.debug.lossReason', 'Loss reason')}</span><strong>{state.phase === 'LOSS' ? (terminalStateLabel ?? t('ui.debug.na', 'n/a')) : t('ui.debug.na', 'n/a')}</strong></div>
              {roomId ? <div className="ledger-row"><span>{t('ui.debug.room', 'Room')}</span><strong>{roomId}</strong></div> : null}
            </div>
          ) : null}
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-replay-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Replay</span>
              <h5 id="debug-replay-title">Time-travel inspector</h5>
            </div>
            <span className="debug-chip">{replayTimeline.length} states</span>
          </div>

          <label className="debug-panel-field">
            <span>Command step</span>
            <input
              type="range"
              min="0"
              max={String(Math.max(0, replayTimeline.length - 1))}
              value={String(normalizeReplayIndex(replayIndex, replayTimeline.length))}
              onChange={(event) => setReplayIndex(Number(event.target.value))}
            />
          </label>

          <div className="debug-command-list">
            {replayTimeline.map((entry) => (
              <button
                key={`${entry.commandIndex}:${entry.label}`}
                type="button"
                className={`mini-plate debug-command-chip ${entry.commandIndex === normalizeReplayIndex(replayIndex, replayTimeline.length) ? 'is-active' : ''}`.trim()}
                onClick={() => setReplayIndex(entry.commandIndex)}
              >
                <strong>{entry.commandIndex}</strong>
                <span>{entry.label}</span>
              </button>
            ))}
          </div>

          {selectedReplay && replaySummary ? (
            <>
              <div className="ledger-list">
                <div className="ledger-row"><span>Round</span><strong>{formatNumber(replaySummary.round)}</strong></div>
                <div className="ledger-row"><span>Phase</span><strong>{replaySummary.phase}</strong></div>
                <div className="ledger-row"><span>Global Gaze</span><strong>{formatNumber(replaySummary.globalGaze)}</strong></div>
                <div className="ledger-row"><span>War Machine</span><strong>{formatNumber(replaySummary.warMachine)}</strong></div>
                <div className="ledger-row"><span>Extraction Pool</span><strong>{formatNumber(replaySummary.extractionPool)}</strong></div>
              </div>

              <div className="debug-subsection">
                <span className="engraved-eyebrow">State Diff</span>
                {selectedReplay.changes.length > 0 ? (
                  <div className="debug-data-list">
                    {selectedReplay.changes.map((change) => (
                      <div key={`${change.label}:${change.before}:${change.after}`} className="debug-data-card">
                        <strong>{change.label}</strong>
                        <span>{change.before} → {change.after}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="debug-panel-status">No tracked state deltas at this step.</p>
                )}
              </div>

              <div className="debug-subsection">
                <span className="engraved-eyebrow">Emitted Events</span>
                {selectedReplay.events.length > 0 ? (
                  <div className="debug-scroll-list">
                    {selectedReplay.events.map((event) => (
                      <article key={`${event.seq}:${event.sourceId}`} className="debug-event-card">
                        <div className="debug-event-header">
                          <strong>{event.emoji} {event.sourceType}:{event.sourceId}</strong>
                          <span>R{event.round} {event.phase}</span>
                        </div>
                        <p>{event.message}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="debug-panel-status">No new events were emitted for this command.</p>
                )}
              </div>
            </>
          ) : null}
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-conformance-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Conformance</span>
              <h5 id="debug-conformance-title">Scenario dashboard</h5>
            </div>
          </div>

          <div className="debug-scroll-list">
            {conformanceChecks.map((check) => (
              <article key={check.id} className="debug-event-card">
                <div className="debug-event-header">
                  <strong>{check.label}</strong>
                  <span className={`debug-chip ${getCheckTone(check.status)}`.trim()}>{check.status}</span>
                </div>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-legality-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Legality</span>
              <h5 id="debug-legality-title">Action legality explorer</h5>
            </div>
            <span className={`debug-chip ${legalityReport.legal ? 'debug-chip-pass' : 'debug-chip-fail'}`.trim()}>
              {legalityReport.legal ? 'legal' : 'blocked'}
            </span>
          </div>

          <div className="debug-panel-form">
            <label className="debug-panel-field">
              <span>Seat</span>
              <select
                value={String(legalitySeat)}
                onChange={(event) => {
                  const nextSeat = Number(event.target.value);
                  const nextActionId = legalityDraft.actionId;
                  setLegalitySeat(nextSeat);
                  setLegalityDraft(createDefaultLegalityIntent(state, content, nextSeat, nextActionId));
                }}
              >
                {state.players.map((player) => (
                  <option key={player.seat} value={player.seat}>
                    Seat {player.seat + 1}
                  </option>
                ))}
              </select>
            </label>

            <label className="debug-panel-field">
              <span>Action</span>
              <select
                value={legalityDraft.actionId}
                onChange={(event) => {
                  const nextActionId = event.target.value as typeof legalityDraft.actionId;
                  setLegalityDraft(createDefaultLegalityIntent(state, content, legalitySeat, nextActionId));
                }}
              >
                {content.ruleset.actions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {localizeActionField(action.id, 'name', action.name)}
                  </option>
                ))}
              </select>
            </label>

            {currentAction.needsRegion ? (
              <label className="debug-panel-field">
                <span>Region</span>
                <select
                  value={legalityDraft.regionId ?? ''}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, regionId: event.target.value as typeof current.regionId }))}
                >
                  {content.ruleset.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {localizeRegionField(region.id, 'name', region.name)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {currentAction.needsDomain ? (
              <label className="debug-panel-field">
                <span>Domain</span>
                <select
                  value={legalityDraft.domainId ?? ''}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, domainId: event.target.value as typeof current.domainId }))}
                >
                  {content.ruleset.domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {localizeDomainField(domain.id, 'name', domain.name)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {currentAction.needsTargetSeat ? (
              <label className="debug-panel-field">
                <span>Target seat</span>
                <select
                  value={String(legalityDraft.targetSeat ?? '')}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, targetSeat: Number(event.target.value) }))}
                >
                  {state.players.filter((player) => player.seat !== legalitySeat).map((player) => (
                    <option key={player.seat} value={player.seat}>
                      Seat {player.seat + 1}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {currentAction.needsComrades ? (
              <label className="debug-panel-field">
                <span>Committed Comrades</span>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={String(legalityDraft.comradesCommitted ?? 1)}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, comradesCommitted: Number(event.target.value) }))}
                />
              </label>
            ) : null}

            {currentAction.needsEvidence ? (
              <label className="debug-panel-field">
                <span>Committed Evidence</span>
                <input
                  type="number"
                  min="0"
                  max="8"
                  value={String(legalityDraft.evidenceCommitted ?? 0)}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, evidenceCommitted: Number(event.target.value) }))}
                />
              </label>
            ) : null}

            {currentAction.needsCard || currentAction.id === 'launch_campaign' ? (
              <label className="debug-panel-field">
                <span>Card</span>
                <select
                  value={legalityDraft.cardId ?? ''}
                  onChange={(event) => setLegalityDraft((current) => ({ ...current, cardId: event.target.value || undefined }))}
                >
                  <option value="">No card</option>
                  {filteredCards.map((cardId) => {
                    const card = content.cards[cardId];
                    return (
                      <option key={cardId} value={cardId}>
                        {localizeCardField(cardId, 'name', card?.name ?? cardId)}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
          </div>

          <p className="debug-panel-status">{legalityReport.reason}</p>

          <div className="debug-subsection">
            <span className="engraved-eyebrow">Costs & Effects</span>
            {legalityReport.costs.length > 0 ? (
              <div className="debug-data-list">
                {legalityReport.costs.map((cost) => (
                  <div key={`${cost.label}:${cost.amount}:${cost.type}`} className="debug-data-card">
                    <strong>{cost.label}</strong>
                    <span>{cost.type === 'effect' ? '+' : ''}{formatNumber(cost.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="debug-panel-status">No explicit spend or payload effect captured for this action.</p>
            )}
          </div>

          <div className="debug-subsection">
            <span className="engraved-eyebrow">Modifiers</span>
            {legalityReport.modifiers.length > 0 ? (
              <div className="debug-data-list">
                {legalityReport.modifiers.map((modifier) => (
                  <div key={`${modifier.label}:${modifier.value}`} className="debug-data-card">
                    <strong>{modifier.label}</strong>
                    <span>{formatSignedNumber(modifier.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="debug-panel-status">No dynamic modifiers apply to the current draft.</p>
            )}
            {legalityReport.projectedCampaignTotal !== undefined && legalityReport.projectedCampaignTarget !== undefined ? (
              <p className="debug-panel-status">
                Projected Launch Campaign line: 7 + modifiers = {legalityReport.projectedCampaignTotal} against {legalityReport.projectedCampaignTarget}+.
              </p>
            ) : null}
            {legalityReport.notes.map((note) => (
              <p key={note} className="debug-panel-status">{note}</p>
            ))}
          </div>
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-causality-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Causality</span>
              <h5 id="debug-causality-title">Track event history</h5>
            </div>
          </div>

          <label className="debug-panel-field">
            <span>Track</span>
            <select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}>
              {trackOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {trackCausality.length > 0 ? (
            <div className="debug-scroll-list">
              {trackCausality.map((entry) => (
                <article key={`${entry.eventSeq}:${entry.sourceLabel}`} className="debug-event-card">
                  <div className="debug-event-header">
                    <strong>{entry.emoji} {entry.sourceLabel}</strong>
                    <span>R{entry.round} {entry.phase}</span>
                  </div>
                  <p>{entry.before} → {entry.after}</p>
                  <p className="debug-panel-status">{entry.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="debug-panel-status">No deltas for this track in the current log.</p>
          )}
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-lint-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Narrative Lint</span>
              <h5 id="debug-lint-title">Framing and terminology audit</h5>
            </div>
            <span className={`debug-chip ${narrativeFindings.length === 0 ? 'debug-chip-pass' : 'debug-chip-warn'}`.trim()}>
              {narrativeFindings.length === 0 ? 'clean' : `${narrativeFindings.length} findings`}
            </span>
          </div>

          {narrativeFindings.length > 0 ? (
            <div className="debug-scroll-list">
              {narrativeFindings.map((finding) => (
                <article key={finding.id} className="debug-event-card">
                  <div className="debug-event-header">
                    <strong>{finding.area}</strong>
                    <span className={`debug-chip ${finding.severity === 'error' ? 'debug-chip-fail' : 'debug-chip-warn'}`.trim()}>
                      {finding.severity}
                    </span>
                  </div>
                  <p>{finding.detail}</p>
                  <p className="debug-panel-status">{finding.excerpt}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="debug-panel-status">No banned framing or canonical terminology drift found in the current ruleset copy.</p>
          )}
        </section>

        <section className="debug-panel-section" aria-labelledby="debug-probability-title">
          <div className="debug-panel-section-header">
            <div>
              <span className="engraved-eyebrow">Probability</span>
              <h5 id="debug-probability-title">Deck and outcome sandbox</h5>
            </div>
          </div>

          <div className="debug-panel-form">
            <label className="debug-panel-field">
              <span>Simulations</span>
              <input
                type="number"
                min="1"
                max="200"
                value={simulationRuns}
                onChange={(event) => setSimulationRuns(event.target.value)}
              />
            </label>

            <div className="debug-panel-field">
              <span>Run sandbox</span>
              <button
                type="button"
                className="mini-plate"
                disabled={isSimulationPending}
                onClick={() => {
                  const parsedRuns = Number.parseInt(simulationRuns, 10);
                  const safeRuns = Number.isFinite(parsedRuns) ? Math.max(1, Math.min(200, parsedRuns)) : 24;
                  setSimulationRuns(String(safeRuns));
                  startSimulationTransition(() => {
                    setSimulationReport(runProbabilitySandbox(state, safeRuns));
                  });
                }}
              >
                {isSimulationPending ? 'Running...' : 'Simulate'}
              </button>
            </div>
          </div>

          {simulationReport ? (
            <>
              <div className="ledger-list">
                <div className="ledger-row"><span>Runs</span><strong>{formatNumber(simulationReport.simulations)}</strong></div>
                <div className="ledger-row"><span>Win rate</span><strong>{simulationReport.winRate}%</strong></div>
                <div className="ledger-row"><span>Average terminal round</span><strong>{simulationReport.averageTerminalRound}</strong></div>
                <div className="ledger-row"><span>Wins / Losses</span><strong>{simulationReport.wins} / {simulationReport.losses}</strong></div>
              </div>

              <div className="debug-subsection">
                <span className="engraved-eyebrow">Top Outcomes</span>
                <div className="debug-data-list">
                  {simulationReport.topOutcomes.map((outcome) => (
                    <div key={outcome.label} className="debug-data-card">
                      <strong>{outcome.label}</strong>
                      <span>{formatNumber(outcome.count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="debug-subsection">
                <span className="engraved-eyebrow">Extraction Hotspots</span>
                <div className="debug-data-list">
                  {simulationReport.extractionHotspots.map((region) => (
                    <div key={region.regionId} className="debug-data-card">
                      <strong>{localizeRegionField(region.regionId, 'name', content.regions[region.regionId]?.name ?? region.regionId)}</strong>
                      <span>{region.averagePeakExtraction}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="debug-subsection">
                <span className="engraved-eyebrow">Final Track Averages</span>
                <div className="debug-data-list">
                  {simulationReport.trackAverages.map((track) => (
                    <div key={track.id} className="debug-data-card">
                      <strong>{track.label}</strong>
                      <span>{track.averageFinalValue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="debug-panel-status">Run a seeded Monte Carlo pass from the opening command to profile defeat causes, extraction pressure, and track drift.</p>
          )}
        </section>
      </PaperSheet>
    </aside>
  );
}
