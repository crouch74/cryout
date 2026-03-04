import type { ReactNode } from 'react';
import { Icon } from '../../ui/icon/Icon.tsx';
import { GameIcon } from '../../ui/icon/GameIcon.tsx';
import type { ContextPanelMode } from '../presentation/gameUiHelpers.ts';
import { t } from '../../i18n/index.ts';

export function ContextPanel({
  mode,
  open,
  onClose,
  onModeChange,
  showRegionTab = true,
  regionContent,
  actionContent,
  ledgerContent,
  decksContent,
}: {
  mode: ContextPanelMode;
  open: boolean;
  onClose: () => void;
  onModeChange: (mode: ContextPanelMode) => void;
  showRegionTab?: boolean;
  regionContent: ReactNode;
  actionContent: ReactNode;
  ledgerContent: ReactNode;
  decksContent: ReactNode;
}) {
  return (
    <aside className={`context-panel ${open ? 'is-open' : ''}`.trim()} role="dialog" aria-modal="false" aria-label={t('ui.app.contextPanel', 'Board context panel')}>
      <div className="context-panel-header">
        <div className="context-panel-tabs">
          {showRegionTab ? (
            <button type="button" className={mode === 'region' ? 'is-active' : ''} onClick={() => onModeChange('region')}>
              <Icon type="objective" size="sm" title={t('ui.game.region', 'Region')} ariaLabel={t('ui.game.region', 'Region')} />
              <span>{t('ui.game.region', 'Region')}</span>
            </button>
          ) : null}
          <button type="button" className={mode === 'action' ? 'is-active' : ''} onClick={() => onModeChange('action')}>
            <Icon type="organize" size="sm" title={t('ui.game.action', 'Action')} ariaLabel={t('ui.game.action', 'Action')} />
            <span>{t('ui.game.action', 'Action')}</span>
          </button>
          <button type="button" className={mode === 'decks' ? 'is-active' : ''} onClick={() => onModeChange('decks')}>
            <Icon type="playCard" size="sm" title={t('ui.game.decks', 'Decks')} ariaLabel={t('ui.game.decks', 'Decks')} />
            <span>{t('ui.game.decks', 'Decks')}</span>
          </button>
          <button type="button" className={mode === 'ledger' ? 'is-active' : ''} onClick={() => onModeChange('ledger')}>
            <Icon type="ledger" size="sm" title={t('ui.game.ledger', 'Ledger')} />
            <span>{t('ui.game.ledger', 'Ledger')}</span>
          </button>
        </div>
        <button
          type="button"
          className="context-panel-close"
          onClick={onClose}
          aria-label={t('ui.game.close', 'Close')}
          title={t('ui.game.close', 'Close')}
        >
          <GameIcon name="x" size="sm" ariaLabel={t('ui.game.close', 'Close')} />
        </button>
      </div>
      <div className="context-panel-body">
        {mode === 'region' ? regionContent : null}
        {mode === 'action' ? actionContent : null}
        {mode === 'decks' ? decksContent : null}
        {mode === 'ledger' ? ledgerContent : null}
      </div>
    </aside>
  );
}
