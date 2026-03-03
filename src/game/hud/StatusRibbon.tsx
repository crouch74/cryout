import { useMemo, type ReactNode } from 'react';
import type { StatusRibbonItem } from '../presentation/gameUiHelpers.ts';
import { StatusPill } from './StatusPill.tsx';
import { t } from '../../i18n/index.ts';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';

export function StatusRibbon({
  items,
  highlightedIds,
  suspendHighlights = false,
  utilities,
}: {
  items: StatusRibbonItem[];
  highlightedIds?: ReadonlySet<string>;
  suspendHighlights?: boolean;
  utilities?: ReactNode;
}) {
  const itemSignatures = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item.value])),
    [items],
  );
  const highlightedItems = useTransientHighlightKeys(itemSignatures, 2800, suspendHighlights);

  return (
    <div className="status-ribbon" data-ui="status-ribbon">
      <div className="status-ribbon-track" role="list" aria-label={t('ui.game.boardStatusRibbon', 'Board status ribbon')}>
        {items.map((item) => (
          <div key={item.id} role="listitem">
            <StatusPill item={item} isChanging={highlightedItems.has(item.id) || highlightedIds?.has(item.id) === true} />
          </div>
        ))}
      </div>
      {utilities ? <div className="status-ribbon-utilities">{utilities}</div> : null}
    </div>
  );
}
