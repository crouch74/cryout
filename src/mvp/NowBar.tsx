import { type EngineCommand, type EngineState, getTemperatureBand } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { ActionCard, PaperSheet, PaperTooltip, WaxSealLock } from './tabletop.tsx';

interface NowBarProps {
  state: EngineState;
  onCommand: (command: EngineCommand) => void;
  worldPhaseSelected: boolean;
  setWorldPhaseSelected: (selected: boolean) => void;
}

function getPhaseDetails(state: EngineState) {
  switch (state.phase) {
    case 'WORLD': {
      const band = getTemperatureBand(state.temperature);
      const staged = state.stagedWorldPhase.status === 'drawn';
      return {
        title: t('ui.game.chairsDocket', "Chair's Docket"),
        lead: staged
          ? t('ui.game.adoptResolutionLead', 'Cards are on the table. Review the crisis slot, then adopt the resolution.')
          : t('ui.game.drawResolutionLead', 'Open the crisis deck, reveal the current draw, and place the active card on the board.'),
        support: t(
          'ui.game.temperatureDetail',
          'Band {{band}}. {{count}} crisis card{{plural}} on the next world resolution.',
          {
            band: band.band,
            count: band.crisisCount,
            plural: band.crisisCount === 1 ? '' : 's',
          },
        ),
        blockers: staged
          ? null
          : t('ui.now.worldBlockers', 'Adoption remains sealed until the deck has been drawn.'),
      };
    }
    case 'COALITION': {
      const unreadySeats = state.players.filter((player) => !player.ready).map((player) => `Seat ${player.seat + 1}`);
      return {
        title: t('ui.game.chairsDocket', "Chair's Docket"),
        lead: t('ui.now.coalitionAction', 'Lay out planned moves on the player mats, then place every commit marker.'),
        support:
          unreadySeats.length > 0
            ? t('ui.now.coalitionChoices', 'Still arranging: {{seats}}.', { seats: unreadySeats.join(', ') })
            : t('ui.now.coalitionReady', 'The table is ready to resolve the planned moves.'),
        blockers:
          unreadySeats.length > 0
            ? t('ui.now.coalitionBlockers', 'Commit remains sealed until every seat has placed its marker.')
            : null,
      };
    }
    case 'COMPROMISE':
      return {
        title: t('ui.game.chairsDocket', "Chair's Docket"),
        lead: t('ui.now.compromiseAction', 'A compromise slip is on the table. Record each vote to proceed.'),
        support: t('ui.now.compromiseChoices', 'Open the offer and resolve the ballot.'),
        blockers: t('ui.now.compromiseBlockers', 'The round cannot advance while the compromise is unsettled.'),
      };
    case 'END':
      return {
        title: t('ui.game.chairsDocket', "Chair's Docket"),
        lead: t('ui.now.endAction', 'Close the minute book, advance delayed effects, and begin the next round.'),
        support: t('ui.now.endChoices', 'The table is ready for the end-of-round resolution.'),
        blockers: null,
      };
    case 'WIN':
    case 'LOSS':
      return {
        title: t('ui.game.chairsDocket', "Chair's Docket"),
        lead: t('ui.now.gameOverAction', 'Review the record, the charter outcome, and the surviving institutions.'),
        support: t('ui.now.gameOverChoices', 'Export the table state if you want to keep this sitting.'),
        blockers: null,
      };
  }
}

export function NowBar({ state, onCommand, worldPhaseSelected, setWorldPhaseSelected }: NowBarProps) {
  const details = getPhaseDetails(state);
  const worldCardsDrawn = state.stagedWorldPhase.status === 'drawn';
  const everyoneReady = state.players.every((player) => player.ready);

  return (
    <PaperSheet tone="note" className="chairs-docket" aria-labelledby="chairs-docket-title">
      <div className="chairs-docket-copy">
        <span className="engraved-eyebrow">{t('ui.now.phase', 'Phase')}</span>
        <h2 id="chairs-docket-title">{details.title}</h2>
        <p>{details.lead}</p>
        <p>{details.support}</p>
        {details.blockers ? <PaperTooltip label={details.blockers} /> : null}
      </div>

      <div className="chairs-docket-actions">
        {state.phase === 'WORLD' ? (
          <>
            <ActionCard
              className={worldCardsDrawn ? 'is-selected' : ''}
              onClick={() => {
                setWorldPhaseSelected(true);
                onCommand({ type: 'DrawWorldCards' });
              }}
              disabled={worldCardsDrawn}
            >
              <span className="engraved-eyebrow">Step 1</span>
              <strong>{t('ui.game.drawWorldCards', 'Draw World Cards')}</strong>
              <span>{t('ui.game.crisisDeck', 'Reveal capture and crisis cards')}</span>
            </ActionCard>
            <ActionCard
              onClick={() => onCommand({ type: 'AdoptResolution' })}
              disabled={!worldCardsDrawn}
            >
              <span className="engraved-eyebrow">Step 2</span>
              <strong>{t('ui.game.adoptResolution', 'Adopt Resolution')}</strong>
              {!worldCardsDrawn || !worldPhaseSelected ? <WaxSealLock label={t('ui.game.sealed', 'Sealed')} /> : null}
            </ActionCard>
          </>
        ) : null}

        {state.phase === 'COALITION' ? (
          <ActionCard disabled={!everyoneReady} onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}>
            <span className="engraved-eyebrow">{t('ui.game.plannedMoves', 'Planned Moves')}</span>
            <strong>{t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent')}</strong>
            {!everyoneReady ? <WaxSealLock label={t('ui.game.sealed', 'Sealed')} /> : null}
          </ActionCard>
        ) : null}

        {state.phase === 'END' ? (
          <ActionCard onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
            <span className="engraved-eyebrow">{t('ui.phases.END', 'End')}</span>
            <strong>{t('ui.game.closeRound', 'Close Round')}</strong>
          </ActionCard>
        ) : null}
      </div>
    </PaperSheet>
  );
}
