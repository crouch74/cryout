import { t } from '../../i18n/index.ts';

export function LoadingScreen() {
  return (
    <div className="loading-shell">
      <div className="loading-card">
        <span className="eyebrow">{t('ui.app.restoringSession', 'Restoring Session')}</span>
        <h1>{t('ui.app.rebuildingState', 'Rebuilding the table state')}</h1>
        <p>{t('ui.app.rebuildingStateBody', 'The app is resolving the room permalink and seat credential.')}</p>
      </div>
    </div>
  );
}
