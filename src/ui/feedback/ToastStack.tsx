import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t } from '../../i18n/index.ts';
import { getToastRole } from '../../game/presentation/gameUiHelpers.ts';

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
    <div className="minutes-toast-stack" aria-live="polite" aria-label={t('ui.toast.liveGameUpdates', 'Live game updates')}>
      {toasts.map((toast) => (
        <article key={toast.id} className={`minutes-toast minutes-toast-${toast.tone}`} role={getToastRole(toast.tone)}>
          <div className="minutes-toast-copy">
            {toast.title ? <strong>{toast.title}</strong> : null}
            <p>{toast.message}</p>
          </div>
          <button
            type="button"
            className="mini-plate toast-dismiss-button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('ui.toast.dismissNotification', 'Dismiss notification')}
            title={t('ui.toast.dismissNotification', 'Dismiss notification')}
          >
            <X size={14} aria-label={t('ui.toast.dismissNotification', 'Dismiss notification')} />
          </button>
        </article>
      ))}
    </div>
  );
}
