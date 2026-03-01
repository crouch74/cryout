import { Icon } from './icons/Icon.tsx';
import type { PlayerStripSummary } from './gameUiHelpers.ts';

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
    <section className="player-strip" aria-label="Focused player strip">
      <div className="player-strip-seats">
        {summaries.map((summary) => (
          <button
            key={summary.seat}
            type="button"
            className={`player-seat-chip ${summary.seat === focusedSeat ? 'is-active' : ''}`.trim()}
            onClick={() => onSelectSeat(summary.seat)}
          >
            <Icon type="seat" size={16} title={`Seat ${summary.seat + 1}`} />
            <span>S{summary.seat + 1}</span>
            <strong>{summary.shortName}</strong>
          </button>
        ))}
      </div>

      <div className="player-strip-focus">
        <div className="player-strip-identity">
          <strong title={active.factionName}>{active.shortName}</strong>
          <span>{active.homeRegion}</span>
        </div>
        <div className="player-strip-metrics">
          <span><Icon type="bodies" size={16} title="Bodies" /> {active.bodies}</span>
          <span><Icon type="evidence" size={16} title="Evidence" /> {active.evidence}</span>
          <span><Icon type="objective" size={16} title="Moves" /> {active.moves}</span>
        </div>
        <div className="player-strip-passive">
          <span>{active.passivePrimary}</span>
          <span>{active.passiveSecondary}</span>
        </div>
        <div className="player-strip-mandate">
          <strong>{active.mandateTitle}</strong>
          <span>{active.mandateLines[0]}</span>
          <span>{active.mandateLines[1]}</span>
        </div>
      </div>
    </section>
  );
}
