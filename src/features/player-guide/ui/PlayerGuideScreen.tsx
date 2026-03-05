import { compileContent } from '../../../engine/index.ts';
import {
  localizeFactionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
import { GameIcon } from '../../../ui/icon/GameIcon.tsx';
import { EngravedHeader, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

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
  const guideContent = (
    <PaperSheet tone="board" className="shell-board shell-surface shell-surface-focus">
        <EngravedHeader
          eyebrow={t('ui.guide.playerGuide', 'Player Guide')}
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
            </div>
          }
        />

        <div className="guidelines-story-grid">
          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="round" size="xs" ariaLabel={t('ui.guide.roundLoop', 'Round Loop')} />{t('ui.guide.roundLoop', 'Round Loop')}</span>
            <p>{t('ui.guide.loop1', 'System Phase: resolve Crisis pressure, active System escalations, and interventions before the coalition can answer.')}</p>
            <p>{t('ui.guide.loop2', 'Coalition Phase: each seat prepares two moves, then all seats mark ready.')}</p>
            <p>{t('ui.guide.loop3', 'Resolution Phase: prepared moves resolve by priority, then the table checks victory, defeat, and mandate fallout.')}</p>
            <p>{t('ui.guide.loop4', 'Launch Campaign always resolves as 2d6 with target 8+, then modifiers and outcomes apply.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="buildSolidarity" size="xs" ariaLabel={t('ui.guide.coordinationTension', 'Coordination with Tension')} />{t('ui.guide.coordinationTension', 'Coordination with Tension')}</span>
            <p>{t('ui.guide.coordinationTension1', 'Cooperate on public survival: stop 6 Extraction breaches, protect Comrades, and keep pressure distributed.')}</p>
            <p>{t('ui.guide.coordinationTension2', 'Protect private lines at the same time: Secret Mandates can still collapse a public win in room play.')}</p>
            <p>{t('ui.guide.coordinationTension3', 'Queue order is strategy: place stabilizing actions first when you expect backlash or intervention.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="globalGaze" size="xs" ariaLabel={t('ui.guide.boardReading', 'Board Reading')} />{t('ui.guide.boardReading', 'Board Reading')}</span>
            <p>{t('ui.guide.boardReading1', 'Scan regions at 4-5 Extraction first: those are immediate breach candidates next round.')}</p>
            <p>{t('ui.guide.boardReading2', 'Track Global Gaze and War Machine together; they forecast campaign risk and escalation pace.')}</p>
            <p>{t('ui.guide.boardReading3', 'Use Evidence where it shifts structural fronts, not only where it produces short-term relief.')}</p>
            <p>{t('ui.guide.boardReading4', 'Defense is temporary. Treat it as a timing shield, not permanent safety.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray" className="shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="seat" size="xs" ariaLabel={t('ui.guide.factions', 'Factions')} />{t('ui.guide.factions', 'Factions')}</span>
            <ul className="shell-list">
              {content.ruleset.factions.map((faction) => (
                <li key={faction.id} className="shell-list-item">
                  <Icon type="check" size="xs" ariaLabel={localizeFactionField(faction.id, 'name', faction.name)} ariaHidden />
                  <span><strong>{localizeFactionField(faction.id, 'name', faction.name)}:</strong> {localizeFactionField(faction.id, 'passive', faction.passive)} {t('ui.game.weakness', 'Weakness')}: {localizeFactionField(faction.id, 'weakness', faction.weakness)}</span>
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
    <TableSurface className="guide-table shell-table shell-depth-surface">
      {guideContent}
    </TableSurface>
  );
}
