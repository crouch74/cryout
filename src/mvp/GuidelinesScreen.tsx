import { compileContent } from '../../engine/index.ts';
import {
  localizeActionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../i18n/index.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from './tabletop.tsx';

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
            <p>{t('ui.mode.liberation', 'Liberation')}: {t('ui.mode.liberationSummary', 'End Resolution with every region at 1 Extraction or less.')}</p>
            <p>{t('ui.mode.symbolic', 'Symbolic')}: {t('ui.mode.symbolicSummary', 'Complete all three active Beacons.')}</p>
            <p>{t('ui.guide.beacon2', 'Every faction carries a Secret Mandate. Reaching the public win condition without satisfying all Secret Mandates still ends in failure.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.coreThreat', 'Core Threat')}</span>
            <p>{t('ui.guide.coreThreat1', 'Extraction Tokens are the center of the board. The system adds them through system cards and intervention.')}</p>
            <p>{t('ui.guide.coreThreat2', 'Any region reaching 6 Extraction Tokens is an immediate loss.')}</p>
            <p>{t('ui.guide.coreThreat3', 'Global Gaze and War Machine shape how dangerous each round becomes.')}</p>
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
