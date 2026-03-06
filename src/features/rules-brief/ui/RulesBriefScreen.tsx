import { compileContent } from '../../../engine/index.ts';
import {
  localizeActionField,
  localizeRegionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import { ShellListCard } from '../../../ui/components/shell/ShellListCard.tsx';
import { ShellScreenLayout } from '../../../ui/components/shell/ShellScreenLayout.tsx';
import { ShellSectionCard } from '../../../ui/components/shell/ShellSectionCard.tsx';
import { IconPlateButton } from '../../../ui/components/actions/IconPlateButton.tsx';

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
  return (
    <ShellScreenLayout
      presentation={presentation}
      tableClassName="shell-table guidelines-table"
      boardClassName="shell-board"
      eyebrow={t('ui.guide.rulesBrief', 'Rules Brief')}
      title={localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
      detail={localizeRulesetField(content.ruleset.id, 'description', content.ruleset.description)}
      actions={(
        <div className="header-action-plates shell-actions">
          <IconPlateButton
            icon="home"
            size="sm"
            variant="utility"
            label={t('ui.guide.backHome', 'Back Home')}
            ariaLabel={t('ui.guide.backHome', 'Back Home')}
            onClick={onBackHome}
          />
          <IconPlateButton
            icon="launchCampaign"
            size="sm"
            variant="primary"
            label={t('ui.guide.openTable', 'Open Table')}
            ariaLabel={t('ui.guide.openTable', 'Open Table')}
            onClick={onOpenOffline}
          />
        </div>
      )}
    >
      <div className="guidelines-story-grid">
        <ShellSectionCard icon="modeLiberation" title={t('ui.guide.victoryModes', 'Victory Modes')} className="shell-card">
          <p>{t('ui.mode.liberation', 'Liberation')}: {t('ui.guide.victoryModes1', 'Finish Resolution with every region at 1 Extraction Token or less.')}</p>
          <p>{t('ui.mode.symbolic', 'Symbolic')}: {t('ui.guide.victoryModes2', 'Complete all active Beacons before sudden death closes the window.')}</p>
          <p>{t('ui.guide.victoryModes3', 'In room play, public victory still fails if any Secret Mandate fails.')}</p>
          <p>{t('ui.guide.victoryModes4', 'Local play removes Secret Mandates so every seat can plan in the open.')}</p>
          <p>{t('ui.guide.victoryModes5', 'Some scenarios add victory gates (minimum round, required action, or progress threshold) before public victory can trigger.')}</p>
        </ShellSectionCard>

        <ShellSectionCard icon="crisis" title={t('ui.guide.defeatChecks', 'Defeat Checks')} className="shell-card">
          <p>{t('ui.guide.defeatChecks1', 'If any region reaches 6 Extraction Tokens, the coalition loses immediately.')}</p>
          <p>{t('ui.guide.defeatChecks2', 'If any seat is reduced to 0 Comrades, the coalition loses immediately.')}</p>
          <p>{t('ui.guide.defeatChecks3', 'If sudden death is reached without Liberation or Symbolic completion, the coalition loses.')}</p>
          <p>{t('ui.guide.defeatChecks4', 'In room play, Secret Mandates are checked at victory; failed mandates convert public victory into defeat.')}</p>
        </ShellSectionCard>

        <ShellSectionCard icon="warMachine" title={t('ui.guide.systemPressureFlow', 'System Pressure Flow')} className="shell-card">
          <p>{t('ui.guide.systemPressureFlow1', 'System Phase resolves Crisis pressure, then active System escalations, then intervention effects.')}</p>
          <p>{t('ui.guide.systemPressureFlow2', 'Global Gaze and War Machine change campaign math and escalation tempo, not just flavor text.')}</p>
          <p>{t('ui.guide.systemPressureFlow3', 'Extraction Tokens are structural pressure; each round asks where the system is hardening fastest.')}</p>
        </ShellSectionCard>

        <ShellListCard
          className="shell-card"
          icon="objective"
          title={t('ui.guide.universalActions', 'Universal Actions')}
          items={content.ruleset.actions.map((action) => ({
            key: action.id,
            label: localizeActionField(action.id, 'name', action.name),
            description: localizeActionField(action.id, 'description', action.description),
          }))}
        />

        <ShellListCard
          className="shell-card"
          icon="globalGaze"
          title={t('ui.guide.canonicalRegions', 'Canonical Regions')}
          items={content.ruleset.regions.map((region) => ({
            key: region.id,
            label: localizeRegionField(region.id, 'name', region.name),
            description: localizeRegionField(region.id, 'description', region.description),
          }))}
        />
      </div>
    </ShellScreenLayout>
  );
}
