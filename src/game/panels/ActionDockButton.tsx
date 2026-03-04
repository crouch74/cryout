import { Icon } from '../../ui/icon/Icon.tsx';
import type { ActionDockItem } from '../presentation/gameUiHelpers.ts';

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
      <Icon type={item.icon} size="md" title={item.label} />
      <span>{item.label}</span>
    </button>
  );
}
