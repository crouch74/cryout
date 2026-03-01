import { useMemo, useState } from 'react';
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
import { FrontTrackBar } from './FrontTrackBar.tsx';
import { PlayerStrip } from './PlayerStrip.tsx';
import { StatusRibbon } from './StatusRibbon.tsx';
import {
  buildIntentPreview,
  getActionDockItems,
  getActionQuickQueue,
  getFrontTrackRows,
  getPhasePresentation,
  getPlayerStripSummary,
  getStatusRibbonItems,
  type ContextPanelMode,
} from './gameUiHelpers.ts';
import { LocaleSwitcher, TableSurface, ThemePlate } from './tabletop.tsx';
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
  authorizedSeat,
}: GameScreenProps) {
  const focusedSeat = authorizedSeat ?? viewState.focusedSeat;
  const focusedPlayer = state.players[focusedSeat] ?? state.players[0];
  const faction = getSeatFaction(state, content, focusedPlayer.seat);
  const [copied, setCopied] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextMode, setContextMode] = useState<ContextPanelMode>('ledger');
  const [draft, setDraft] = useState<DraftState>(() => createDraft('organize'));
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
  const selectedRegion = selectedRegionId ? state.regions[selectedRegionId] : null;

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

  const regionBodies = selectedRegion
    ? state.players.reduce((sum, player) => sum + (selectedRegion.bodiesPresent[player.seat] ?? 0), 0)
    : 0;
  const roleActions = getSeatActions(content).filter((action) => action.needsRegion);

  const regionContent = null;

  const selectedRegionPopup = selectedRegionId && selectedRegion ? (
    <div className="selected-region-popup-sheet">
      <span className="context-eyebrow">Region</span>
      <strong>{localizeRegionField(selectedRegionId, 'name', content.regions[selectedRegionId].name)}</strong>
      <p>{localizeRegionField(selectedRegionId, 'strapline', content.regions[selectedRegionId].strapline)}</p>
      <div className="selected-region-popup-metrics">
        <span>Extraction {selectedRegion.extractionTokens}</span>
        <span>Defense {selectedRegion.defenseRating}</span>
        <span>Bodies {regionBodies}</span>
      </div>
      <div className="selected-region-popup-fronts">
        {Object.entries(selectedRegion.vulnerability)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 3)
          .map(([domainId, value]) => (
            <span key={domainId}>
              {localizeDomainField(domainId as DomainId, 'name', content.domains[domainId as DomainId].name)} {value}
            </span>
          ))}
      </div>
      <div className="selected-region-popup-actions">
        {roleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="context-action-chip"
            onClick={() => {
              setDraft((current) => ({
                ...createDraft(action.id),
                ...current,
                actionId: action.id,
                regionId: selectedRegionId,
              }));
              setContextMode('action');
              setContextOpen(true);
            }}
          >
            {localizeActionField(action.id, 'name', action.name)}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const actionContent = (
    <div className="context-stack">
      <section className="context-card">
        <span className="context-eyebrow">Configure action</span>
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
      </section>

      <section className="context-card">
        <span className="context-eyebrow">Projected effect</span>
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

  return (
    <TableSurface className="game-screen game-screen-compressed">
      <header className="game-header-shell">
        <div className="table-utility-bar">
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
          <ThemePlate
            label={surface === 'room' && roomId
              ? t('ui.game.room', 'Room {{roomId}}', { roomId })
              : 'Table'}
            onClick={() => {}}
          />
          <ThemePlate
            label={copied ? 'Saved' : 'Save'}
            onClick={() => {
              onExportSave(serializeGame(state));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
          />
          <ThemePlate label="Home" onClick={onBack} />
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
              Ledger
            </button>
          </div>

          <StatusRibbon items={statusItems} />

          <div className="board-map-panel">
            <WorldMapBoard
              state={state}
              content={content}
              selectedRegionId={selectedRegionId}
              onSelectRegion={(regionId) => {
                onViewStateChange({ regionId });
              }}
              onClearSelection={() => onViewStateChange({ regionId: null })}
              selectedRegionPopup={selectedRegionPopup}
            />
          </div>

          <FrontTrackBar rows={frontRows} />
        </section>

        <section className="board-player-strip">
          <PlayerStrip
            summaries={playerSummaries}
            focusedSeat={focusedPlayer.seat}
            onSelectSeat={(seat) => onViewStateChange({ focusedSeat: seat })}
          />
        </section>

        <aside className="board-context-slot" aria-label="Board context">
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
            ledgerContent={ledgerContent}
          />
        </aside>
      </main>

      <footer className="game-console">
        <ActionDock
          items={actionItems}
          onAction={openActionPanel}
          controls={(
            <>
              <div className="dock-queue-summary">
                <strong>{localizeFactionField(faction.id, 'shortName', faction.shortName)}</strong>
                <span>{getPlayerBodyTotal(state, focusedPlayer.seat)} Bodies</span>
                <span>{focusedPlayer.evidence} Evidence</span>
                <span>{focusedPlayer.queuedIntents.length} queued</span>
              </div>
              <div className="dock-queue-list" aria-label="Prepared moves">
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
              <div className="dock-phase-controls">
                {state.phase === 'COALITION' ? (
                  <button
                    type="button"
                    className={`dock-control-button ${focusedPlayer.ready ? 'is-active' : ''}`.trim()}
                    disabled={focusedPlayer.actionsRemaining > 0}
                    onClick={() => void onCommand({ type: 'SetReady', seat: focusedPlayer.seat, ready: !focusedPlayer.ready })}
                  >
                    {focusedPlayer.ready ? t('ui.game.seatReady', 'Seat Ready') : t('ui.game.markSeatReady', 'Mark Seat Ready')}
                  </button>
                ) : null}
                <button type="button" className="dock-control-button is-primary" disabled={phaseActionDisabled} onClick={runPhaseAction}>
                  {getActionButtonLabel(state.phase)}
                </button>
              </div>
            </>
          )}
        />
      </footer>
    </TableSurface>
  );
}
