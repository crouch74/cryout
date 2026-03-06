import type { CSSProperties } from 'react';
import './metric-ribbon.css';

export interface MetricRibbonItem {
  label: string;
  value: string;
  tone?: 'default' | 'critical';
}

export function MetricRibbon({
  items,
  columns,
  className = '',
}: {
  items: MetricRibbonItem[];
  columns?: number;
  className?: string;
}) {
  const style = columns
    ? ({ ['--metric-ribbon-columns' as string]: String(columns) } as CSSProperties)
    : undefined;

  return (
    <div className={['metric-ribbon', className].filter(Boolean).join(' ')} style={style}>
      {items.map((item) => (
        <div key={`${item.label}:${item.value}`} className="metric-ribbon-item" data-tone={item.tone ?? 'default'}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
