import type { IconType } from '../../icon/iconTypes.ts';
import { Icon } from '../../icon/Icon.tsx';
import { ShellSectionCard } from './ShellSectionCard.tsx';

export function ShellListCard({
  icon,
  title,
  items,
  emptyState,
  className = '',
}: {
  icon: IconType;
  title: string;
  items: Array<{ key: string; label: string; description: string }>;
  emptyState?: string;
  className?: string;
}) {
  return (
    <ShellSectionCard icon={icon} title={title} className={className}>
      {items.length === 0 ? <p>{emptyState}</p> : null}
      {items.length > 0 ? (
        <ul className="shell-list">
          {items.map((item) => (
            <li key={item.key} className="shell-list-item">
              <Icon type="check" size="xs" ariaHidden />
              <span><strong>{item.label}:</strong> {item.description}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </ShellSectionCard>
  );
}
