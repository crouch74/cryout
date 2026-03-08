import { useMemo } from 'react';
import { Icon } from '../../ui/icon/Icon.tsx';
import type { FrontTrackRow } from '../presentation/gameUiHelpers.ts';
import { formatTrackFraction, t, useAppLocale } from '../../i18n/index.ts';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';

export function FrontTrackBar({
  rows,
  highlightedIds,
  suspendHighlights = false,
}: {
  rows: FrontTrackRow[];
  highlightedIds?: ReadonlySet<string>;
  suspendHighlights?: boolean;
}) {
  const { dir } = useAppLocale();
  const rowSignatures = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.value])),
    [rows],
  );
  const highlightedRows = useTransientHighlightKeys(rowSignatures, 2800, suspendHighlights);

  return (
    <section className="front-track-bar" aria-label={t('ui.game.trackBar', 'Movement and pressure tracks')}>
      {rows.map((row) => (
        <article
          key={row.id}
          className={`front-track-row front-track-domain-${row.icon} is-${row.severity} is-${row.direction} ${highlightedRows.has(row.id) || highlightedIds?.has(row.id) === true ? 'is-changing' : ''}`.trim()}
          title={row.tooltip}
        >
          <div className="front-track-head">
            <Icon type={row.icon} size="md" title={row.label} />
            <div className="front-track-head-copy">
              <span>{row.shortLabel}</span>
              <small>
                {row.direction === 'higher_is_worse'
                  ? t('ui.game.trackDirectionChipHigherWorse', 'Higher = pressure')
                  : t('ui.game.trackDirectionChipHigherBetter', 'Higher = leverage')}
              </small>
            </div>
          </div>
          <div className="front-track-meter" aria-hidden="true">
            <div className="front-track-pips">
              {Array.from({ length: row.max }, (_, index) => (
                <span key={`${row.id}-${index}`} className={index < row.value ? 'is-filled' : ''} />
              ))}
            </div>
          </div>
          <strong dir={dir}>{formatTrackFraction(row.value, row.max)}</strong>
        </article>
      ))}
    </section>
  );
}
