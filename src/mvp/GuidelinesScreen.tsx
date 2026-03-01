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
    <TableSurface className="guidelines-table dossier-table">
      <div className="guidelines-paper-layout dossier-layout">
        <header className="setup-header">
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
        </header>

        <main className="dossier-board">
          <PaperSheet tone="folio" className="dossier-cover">
            <span className="engraved-eyebrow">{t('ui.guidelines.scenarioPulse', 'Scenario pulse')}</span>
            <h2>{selectedScenario.name}</h2>
            <p>{excerpt(selectedScenario.moralCenter, 160)}</p>
            <div className="setup-stat-ribbon">
              <div><span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span><strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong></div>
              <div><span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span><strong>+{selectedScenario.setup.temperature}°C</strong></div>
              <div><span>{t('ui.scenarioBooklet.roundWindow', 'Round window')}</span><strong>{t('ui.guidelines.roundWindowValue', '{{core}}-{{full}} rounds', { core: selectedScenario.roundLimit.CORE, full: selectedScenario.roundLimit.FULL })}</strong></div>
            </div>
          </PaperSheet>

          <PaperSheet tone="booklet" className="dossier-spread">
            <section className="dossier-page">
              <span className="engraved-eyebrow">{t('ui.game.situation', 'Situation')}</span>
              <h3>{t('ui.guidelines.howItShouldFeel', 'How This Scenario Should Feel')}</h3>
              <p>{excerpt(selectedScenario.introduction, 260)}</p>
              <p>{excerpt(selectedScenario.dramatization, 260)}</p>
            </section>
            <section className="dossier-page">
              <span className="engraved-eyebrow">{t('ui.guidelines.playPattern', 'Play Pattern')}</span>
              <h3>{t('ui.guidelines.mechanicalPressure', 'Mechanical Pressure')}</h3>
              <p>{excerpt(selectedScenario.gameplay, 260)}</p>
              <p>{excerpt(selectedScenario.mechanics, 260)}</p>
            </section>
          </PaperSheet>

          <div className="setup-rule-chips dossier-rule-slips">
            {selectedScenario.specialRuleChips.map((rule) => (
              <article key={rule.id} className="rule-slip">
                <strong>{rule.label}</strong>
                <p>{rule.description}</p>
              </article>
            ))}
          </div>

          <PaperSheet tone="tray" className="dossier-switch-rail">
            <span className="engraved-eyebrow">{t('ui.guidelines.scenarios', 'Scenarios')}</span>
            <div className="scenario-card-grid compact-scenario-rail">
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
                  <p>{excerpt(scenario.description, 90)}</p>
                </button>
              ))}
            </div>
          </PaperSheet>
        </main>
      </div>
    </TableSurface>
  );
}
