import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from './ModalRoot.tsx';

interface ModalProps {
  open: boolean;
  titleId?: string;
  describedById?: string;
  dismissEnabled?: boolean;
  onRequestClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  shellClassName?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(node: HTMLElement | null) {
  if (!node) {
    return [];
  }

  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

export function Modal({
  open,
  titleId,
  describedById,
  dismissEnabled = true,
  onRequestClose,
  initialFocusRef,
  children,
  className = '',
  shellClassName = '',
}: ModalProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(getModalRoot());
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTarget = initialFocusRef?.current ?? modalRef.current;
    window.setTimeout(() => {
      focusTarget?.focus();
    }, 0);

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!dismissEnabled || !onRequestClose) {
          return;
        }
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissEnabled, onRequestClose, open]);

  if (!open || !portalRoot) {
    return null;
  }

  const handleBackdropKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && dismissEnabled && onRequestClose) {
      event.preventDefault();
      onRequestClose();
    }
  };

  return createPortal(
    <div
      className={`modal-shell ${shellClassName}`.trim()}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || !dismissEnabled || !onRequestClose) {
          return;
        }
        onRequestClose();
      }}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        ref={modalRef}
        className={`modal-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={describedById}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    portalRoot,
  );
}
