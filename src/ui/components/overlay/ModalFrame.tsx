import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { Modal } from '../../modal/Modal.tsx';
import { PaperSheet } from '../../layout/PaperSheet.tsx';
import './modal-frame.css';

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
}: {
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
}) {
  const titleId = useId();
  const descriptionId = useId();
  const fallbackFocusRef = useRef<HTMLDivElement | null>(null);

  return (
    <Modal
      open={open}
      titleId={titleId}
      describedById={description ? descriptionId : undefined}
      dismissEnabled={dismissEnabled}
      onRequestClose={onRequestClose}
      initialFocusRef={initialFocusRef ?? fallbackFocusRef}
      shellClassName={shellClassName}
      className={className}
      a11yTitle={typeof title === 'string' ? title : 'Dialog'}
      a11yDescription={typeof description === 'string' ? description : undefined}
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
            <span id={titleId}>{title}</span>
            {description ? <span id={descriptionId}>{description}</span> : null}
          </div>
        ) : null}
        {!hideHeader ? (
          <header className="modal-frame-header">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </header>
        ) : null}
        {children}
        {actions ? <div className="modal-frame-actions">{actions}</div> : null}
      </PaperSheet>
    </Modal>
  );
}
