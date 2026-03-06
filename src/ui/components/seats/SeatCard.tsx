import type { CSSProperties, ReactNode } from 'react';
import './seat-card.css';

export function SeatCard({
  title,
  subtitle,
  badge,
  accentColor,
  status,
  children,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  accentColor?: string;
  status: 'default' | 'claimed' | 'open' | 'active';
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = accentColor
    ? ({ ['--seat-card-accent' as string]: accentColor } as CSSProperties)
    : undefined;

  return (
    <article className={['seat-card', className].filter(Boolean).join(' ')} data-status={status} style={style}>
      <div className="seat-card-header">
        <div className="seat-card-header-copy">
          <strong>{title}</strong>
          {subtitle ? <span className="seat-card-subtitle">{subtitle}</span> : null}
        </div>
        {badge ? <span className="seat-card-badge">{badge}</span> : null}
      </div>
      <div className="seat-card-body">{children}</div>
      {action ? <div className="seat-card-action">{action}</div> : null}
    </article>
  );
}
