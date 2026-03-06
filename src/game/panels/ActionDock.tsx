import type { CSSProperties, ReactNode } from 'react';
import type { ActionDockItem } from '../presentation/gameUiHelpers.ts';
import { ActionDockButton } from './ActionDockButton.tsx';

export function ActionDock({
  items,
  onAction,
  controls,
  accentColor,
}: {
  items: ActionDockItem[];
  onAction: (actionId: ActionDockItem['actionId']) => void;
  controls?: ReactNode;
  accentColor?: string;
}) {
  const style = accentColor
    ? ({ ['--faction-accent' as string]: accentColor } as CSSProperties)
    : undefined;

  return (
    <section className="action-dock" data-ui="action-dock" style={style}>
      <div className="action-dock-grid">
        {items.map((item) => (
          <ActionDockButton key={item.actionId} item={item} onClick={() => onAction(item.actionId)} />
        ))}
      </div>
      {controls ? <div className="action-dock-controls">{controls}</div> : null}
    </section>
  );
}
