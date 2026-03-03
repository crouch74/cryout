import { useEffect } from 'react';
import { t } from '../../i18n/index.ts';
import { getToastRole } from '../../game/presentation/gameUiHelpers.ts';

export interface ToastMessage {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
  title?: string;
  dismissAfterMs?: number;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.id), toast.dismissAfterMs ?? 3200),
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
    <div className="minutes-toast-stack" aria-live="polite" aria-label={t('ui.toast.liveGameUpdates', 'Live game updates')}>
      {toasts.map((toast) => (
        <article key={toast.id} className={`minutes-toast minutes-toast-${toast.tone}`} role={getToastRole(toast.tone)}>
          <div className="minutes-toast-copy">
            {toast.title ? <strong>{toast.title}</strong> : null}
            <p>{toast.message}</p>
          </div>
          <button
            type="button"
            className="mini-plate"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('ui.toast.dismissNotification', 'Dismiss notification')}
          >
            {t('ui.regionDrawer.close', 'Close')}
          </button>
        </article>
      ))}
    </div>
  );
}
