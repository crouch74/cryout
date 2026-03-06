import { compileContent } from '../../../engine/index.ts';
import {
  localizeFactionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import { IconPlateButton } from '../../../ui/components/actions/IconPlateButton.tsx';
import { ShellListCard } from '../../../ui/components/shell/ShellListCard.tsx';
import { ShellScreenLayout } from '../../../ui/components/shell/ShellScreenLayout.tsx';
import { ShellSectionCard } from '../../../ui/components/shell/ShellSectionCard.tsx';

interface PlayerGuideScreenProps {
  rulesetId: string;
  onBackHome: () => void;
  presentation?: 'page' | 'modal';
}

export function PlayerGuideScreen({
  rulesetId,
  onBackHome,
  presentation = 'page',
}: PlayerGuideScreenProps) {
  const content = compileContent(rulesetId);
  return (
    <ShellScreenLayout
      presentation={presentation}
      tableClassName="shell-table guide-table"
      boardClassName="shell-board"
      eyebrow={t('ui.guide.playerGuide', 'Player Guide')}
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
        </div>
      )}
    >
      <div className="guidelines-story-grid">
        <ShellSectionCard icon="round" title={t('ui.guide.roundLoop', 'Round Loop')} className="shell-card">
          <p>{t('ui.guide.loop1', 'System Phase: resolve Crisis pressure, active System escalations, and interventions before the coalition can answer.')}</p>
          <p>{t('ui.guide.loop2', 'Coalition Phase: each seat prepares two moves, then all seats mark ready.')}</p>
          <p>{t('ui.guide.loop3', 'Resolution Phase: prepared moves resolve by priority, then the table checks victory, defeat, and mandate fallout.')}</p>
          <p>{t('ui.guide.loop4', 'Launch Campaign always resolves as 2d6 with target 8+, then modifiers and outcomes apply.')}</p>
          <p>{t('ui.guide.loop5', 'Scenario-specific victory gates can require a minimum round, a named action trigger, or gameplay progress before victory checks apply.')}</p>
        </ShellSectionCard>

        <ShellSectionCard icon="buildSolidarity" title={t('ui.guide.coordinationTension', 'Coordination with Tension')} className="shell-card">
          <p>{t('ui.guide.coordinationTension1', 'Cooperate on public survival: stop 6 Extraction breaches, protect Comrades, and keep pressure distributed.')}</p>
          <p>{t('ui.guide.coordinationTension2', 'Protect private lines at the same time: Secret Mandates can still collapse a public win in room play.')}</p>
          <p>{t('ui.guide.coordinationTension3', 'Queue order is strategy: place stabilizing actions first when you expect backlash or intervention.')}</p>
        </ShellSectionCard>

        <ShellSectionCard icon="globalGaze" title={t('ui.guide.boardReading', 'Board Reading')} className="shell-card">
          <p>{t('ui.guide.boardReading1', 'Scan regions at 4-5 Extraction first: those are immediate breach candidates next round.')}</p>
          <p>{t('ui.guide.boardReading2', 'Track Global Gaze and War Machine together; they forecast campaign risk and escalation pace.')}</p>
          <p>{t('ui.guide.boardReading3', 'Use Evidence where it shifts structural fronts, not only where it produces short-term relief.')}</p>
          <p>{t('ui.guide.boardReading4', 'Defense is temporary. Treat it as a timing shield, not permanent safety.')}</p>
        </ShellSectionCard>

        <ShellListCard
          className="shell-card"
          icon="seat"
          title={t('ui.guide.factions', 'Factions')}
          items={content.ruleset.factions.map((faction) => ({
            key: faction.id,
            label: localizeFactionField(faction.id, 'name', faction.name),
            description: `${localizeFactionField(faction.id, 'passive', faction.passive)} ${t('ui.game.weakness', 'Weakness')}: ${localizeFactionField(faction.id, 'weakness', faction.weakness)}`,
          }))}
        />
      </div>
    </ShellScreenLayout>
  );
}
