import { useId, useRef, type AriaRole, type ReactNode, type RefObject } from 'react';
import { Modal } from '../../modal/Modal.tsx';
import { PaperSheet } from '../../layout/PaperSheet.tsx';
import { DialogDescription, DialogTitle } from '../../primitives/index.ts';
import './modal-frame.css';

interface ModalFrameProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  dismissEnabled?: boolean;
  onRequestClose?: () => void;
  size?: 'md' | 'lg' | 'xl';
  variant?: 'guide' | 'game';
  actions?: ReactNode;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  hideHeader?: boolean;
  className?: string;
  shellClassName?: string;
  role?: AriaRole;
  'aria-modal'?: boolean | 'true' | 'false';
}

export function ModalFrame({
  open,
  title,
  description,
  dismissEnabled = true,
  onRequestClose,
  size = 'md',
  variant = 'game',
  actions,
  children,
  initialFocusRef,
  hideHeader = false,
  className = '',
  shellClassName = '',
}: ModalFrameProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fallbackFocusRef = useRef<HTMLDivElement | null>(null);

  return (
    <Modal
      open={open}
      accessibilityTitle={title}
      accessibilityDescription={description}
      dismissEnabled={dismissEnabled}
      onRequestClose={onRequestClose}
      initialFocusRef={initialFocusRef ?? fallbackFocusRef}
      shellClassName={shellClassName}
      className={className}
    >
      <PaperSheet
        tone="folio"
        className="modal-frame-sheet"
        data-size={size}
        data-variant={variant}
      >
        <div ref={fallbackFocusRef} tabIndex={-1} />
        {hideHeader ? (
          <div className="visually-hidden">
            <DialogTitle id={titleId}>{title}</DialogTitle>
            {description ? <DialogDescription id={descriptionId}>{description}</DialogDescription> : null}
          </div>
        ) : null}
        {!hideHeader ? (
          <header className="modal-frame-header">
            <DialogTitle asChild>
              <h2 id={titleId}>{title}</h2>
            </DialogTitle>
            {description ? (
              <DialogDescription asChild>
                <p id={descriptionId}>{description}</p>
              </DialogDescription>
            ) : null}
          </header>
        ) : null}
        {children}
        {actions ? <div className="modal-frame-actions">{actions}</div> : null}
      </PaperSheet>
    </Modal>
  );
}
