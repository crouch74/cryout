import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useThemeSettings } from '../../app/providers/ThemeProvider.tsx';
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from '../primitives/index.ts';
import { getModalRoot } from './ModalRoot.tsx';

interface ModalProps {
  open: boolean;
  accessibilityTitle?: ReactNode;
  accessibilityDescription?: ReactNode;
  dismissEnabled?: boolean;
  onRequestClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  shellClassName?: string;
}

export function Modal({
  open,
  accessibilityTitle,
  accessibilityDescription,
  dismissEnabled = true,
  onRequestClose,
  initialFocusRef,
  children,
  className = '',
  shellClassName = '',
}: ModalProps) {
  const accessibilityTitleId = useId();
  const accessibilityDescriptionId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { motionMode } = useThemeSettings();

  useEffect(() => {
    setPortalRoot(getModalRoot());
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  useEffect(() => {
    if (open) {
      return;
    }

    previousFocusRef.current?.focus?.();
  }, [open]);

  if (!portalRoot) {
    return null;
  }

  const canAnimate = motionMode !== 'reduced';

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && dismissEnabled && onRequestClose) {
          onRequestClose();
        }
      }}
    >
      <DialogPortal container={portalRoot}>
        {open ? (
          <LazyMotion features={domAnimation}>
            <DialogOverlay asChild>
              <m.div
                className={`modal-shell ${shellClassName}`.trim()}
                role="presentation"
                initial={canAnimate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={canAnimate ? { opacity: 0 } : undefined}
                transition={canAnimate ? { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] } : undefined}
              />
            </DialogOverlay>
            <DialogContent
              aria-labelledby={accessibilityTitleId}
              aria-describedby={accessibilityDescriptionId}
              onOpenAutoFocus={(event) => {
                if (initialFocusRef?.current) {
                  event.preventDefault();
                  initialFocusRef.current.focus();
                }
              }}
              onEscapeKeyDown={(event) => {
                if (!dismissEnabled) {
                  event.preventDefault();
                }
              }}
              onInteractOutside={(event) => {
                if (!dismissEnabled) {
                  event.preventDefault();
                }
              }}
              onPointerDownOutside={(event) => {
                if (!dismissEnabled) {
                  event.preventDefault();
                }
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
              }}
            >
              <>
                <DialogTitle className="visually-hidden" id={accessibilityTitleId}>
                  {accessibilityTitle ?? 'Dialog'}
                </DialogTitle>
                <DialogDescription className="visually-hidden" id={accessibilityDescriptionId}>
                  {accessibilityDescription ?? 'Dialog content'}
                </DialogDescription>
                <m.div
                  className={`modal-card ${className}`.trim()}
                  tabIndex={-1}
                  initial={canAnimate ? { opacity: 0, y: 10, scale: 0.98 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={canAnimate ? { opacity: 0, y: 10, scale: 0.98 } : undefined}
                  transition={canAnimate ? { duration: 0.2, ease: [0.18, 0.85, 0.24, 1] } : undefined}
                >
                  {children}
                </m.div>
              </>
            </DialogContent>
          </LazyMotion>
        ) : null}
      </DialogPortal>
    </DialogRoot>
  );
}
