import { compileContent } from '../../../engine/index.ts';
import {
  localizeActionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface GuidelinesScreenProps {
  onBackHome: () => void;
  onOpenOffline: () => void;
}

const content = compileContent('base_design');

export function GuidelinesScreen({ onBackHome, onOpenOffline }: GuidelinesScreenProps) {
  return (
    <TableSurface className="guidelines-table">
      <PaperSheet tone="board" className="dossier-spread">
        <EngravedHeader
          eyebrow={t('ui.guide.rulesBrief', 'Rules Brief')}
          title={localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
          detail={localizeRulesetField(content.ruleset.id, 'description', content.ruleset.description)}
          actions={
            <div className="header-action-plates">
              <LocaleSwitcher />
              <ThemePlate label={t('ui.guide.backHome', 'Back Home')} onClick={onBackHome} />
              <ThemePlate label={t('ui.guide.openTable', 'Open Table')} onClick={onOpenOffline} />
            </div>
          }
        />

        <div className="guidelines-story-grid">
          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.victoryModes', 'Victory Modes')}</span>
            <p>{t('ui.mode.liberation', 'Liberation')}: {t('ui.guide.victoryModes1', 'Finish Resolution with every region at 1 Extraction Token or less.')}</p>
            <p>{t('ui.mode.symbolic', 'Symbolic')}: {t('ui.guide.victoryModes2', 'Complete all active Beacons before sudden death closes the window.')}</p>
            <p>{t('ui.guide.victoryModes3', 'In room play, public victory still fails if any Secret Mandate fails.')}</p>
            <p>{t('ui.guide.victoryModes4', 'Local play removes Secret Mandates so every seat can plan in the open.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.defeatChecks', 'Defeat Checks')}</span>
            <p>{t('ui.guide.defeatChecks1', 'If any region reaches 6 Extraction Tokens, the coalition loses immediately.')}</p>
            <p>{t('ui.guide.defeatChecks2', 'If any seat is reduced to 0 Comrades, the coalition loses immediately.')}</p>
            <p>{t('ui.guide.defeatChecks3', 'If sudden death is reached without Liberation or Symbolic completion, the coalition loses.')}</p>
            <p>{t('ui.guide.defeatChecks4', 'In room play, Secret Mandates are checked at victory; failed mandates convert public victory into defeat.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.systemPressureFlow', 'System Pressure Flow')}</span>
            <p>{t('ui.guide.systemPressureFlow1', 'System Phase resolves Crisis pressure, then active System escalations, then intervention effects.')}</p>
            <p>{t('ui.guide.systemPressureFlow2', 'Global Gaze and War Machine change campaign math and escalation tempo, not just flavor text.')}</p>
            <p>{t('ui.guide.systemPressureFlow3', 'Extraction Tokens are structural pressure; each round asks where the system is hardening fastest.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.universalActions', 'Universal Actions')}</span>
            <ul>
              {content.ruleset.actions.map((action) => (
                <li key={action.id}><strong>{localizeActionField(action.id, 'name', action.name)}:</strong> {localizeActionField(action.id, 'description', action.description)}</li>
              ))}
            </ul>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.canonicalRegions', 'Canonical Regions')}</span>
            <ul>
              {content.ruleset.regions.map((region) => (
                <li key={region.id}><strong>{localizeRegionField(region.id, 'name', region.name)}:</strong> {localizeRegionField(region.id, 'description', region.description)}</li>
              ))}
            </ul>
          </PaperSheet>
        </div>
      </PaperSheet>
    </TableSurface>
  );
}
