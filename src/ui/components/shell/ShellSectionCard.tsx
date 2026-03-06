import type { ReactNode } from 'react';
import type { IconType } from '../../icon/iconTypes.ts';
import { Icon } from '../../icon/Icon.tsx';
import { PaperSheet } from '../../layout/PaperSheet.tsx';
import './shell-section-card.css';

interface ShellSectionCardProps {
  icon: IconType;
  title: ReactNode;
  children: ReactNode;
  tone?: 'tray' | 'note';
  footer?: ReactNode;
  className?: string;
}

export function ShellSectionCard({
  icon,
  title,
  children,
  tone = 'tray',
  footer,
  className = '',
}: ShellSectionCardProps) {
  return (
    <PaperSheet tone={tone} className={['shell-card', 'shell-surface-note', className].filter(Boolean).join(' ')}>
      <div className="shell-section-card-copy">
        <span className="engraved-eyebrow shell-title-row"><Icon type={icon} size="xs" ariaHidden />{title}</span>
        {children}
      </div>
      {footer}
    </PaperSheet>
  );
}
