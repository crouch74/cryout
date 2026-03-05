import { compileContent } from '../../../engine/index.ts';
import {
  localizeActionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
import { GameIcon } from '../../../ui/icon/GameIcon.tsx';
import { EngravedHeader, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface GuidelinesScreenProps {
  rulesetId: string;
  onBackHome: () => void;
  onOpenOffline: () => void;
  presentation?: 'page' | 'modal';
}

export function GuidelinesScreen({
  rulesetId,
  onBackHome,
  onOpenOffline,
  presentation = 'page',
}: GuidelinesScreenProps) {
  const content = compileContent(rulesetId);
  const guideContent = (
    <PaperSheet tone="board" className="shell-board shell-surface shell-surface-focus">
        <EngravedHeader
          eyebrow={t('ui.guide.rulesBrief', 'Rules Brief')}
          title={localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
          detail={localizeRulesetField(content.ruleset.id, 'description', content.ruleset.description)}
          actions={
            <div className="header-action-plates shell-actions">
              <ThemePlate
                size="sm"
                variant="utility"
                label={(
                  <span className="plate-label-with-icon">
                    <GameIcon name="home" size="xs" ariaLabel={t('ui.guide.backHome', 'Back Home')} />
                    <span>{t('ui.guide.backHome', 'Back Home')}</span>
                  </span>
                )}
                onClick={onBackHome}
              />
              <ThemePlate
                size="sm"
                variant="primary"
                label={(
                  <span className="plate-label-with-icon">
                    <GameIcon name="launchCampaign" size="xs" ariaLabel={t('ui.guide.openTable', 'Open Table')} />
                    <span>{t('ui.guide.openTable', 'Open Table')}</span>
                  </span>
                )}
                onClick={onOpenOffline}
              />
            </div>
          }
        />

        <div className="guidelines-story-grid">
          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="modeLiberation" size="xs" ariaLabel={t('ui.guide.victoryModes', 'Victory Modes')} />{t('ui.guide.victoryModes', 'Victory Modes')}</span>
            <p>{t('ui.mode.liberation', 'Liberation')}: {t('ui.guide.victoryModes1', 'Finish Resolution with every region at 1 Extraction Token or less.')}</p>
            <p>{t('ui.mode.symbolic', 'Symbolic')}: {t('ui.guide.victoryModes2', 'Complete all active Beacons before sudden death closes the window.')}</p>
            <p>{t('ui.guide.victoryModes3', 'In room play, public victory still fails if any Secret Mandate fails.')}</p>
            <p>{t('ui.guide.victoryModes4', 'Local play removes Secret Mandates so every seat can plan in the open.')}</p>
            <p>{t('ui.guide.victoryModes5', 'Some scenarios add victory gates (minimum round, required action, or progress threshold) before public victory can trigger.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="crisis" size="xs" ariaLabel={t('ui.guide.defeatChecks', 'Defeat Checks')} />{t('ui.guide.defeatChecks', 'Defeat Checks')}</span>
            <p>{t('ui.guide.defeatChecks1', 'If any region reaches 6 Extraction Tokens, the coalition loses immediately.')}</p>
            <p>{t('ui.guide.defeatChecks2', 'If any seat is reduced to 0 Comrades, the coalition loses immediately.')}</p>
            <p>{t('ui.guide.defeatChecks3', 'If sudden death is reached without Liberation or Symbolic completion, the coalition loses.')}</p>
            <p>{t('ui.guide.defeatChecks4', 'In room play, Secret Mandates are checked at victory; failed mandates convert public victory into defeat.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="warMachine" size="xs" ariaLabel={t('ui.guide.systemPressureFlow', 'System Pressure Flow')} />{t('ui.guide.systemPressureFlow', 'System Pressure Flow')}</span>
            <p>{t('ui.guide.systemPressureFlow1', 'System Phase resolves Crisis pressure, then active System escalations, then intervention effects.')}</p>
            <p>{t('ui.guide.systemPressureFlow2', 'Global Gaze and War Machine change campaign math and escalation tempo, not just flavor text.')}</p>
            <p>{t('ui.guide.systemPressureFlow3', 'Extraction Tokens are structural pressure; each round asks where the system is hardening fastest.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="objective" size="xs" ariaLabel={t('ui.guide.universalActions', 'Universal Actions')} />{t('ui.guide.universalActions', 'Universal Actions')}</span>
            <ul className="shell-list">
              {content.ruleset.actions.map((action) => (
                <li key={action.id} className="shell-list-item">
                  <Icon type="check" size="xs" ariaLabel={localizeActionField(action.id, 'name', action.name)} ariaHidden />
                  <span><strong>{localizeActionField(action.id, 'name', action.name)}:</strong> {localizeActionField(action.id, 'description', action.description)}</span>
                </li>
              ))}
            </ul>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="globalGaze" size="xs" ariaLabel={t('ui.guide.canonicalRegions', 'Canonical Regions')} />{t('ui.guide.canonicalRegions', 'Canonical Regions')}</span>
            <ul className="shell-list">
              {content.ruleset.regions.map((region) => (
                <li key={region.id} className="shell-list-item">
                  <Icon type="check" size="xs" ariaLabel={localizeRegionField(region.id, 'name', region.name)} ariaHidden />
                  <span><strong>{localizeRegionField(region.id, 'name', region.name)}:</strong> {localizeRegionField(region.id, 'description', region.description)}</span>
                </li>
              ))}
            </ul>
          </PaperSheet>
        </div>
      </PaperSheet>
  );

  if (presentation === 'modal') {
    return <div className="guide-modal-content shell-table">{guideContent}</div>;
  }

  return (
    <TableSurface className="guidelines-table shell-table shell-depth-surface">
      {guideContent}
    </TableSurface>
  );
}
