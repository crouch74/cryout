import { useMemo, type CSSProperties } from 'react';
import { Icon } from './icons/Icon.tsx';
import type { FrontTrackRow } from './gameUiHelpers.ts';
import { formatTrackFraction, t, useAppLocale } from '../i18n/index.ts';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';

export function FrontTrackBar({ rows, highlightedIds }: { rows: FrontTrackRow[]; highlightedIds?: ReadonlySet<string> }) {
  const { dir } = useAppLocale();
  const rowSignatures = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.value])),
    [rows],
  );
  const highlightedRows = useTransientHighlightKeys(rowSignatures, 1800);

  return (
    <section className="front-track-bar" aria-label={t('ui.game.domains', 'Domains')}>
      {rows.map((row) => (
        <article
          key={row.id}
          className={`front-track-row is-${row.severity} ${highlightedRows.has(row.id) || highlightedIds?.has(row.id) === true ? 'is-changing' : ''}`.trim()}
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
          <strong dir={dir}>{formatTrackFraction(row.value, row.max)}</strong>
        </article>
      ))}
    </section>
  );
}
