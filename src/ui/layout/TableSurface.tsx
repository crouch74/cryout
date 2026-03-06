import type { HTMLAttributes } from 'react';

export function TableSurface({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`table-surface ${className}`.trim()} {...props}>
      <div className="table-surface-paper">{children}</div>
    </div>
  );
}
