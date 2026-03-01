import { listScenarios } from '../../engine/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { getCivicSpaceLabel, localizeScenarioDefinition, t, type Locale } from '../i18n/index.ts';
import { EngravedHeader, PaperSheet, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

interface GuidelinesScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  scenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
  onBackHome: () => void;
  onOpenOffline: () => void;
}

const SCENARIOS = listScenarios();

function excerpt(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function GuidelinesScreen({
  locale,
  onLocaleChange,
  scenarioId,
  onSelectScenario,
  onBackHome,
  onOpenOffline,
}: GuidelinesScreenProps) {
  const localizedScenarios = SCENARIOS.map(localizeScenarioDefinition);
  const selectedScenario = localizedScenarios.find((scenario) => scenario.id === scenarioId) ?? localizedScenarios[0];

  if (!selectedScenario) {
    return null;
  }

  return (
    <TableSurface className="guidelines-table">
      <div className="guidelines-paper-layout">
        <PaperSheet tone="folio">
          <EngravedHeader
            eyebrow={t('ui.guidelines.eyebrow', 'Guidelines')}
            title={selectedScenario.name}
            detail={selectedScenario.description}
            actions={
              <div className="header-control-stack">
                <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
                <TabletopControls />
                <div className="header-action-plates">
                  <ThemePlate label={t('ui.guidelines.openOfflineMode', 'Open Offline Mode')} onClick={onOpenOffline} />
                  <ThemePlate label={t('ui.guidelines.home', 'Home')} onClick={onBackHome} />
                </div>
              </div>
            }
          />

          <div className="guideline-summary-grid">
            <PaperSheet tone="plain">
              <span className="engraved-eyebrow">{t('ui.guidelines.scenarioPulse', 'Scenario pulse')}</span>
              <div className="ledger-list">
                <div className="ledger-row"><span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span><strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong></div>
                <div className="ledger-row"><span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span><strong>+{selectedScenario.setup.temperature}°C</strong></div>
                <div className="ledger-row"><span>{t('ui.scenarioBooklet.roundWindow', 'Round window')}</span><strong>{t('ui.guidelines.roundWindowValue', '{{core}}-{{full}} rounds', { core: selectedScenario.roundLimit.CORE, full: selectedScenario.roundLimit.FULL })}</strong></div>
              </div>
            </PaperSheet>
            <PaperSheet tone="plain">
              <span className="engraved-eyebrow">{t('ui.guidelines.howItShouldFeel', 'How This Scenario Should Feel')}</span>
              <p>{selectedScenario.moralCenter}</p>
              <p>{selectedScenario.dramatization}</p>
            </PaperSheet>
          </div>
        </PaperSheet>

        <div className="guideline-dossier-grid">
          <PaperSheet tone="folio">
            <span className="engraved-eyebrow">{t('ui.guidelines.guidebook', 'Guidebook')}</span>
            <h2>{t('ui.guidelines.howItShouldFeel', 'How This Scenario Should Feel')}</h2>
            <div className="guideline-card-grid">
              <PaperSheet tone="plain">
                <h3>{t('ui.game.situation', 'Situation')}</h3>
                <p>{excerpt(selectedScenario.introduction, 240)}</p>
              </PaperSheet>
              <PaperSheet tone="plain">
                <h3>{t('ui.guidelines.playPattern', 'Play Pattern')}</h3>
                <p>{excerpt(selectedScenario.gameplay, 240)}</p>
              </PaperSheet>
              <PaperSheet tone="plain">
                <h3>{t('ui.guidelines.tableFeel', 'Table Feel')}</h3>
                <p>{excerpt(selectedScenario.dramatization, 240)}</p>
              </PaperSheet>
              <PaperSheet tone="plain">
                <h3>{t('ui.guidelines.mechanicalPressure', 'Mechanical Pressure')}</h3>
                <p>{excerpt(selectedScenario.mechanics, 240)}</p>
              </PaperSheet>
            </div>
            <div className="rule-slip-list">
              {selectedScenario.specialRuleChips.map((rule) => (
                <article key={rule.id} className="rule-slip">
                  <strong>{rule.label}</strong>
                  <p>{rule.description}</p>
                </article>
              ))}
            </div>
          </PaperSheet>

          <PaperSheet tone="folio">
            <span className="engraved-eyebrow">{t('ui.guidelines.scenarios', 'Scenarios')}</span>
            <h2>{t('ui.guidelines.switchGuide', 'Switch Guide')}</h2>
            <div className="scenario-card-grid">
              {localizedScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={`scenario-dossier-card ${scenario.id === selectedScenario.id ? 'is-active' : ''}`}
                  onClick={() => onSelectScenario(scenario.id)}
                >
                  <span className="engraved-eyebrow">
                    {scenario.id === selectedScenario.id ? t('ui.status.open', 'Open') : t('ui.guidelines.view', 'View')}
                  </span>
                  <strong>{scenario.name}</strong>
                  <p>{excerpt(scenario.description, 140)}</p>
                </button>
              ))}
            </div>
          </PaperSheet>
        </div>
      </div>
    </TableSurface>
  );
}
