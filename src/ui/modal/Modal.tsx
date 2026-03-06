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
  titleId?: string;
  describedById?: string;
  dismissEnabled?: boolean;
  onRequestClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  shellClassName?: string;
  a11yTitle?: string;
  a11yDescription?: string;
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
  a11yTitle,
  a11yDescription,
}: ModalProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const hiddenTitleId = `${generatedTitleId}-radix-title`;
  const resolvedTitleId = titleId
    ? `${hiddenTitleId} ${titleId}`
    : hiddenTitleId;
  const resolvedDescriptionId = describedById ?? (a11yDescription ? generatedDescriptionId : undefined);
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
      <DialogPortal container={portalRoot} forceMount>
        {open ? (
          <LazyMotion features={domAnimation}>
            <DialogOverlay asChild forceMount>
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
              forceMount
              asChild
              aria-labelledby={resolvedTitleId}
              aria-describedby={resolvedDescriptionId}
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
              <m.div
                className={`modal-card ${className}`.trim()}
                tabIndex={-1}
                initial={canAnimate ? { opacity: 0, y: 10, scale: 0.98 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={canAnimate ? { opacity: 0, y: 10, scale: 0.98 } : undefined}
                transition={canAnimate ? { duration: 0.2, ease: [0.18, 0.85, 0.24, 1] } : undefined}
              >
                <DialogTitle id={hiddenTitleId} className="visually-hidden">
                  {a11yTitle ?? 'Dialog'}
                </DialogTitle>
                {!describedById && a11yDescription ? (
                  <DialogDescription id={generatedDescriptionId} className="visually-hidden">
                    {a11yDescription}
                  </DialogDescription>
                ) : null}
                {children}
              </m.div>
            </DialogContent>
          </LazyMotion>
        ) : null}
      </DialogPortal>
    </DialogRoot>
  );
}
