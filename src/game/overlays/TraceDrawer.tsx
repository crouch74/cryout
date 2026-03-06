import type { CompiledContent, DomainEvent } from '../../engine/index.ts';
import { t } from '../../i18n/index.ts';
import { presentHistoryEvent } from '../presentation/historyPresentation.ts';
import { PaperSheet } from '../../ui/layout/PaperSheet.tsx';
import { OverlayDrawer } from '../../ui/components/overlay/OverlayDrawer.tsx';

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
    <OverlayDrawer
      open
      eyebrow={t('ui.game.meetingNotes', 'Meeting Notes')}
      title={presented.title}
      className="evidence-drawer evidence-trace-drawer"
      closeLabel={t('ui.traceDrawer.close', 'Close')}
      onClose={onClose}
    >
      <p>{presented.contextLabel ?? presented.sourceLabel}</p>
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
    </OverlayDrawer>
  );
}
