import { Icon } from './icons/Icon.tsx';
import type { FrontTrackRow } from './gameUiHelpers.ts';

export function FrontTrackBar({ rows }: { rows: FrontTrackRow[] }) {
  return (
    <section className="front-track-bar" aria-label="Domains">
      {rows.map((row) => (
        <article key={row.id} className={`front-track-row is-${row.severity}`.trim()} title={row.tooltip}>
          <div className="front-track-head">
            <Icon type={row.icon} size={18} title={row.label} />
            <span>{row.shortLabel}</span>
          </div>
          <div className="front-track-meter" aria-hidden="true">
            <div className="front-track-meter-fill" style={{ width: `${(row.value / row.max) * 100}%`, backgroundColor: row.color }} />
          </div>
          <strong>{row.value}/{row.max}</strong>
        </article>
      ))}
    </section>
  );
}
