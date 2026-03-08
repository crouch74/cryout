import { useMemo } from 'react';
import { Icon } from '../../ui/icon/Icon.tsx';
import type { FrontTrackRow } from '../presentation/gameUiHelpers.ts';
import { formatTrackFraction, t, useAppLocale } from '../../i18n/index.ts';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../../ui/primitives/index.ts';

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
        <TooltipProvider key={row.id} delayDuration={120}>
          <TooltipRoot>
            <TooltipTrigger asChild>
              <article
                className={`front-track-row front-track-domain-${row.icon} is-${row.severity} is-${row.direction} ${highlightedRows.has(row.id) || highlightedIds?.has(row.id) === true ? 'is-changing' : ''}`.trim()}
                tabIndex={0}
                aria-label={`${row.label}. ${row.tooltipNarrative} ${row.tooltipMaterial ?? ''}`.trim()}
              >
                <div className="front-track-head">
                  <Icon type={row.icon} size="md" title={row.label} />
                  <div className="front-track-head-copy">
                    <span>{row.shortLabel}</span>
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
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="top"
                align="center"
                sideOffset={18}
                collisionPadding={12}
                className="front-track-tooltip"
              >
                <strong>{row.label}</strong>
                <p>{row.tooltipNarrative}</p>
                {row.tooltipMaterial ? (
                  <div className="front-track-tooltip-section">
                    <span className="front-track-tooltip-label">{t('ui.game.trackTooltipMaterial', 'Material impact')}</span>
                    <p>{row.tooltipMaterial}</p>
                  </div>
                ) : null}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      ))}
    </section>
  );
}
