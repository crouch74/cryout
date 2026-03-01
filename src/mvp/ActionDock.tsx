import type { ReactNode } from 'react';
import type { ActionDockItem } from './gameUiHelpers.ts';
import { ActionDockButton } from './ActionDockButton.tsx';

export function ActionDock({
  items,
  onAction,
  controls,
}: {
  items: ActionDockItem[];
  onAction: (actionId: ActionDockItem['actionId']) => void;
  controls?: ReactNode;
}) {
  return (
    <section className="action-dock" data-ui="action-dock">
      <div className="action-dock-grid">
        {items.map((item) => (
          <ActionDockButton key={item.actionId} item={item} onClick={() => onAction(item.actionId)} />
        ))}
      </div>
      {controls ? <div className="action-dock-controls">{controls}</div> : null}
    </section>
  );
}
