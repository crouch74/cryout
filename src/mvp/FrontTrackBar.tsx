import type { CSSProperties } from 'react';
import { Icon } from './icons/Icon.tsx';
import type { FrontTrackRow } from './gameUiHelpers.ts';
import { formatNumber, t } from '../i18n/index.ts';

export function FrontTrackBar({ rows }: { rows: FrontTrackRow[] }) {
  return (
    <section className="front-track-bar" aria-label={t('ui.game.domains', 'Domains')}>
      {rows.map((row) => (
        <article
          key={row.id}
          className={`front-track-row is-${row.severity}`.trim()}
          title={row.tooltip}
          style={{ ['--track-color' as string]: row.color } as CSSProperties}
        >
          <div className="front-track-head">
            <Icon type={row.icon} size={18} title={row.label} />
            <span>{row.shortLabel}</span>
          </div>
          <div className="front-track-meter" aria-hidden="true">
            <div className="front-track-pips">
              {Array.from({ length: row.max }, (_, index) => (
                <span key={`${row.id}-${index}`} className={index < row.value ? 'is-filled' : ''} />
              ))}
            </div>
            <span className="front-track-marker" style={{ ['--track-progress' as string]: `${(row.value / row.max) * 100}%` }} />
          </div>
          <strong>{formatNumber(row.value)}/{formatNumber(row.max)}</strong>
        </article>
      ))}
    </section>
  );
}
