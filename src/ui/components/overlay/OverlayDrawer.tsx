import type { ReactNode } from 'react';
import { PaperSheet } from '../../layout/PaperSheet.tsx';
import { GameIcon } from '../../icon/GameIcon.tsx';
import { UiButton } from '../actions/UiButton.tsx';
import './overlay-drawer.css';

export function OverlayDrawer({
  open,
  title,
  eyebrow,
  position = 'left',
  closeLabel = 'Close',
  onClose,
  children,
  className = '',
}: {
  open: boolean;
  title: ReactNode;
  eyebrow?: ReactNode;
  position?: 'left' | 'right';
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <aside className={[ 'overlay-drawer-frame', className ].filter(Boolean).join(' ')} data-position={position} role="dialog" aria-modal="false">
      <PaperSheet tone="folio" className="overlay-drawer evidence-drawer-sheet">
        <div className="drawer-header">
          <div>
            {eyebrow ? <span className="engraved-eyebrow">{eyebrow}</span> : null}
            <h3>{title}</h3>
          </div>
          <UiButton
            variant="secondary"
            size="sm"
            iconOnly
            className="drawer-close-button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            icon={<GameIcon name="x" size="sm" ariaLabel={closeLabel} />}
          />
        </div>
        {children}
      </PaperSheet>
    </aside>
  );
}
