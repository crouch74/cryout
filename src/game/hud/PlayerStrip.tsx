import { Icon } from '../../ui/icon/Icon.tsx';
import type { PlayerStripSummary } from '../presentation/gameUiHelpers.ts';
import { formatNumber, t } from '../../i18n/index.ts';

export function PlayerStrip({
  summaries,
  focusedSeat,
  onSelectSeat,
}: {
  summaries: PlayerStripSummary[];
  focusedSeat: number;
  onSelectSeat: (seat: number) => void;
}) {
  const active = summaries.find((summary) => summary.seat === focusedSeat) ?? summaries[0];

  return (
    <section className="player-strip" aria-label={t('ui.game.focusedPlayerStrip', 'Focused player strip')}>
      <div className="player-strip-seats">
        {summaries.map((summary) => (
          <button
            key={summary.seat}
            type="button"
            className={`player-seat-chip player-seat-chip-${summary.seat + 1} ${summary.seat === focusedSeat ? 'is-active' : ''}`.trim()}
            onClick={() => onSelectSeat(summary.seat)}
          >
            <div className="seat-chip-frame">
              <Icon type="seat" size="sm" title={t('ui.game.seat', 'Seat {{seat}}', { seat: summary.seat + 1 })} />
              <div className="seat-chip-info">
                <span className="seat-chip-label">{t('ui.game.focusSeatAbbrev', 'S{{seat}}', { seat: summary.seat + 1 })}</span>
                <strong className="seat-chip-name">{summary.shortName}</strong>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="player-strip-focus">
        <div className="player-strip-identity">
          <strong title={active.factionName}>{active.shortName}</strong>
          <span>{active.homeRegion}</span>
        </div>
        <div className="player-strip-metrics">
          <span><Icon type="bodies" size="sm" title={t('ui.game.bodies', 'Comrades')} /> {formatNumber(active.bodies)}</span>
          <span><Icon type="evidence" size="sm" title={t('ui.game.evidence', 'Evidence')} /> {formatNumber(active.evidence)}</span>
          <span><Icon type="objective" size="sm" title={t('ui.game.moves', 'Moves')} /> {formatNumber(active.moves)}</span>
        </div>
        <div className="player-strip-passive">
          <span>{active.passivePrimary}</span>
          <span>{active.passiveSecondary}</span>
        </div>
        <div className="player-strip-mandate">
          <span className="engraved-eyebrow">{active.detailEyebrow}</span>
          <strong>{active.detailTitle}</strong>
          <span>{active.detailLines[0]}</span>
          <span>{active.detailLines[1]}</span>
        </div>
      </div>
    </section>
  );
}
