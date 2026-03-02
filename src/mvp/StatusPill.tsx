import { Icon } from './icons/Icon.tsx';
import type { StatusRibbonItem } from './gameUiHelpers.ts';

function shouldLockMetricDirection(value: string) {
  return /^[\d٠-٩+\-/:.\s]+$/.test(value);
}

export function StatusPill({
  item,
  isChanging = false,
}: {
  item: StatusRibbonItem;
  isChanging?: boolean;
}) {
  const lockMetricDirection = shouldLockMetricDirection(item.value);

  return (
    <article
      className={`status-pill status-pill-${item.id} tone-${item.tone} ${isChanging ? 'is-changing' : ''}`.trim()}
      title={item.tooltip}
    >
      <Icon type={item.icon} size={18} title={item.label} />
      <div className="status-pill-copy">
        <span>{item.label}</span>
        <strong dir={lockMetricDirection ? 'ltr' : undefined}>{item.value}</strong>
      </div>
    </article>
  );
}
