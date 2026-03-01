import type { DomainEvent } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { PaperSheet } from './tabletop.tsx';

interface TraceDrawerProps {
  event: DomainEvent | null;
  onClose: () => void;
}

export function TraceDrawer({ event, onClose }: TraceDrawerProps) {
  if (!event) {
    return null;
  }

  return (
    <aside className="evidence-drawer evidence-trace-drawer" role="dialog" aria-modal="false" aria-labelledby="trace-drawer-title">
      <PaperSheet tone="folio" className="evidence-drawer-sheet">
        <div className="drawer-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.meetingNotes', 'Meeting Notes')}</span>
            <h3 id="trace-drawer-title">
              {event.emoji} {event.message}
            </h3>
            <p>{event.causedBy.join(' → ')}</p>
          </div>
          <button type="button" className="mini-plate" onClick={onClose}>
            {t('ui.traceDrawer.close', 'Close')}
          </button>
        </div>

        <div className="trace-slip-list">
          {event.trace.length === 0 ? <p>{t('ui.status.noTraceRecorded', 'No trace recorded for this entry.')}</p> : null}
          {event.trace.map((trace, index) => (
            <PaperSheet key={`${trace.effectType}-${index}`} tone="note" className={`trace-slip trace-${trace.status}`}>
              <div className="drawer-header">
                <strong>{trace.effectType}</strong>
                <span className="engraved-eyebrow">{trace.status}</span>
              </div>
              <p>{trace.message}</p>
              {trace.causedBy.length > 0 ? <p>{trace.causedBy.join(' → ')}</p> : null}
              <div className="ledger-list">
                {trace.deltas.length === 0 ? <span>{t('ui.status.noStateDeltas', 'No state deltas')}</span> : null}
                {trace.deltas.map((delta) => (
                  <div key={`${delta.label}-${String(delta.before)}-${String(delta.after)}`} className="ledger-row">
                    <span>{delta.label}</span>
                    <strong>{String(delta.before)} → {String(delta.after)}</strong>
                  </div>
                ))}
              </div>
            </PaperSheet>
          ))}
        </div>
      </PaperSheet>
    </aside>
  );
}
