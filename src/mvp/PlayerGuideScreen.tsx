import { compileContent } from '../../engine/index.ts';
import {
  localizeFactionField,
  t,
  type Locale,
} from '../i18n/index.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from './tabletop.tsx';

interface PlayerGuideScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onBackHome: () => void;
}

const content = compileContent('base_design');

export function PlayerGuideScreen({ locale, onLocaleChange, onBackHome }: PlayerGuideScreenProps) {
  return (
    <TableSurface className="guide-table">
      <PaperSheet tone="board" className="guide-tab-rail">
        <EngravedHeader
          eyebrow={t('ui.guide.playerGuide', 'Player Guide')}
          title={t('ui.guide.coalitionFieldNotes', 'Coalition Field Notes')}
          detail={t('ui.guide.playerGuideDetail', 'Use this as the fast onboard for the cutover ruleset.')}
          actions={
            <div className="header-action-plates">
              <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
              <ThemePlate label={t('ui.guide.backHome', 'Back Home')} onClick={onBackHome} />
            </div>
          }
        />

        <div className="guidelines-story-grid">
          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.roundLoop', 'Round Loop')}</span>
            <ol>
              <li>{t('ui.guide.loop1', 'System Phase: resolve system cards, backlash, and interventions.')}</li>
              <li>{t('ui.guide.loop2', 'Coalition Phase: queue two actions for each seat, then mark every seat ready.')}</li>
              <li>{t('ui.guide.loop3', 'Resolution Phase: resolve queued actions in priority order, then check victory and defeat.')}</li>
            </ol>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.economy', 'Economy')}</span>
            <p>{t('ui.guide.economy1', 'Bodies live in regions and are spent from those regions.')}</p>
            <p>{t('ui.guide.economy2', 'Evidence belongs to seats and powers campaigns, outreach, and support work.')}</p>
            <p>{t('ui.guide.economy3', 'Defense is temporary and only exists to blunt the next system strike.')}</p>
          </PaperSheet>

          <PaperSheet tone="tray">
            <span className="engraved-eyebrow">{t('ui.guide.beaconsMandates', 'Beacons and Mandates')}</span>
            <p>{t('ui.guide.beacon1', 'Symbolic mode activates three Beacons from a six-card deck.')}</p>
            <p>{t('ui.guide.beacon2', 'Every faction carries a secret mandate. Reaching the public win condition without satisfying all mandates still ends in failure.')}</p>
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
