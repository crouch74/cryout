import { Icon } from './icons/Icon.tsx';
import type { ActionDockItem } from './gameUiHelpers.ts';

export function ActionDockButton({
  item,
  onClick,
}: {
  item: ActionDockItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`action-dock-button ${item.quickQueue ? 'is-quick' : ''}`.trim()}
      onClick={onClick}
      disabled={item.disabled}
      title={item.disabledReason ?? item.label}
    >
      <Icon type={item.icon} size={18} title={item.label} />
      <span>{item.label}</span>
    </button>
  );
}
