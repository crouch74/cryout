import type { HTMLAttributes } from 'react';

export function PaperSheet({
  children,
  className = '',
  tone = 'plain',
  ...props
}: HTMLAttributes<HTMLElement> & { tone?: 'plain' | 'folio' | 'board' | 'note' | 'mat' | 'tray' | 'docket' | 'slip' | 'booklet' }) {
  return (
    <section className={`paper-sheet paper-sheet-${tone} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
