import { compileContent } from '../../../engine/index.ts';
import {
  localizeFactionField,
  t,
} from '../../../i18n/index.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface PlayerGuideScreenProps {
  onBackHome: () => void;
}

const content = compileContent('base_design');

export function PlayerGuideScreen({ onBackHome }: PlayerGuideScreenProps) {
  return (
    <TableSurface className="guide-table">
      <PaperSheet tone="board" className="guide-tab-rail">
        <EngravedHeader
          eyebrow={t('ui.guide.playerGuide', 'Player Guide')}
          title={t('ui.guide.coalitionFieldNotes', 'Coalition Field Notes')}
          detail={t('ui.guide.playerGuideDetail', 'Use this as the fast onboard for the current ruleset.')}
          actions={
            <div className="header-action-plates">
              <LocaleSwitcher />
              <ThemePlate label={t('ui.guide.backHome', 'Back Home')} onClick={onBackHome} />
            </div>
          }
        />

        <div className="guidelines-story-grid">
          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.roundLoop', 'Round Loop')}</span>
            <p>{t('ui.guide.loop1', 'System Phase: resolve Crisis pressure, active System escalations, and interventions before the coalition can answer.')}</p>
            <p>{t('ui.guide.loop2', 'Coalition Phase: each seat prepares two moves, then all seats mark ready.')}</p>
            <p>{t('ui.guide.loop3', 'Resolution Phase: prepared moves resolve by priority, then the table checks victory, defeat, and mandate fallout.')}</p>
            <p>{t('ui.guide.loop4', 'Launch Campaign always resolves as 2d6 with target 8+, then modifiers and outcomes apply.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.coordinationTension', 'Coordination with Tension')}</span>
            <p>{t('ui.guide.coordinationTension1', 'Cooperate on public survival: stop 6 Extraction breaches, protect Comrades, and keep pressure distributed.')}</p>
            <p>{t('ui.guide.coordinationTension2', 'Protect private lines at the same time: Secret Mandates can still collapse a public win in room play.')}</p>
            <p>{t('ui.guide.coordinationTension3', 'Queue order is strategy: place stabilizing actions first when you expect backlash or intervention.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.boardReading', 'Board Reading')}</span>
            <p>{t('ui.guide.boardReading1', 'Scan regions at 4-5 Extraction first: those are immediate breach candidates next round.')}</p>
            <p>{t('ui.guide.boardReading2', 'Track Global Gaze and War Machine together; they forecast campaign risk and escalation pace.')}</p>
            <p>{t('ui.guide.boardReading3', 'Use Evidence where it shifts structural fronts, not only where it produces short-term relief.')}</p>
            <p>{t('ui.guide.boardReading4', 'Defense is temporary. Treat it as a timing shield, not permanent safety.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.factions', 'Factions')}</span>
            <ul>
              {content.ruleset.factions.map((faction) => (
                <li key={faction.id}>
                  <strong>{localizeFactionField(faction.id, 'name', faction.name)}:</strong> {localizeFactionField(faction.id, 'passive', faction.passive)} {t('ui.game.weakness', 'Weakness')}: {localizeFactionField(faction.id, 'weakness', faction.weakness)}
                </li>
              ))}
            </ul>
          </PaperSheet>
        </div>
      </PaperSheet>
    </TableSurface>
  );
}
