import type { ReactNode } from 'react';
import type { StatusRibbonItem } from './gameUiHelpers.ts';
import { StatusPill } from './StatusPill.tsx';

export function StatusRibbon({
  items,
  utilities,
}: {
  items: StatusRibbonItem[];
  utilities?: ReactNode;
}) {
  return (
    <div className="status-ribbon" data-ui="status-ribbon">
      <div className="status-ribbon-track" role="list" aria-label="Board status ribbon">
        {items.map((item) => (
          <div key={item.id} role="listitem">
            <StatusPill item={item} />
          </div>
        ))}
      </div>
      {utilities ? <div className="status-ribbon-utilities">{utilities}</div> : null}
    </div>
  );
}
