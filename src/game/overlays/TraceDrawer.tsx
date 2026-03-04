import type { CompiledContent, DomainEvent } from '../../engine/index.ts';
import { X } from 'lucide-react';
import { t } from '../../i18n/index.ts';
import { presentHistoryEvent } from '../presentation/historyPresentation.ts';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';

interface TraceDrawerProps {
  event: DomainEvent | null;
  content: CompiledContent;
  onClose: () => void;
}

export function TraceDrawer({ event, content, onClose }: TraceDrawerProps) {
  if (!event) {
    return null;
  }

  const presented = presentHistoryEvent(event, content);

  return (
    <aside className="evidence-drawer evidence-trace-drawer" role="dialog" aria-modal="false" aria-labelledby="trace-drawer-title">
      <PaperSheet tone="folio" className="evidence-drawer-sheet">
        <div className="drawer-header">
          <div>
            <span className="engraved-eyebrow">{t('ui.game.meetingNotes', 'Meeting Notes')}</span>
            <h3 id="trace-drawer-title">
              {event.emoji} {presented.title}
            </h3>
            <p>{presented.contextLabel ?? presented.sourceLabel}</p>
          </div>
          <button
            type="button"
            className="mini-plate drawer-close-button"
            onClick={onClose}
            aria-label={t('ui.traceDrawer.close', 'Close')}
            title={t('ui.traceDrawer.close', 'Close')}
          >
            <X size={16} aria-label={t('ui.traceDrawer.close', 'Close')} />
          </button>
        </div>

        <div className="trace-slip-list">
          {presented.traces.length === 0 ? <p>{t('ui.status.noTraceRecorded', 'No trace recorded for this entry.')}</p> : null}
          {presented.traces.map((trace) => (
            <PaperSheet key={trace.key} tone="note" className={`trace-slip trace-${trace.status.toLowerCase()}`}>
              <div className="drawer-header">
                <strong>{trace.title}</strong>
                <span className="engraved-eyebrow">{trace.status}</span>
              </div>
              {trace.detail ? <p>{trace.detail}</p> : null}
              <div className="ledger-list">
                {trace.deltas.length === 0 ? <span>{t('ui.status.noStateDeltas', 'No state deltas')}</span> : null}
                {trace.deltas.map((delta) => (
                  <div key={delta.key} className="ledger-row">
                    <span>{delta.label}</span>
                    <strong>{delta.value}</strong>
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
