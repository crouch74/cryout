import { Icon } from '../../ui/icon/Icon.tsx';
import { useAppLocale } from '../../i18n/index.ts';
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../../ui/primitives/index.ts';
import type { StatusRibbonItem } from '../presentation/gameUiHelpers.ts';

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
  const { dir } = useAppLocale();
  const lockMetricDirection = shouldLockMetricDirection(item.value);
  const metricDirection = lockMetricDirection
    ? dir
    : undefined;
  const tooltipId = `status-pill-tooltip-${item.id}`;

  return (
    <TooltipProvider delayDuration={120}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <article
            className={`status-pill status-pill-${item.id} tone-${item.tone} ${isChanging ? 'is-changing' : ''}`.trim()}
            tabIndex={0}
            aria-describedby={tooltipId}
            aria-label={`${item.label}: ${item.value}. ${item.tooltip}`}
          >
            <Icon type={item.icon} size="md" title={item.label} />
            <div className="status-pill-copy">
              <span>{item.label}</span>
              <strong dir={metricDirection}>{item.value}</strong>
            </div>
          </article>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            id={tooltipId}
            side="bottom"
            align="center"
            sideOffset={10}
            collisionPadding={12}
            className="status-pill-overlay-tooltip"
          >
            {item.tooltip}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  );
}
