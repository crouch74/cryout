import { useEffect } from 'react';
import { t } from '../../../i18n/index.ts';
import { getToastRole } from '../../../game/presentation/gameUiHelpers.ts';
import { GameIcon } from '../../icon/GameIcon.tsx';
import { UiButton } from '../actions/UiButton.tsx';
import './toast-stack.css';

export interface ToastDraft {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
  title?: string;
  dismissAfterMs?: number;
}

export interface ToastMessage extends ToastDraft {
  id: string;
  createdAt: number;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(
        () => onDismiss(toast.id),
        Math.max(0, (toast.createdAt + (toast.dismissAfterMs ?? 5000)) - Date.now()),
      ),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [onDismiss, toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-label={t('ui.toast.liveGameUpdates', 'Live game updates')}>
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast-${toast.tone}`} role={getToastRole(toast.tone)}>
          <div className="toast-copy">
            {toast.title ? <strong>{toast.title}</strong> : null}
            <p>{toast.message}</p>
          </div>
          <UiButton
            variant="secondary"
            size="sm"
            iconOnly
            className="toast-dismiss-button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('ui.toast.dismissNotification', 'Dismiss notification')}
            title={t('ui.toast.dismissNotification', 'Dismiss notification')}
            icon={<GameIcon name="x" size="xs" ariaLabel={t('ui.toast.dismissNotification', 'Dismiss notification')} />}
          />
        </article>
      ))}
    </div>
  );
}
