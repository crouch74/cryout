import { Icon } from './icons/Icon.tsx';
import type { StatusRibbonItem } from './gameUiHelpers.ts';

export function StatusPill({ item }: { item: StatusRibbonItem }) {
  return (
    <article className={`status-pill status-pill-${item.id} tone-${item.tone}`.trim()} title={item.tooltip}>
      <Icon type={item.icon} size={18} title={item.label} />
      <div className="status-pill-copy">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
    </article>
  );
}
