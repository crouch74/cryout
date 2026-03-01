import type { DomainEvent } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';

interface TraceDrawerProps {
  event: DomainEvent | null;
  onClose: () => void;
}

export function TraceDrawer({ event, onClose }: TraceDrawerProps) {
  if (!event) {
    return null;
  }

  return (
    <aside className="trace-drawer">
      <div className="drawer-header">
        <div>
          <h3>
            {event.emoji} {event.message}
          </h3>
          <p>{event.causedBy.join(' -> ')}</p>
        </div>
        <div className="drawer-header-actions">
          <button onClick={onClose}>{t('ui.traceDrawer.close', 'Close')}</button>
        </div>
      </div>

      <div className="trace-list">
        {event.trace.length === 0 && <p className="muted">{t('ui.status.noTraceRecorded', 'No trace recorded for this entry.')}</p>}
        {event.trace.map((trace, index) => (
          <div key={`${trace.effectType}-${index}`} className={`trace-card ${trace.status}`}>
            <div className="row-split">
              <strong>{trace.effectType}</strong>
              <span>{trace.status}</span>
            </div>
            <p>{trace.message}</p>
            {trace.causedBy.length > 0 && <div className="trace-caused-by">{trace.causedBy.join(' -> ')}</div>}
            <div className="trace-deltas">
              {trace.deltas.length === 0 && <span className="muted">{t('ui.status.noStateDeltas', 'No state deltas')}</span>}
              {trace.deltas.map((delta) => (
                <div key={`${delta.label}-${String(delta.before)}-${String(delta.after)}`} className="delta-row">
                  <span>{delta.label}</span>
                  <span>
                    {String(delta.before)} → {String(delta.after)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
