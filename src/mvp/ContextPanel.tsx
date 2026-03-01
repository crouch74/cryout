import type { ReactNode } from 'react';
import { Icon } from './icons/Icon.tsx';
import type { ContextPanelMode } from './gameUiHelpers.ts';

export function ContextPanel({
  mode,
  open,
  onClose,
  onModeChange,
  showRegionTab = true,
  regionContent,
  actionContent,
  ledgerContent,
}: {
  mode: ContextPanelMode;
  open: boolean;
  onClose: () => void;
  onModeChange: (mode: ContextPanelMode) => void;
  showRegionTab?: boolean;
  regionContent: ReactNode;
  actionContent: ReactNode;
  ledgerContent: ReactNode;
}) {
  return (
    <aside className={`context-panel ${open ? 'is-open' : ''}`.trim()} role="dialog" aria-modal="false" aria-label="Board context panel">
      <div className="context-panel-header">
        <div className="context-panel-tabs">
          {showRegionTab ? (
            <button type="button" className={mode === 'region' ? 'is-active' : ''} onClick={() => onModeChange('region')}>Region</button>
          ) : null}
          <button type="button" className={mode === 'action' ? 'is-active' : ''} onClick={() => onModeChange('action')}>Action</button>
          <button type="button" className={mode === 'ledger' ? 'is-active' : ''} onClick={() => onModeChange('ledger')}>
            <Icon type="ledger" size={16} title="Ledger" />
            <span>Ledger</span>
          </button>
        </div>
        <button type="button" className="context-panel-close" onClick={onClose}>Close</button>
      </div>
      <div className="context-panel-body">
        {mode === 'region' ? regionContent : null}
        {mode === 'action' ? actionContent : null}
        {mode === 'ledger' ? ledgerContent : null}
      </div>
    </aside>
  );
}
