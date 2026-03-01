import { listScenarios } from '../../engine/index.ts';
import { getCivicSpaceLabel, localizeScenarioDefinition, t, type Locale } from '../i18n/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';

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
    <div className="guidelines-screen">
      <section className="shell-panel guidelines-hero">
        <div className="guidelines-hero-copy">
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
          <span className="eyebrow">{t('ui.guidelines.eyebrow', 'Guidelines')}</span>
          <h1>{selectedScenario.name}</h1>
          <p>{selectedScenario.description}</p>
          <div className="guidelines-action-row">
            <button className="primary-button" onClick={onOpenOffline}>
              {t('ui.guidelines.openOfflineMode', 'Open Offline Mode')}
            </button>
            <button className="secondary-button" onClick={onBackHome}>
              {t('ui.guidelines.home', 'Home')}
            </button>
          </div>
        </div>

        <aside className="shell-card guidelines-hero-aside">
          <span className="eyebrow">{t('ui.guidelines.scenarioPulse', 'Scenario pulse')}</span>
          <div className="guidelines-stat-grid">
            <div>
              <span className="eyebrow">{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span>
              <strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong>
            </div>
            <div>
              <span className="eyebrow">{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span>
              <strong>+{selectedScenario.setup.temperature}°C</strong>
            </div>
            <div>
              <span className="eyebrow">{t('ui.scenarioBooklet.roundWindow', 'Round window')}</span>
              <strong>
                {t('ui.guidelines.roundWindowValue', '{{core}}-{{full}} rounds', {
                  core: selectedScenario.roundLimit.CORE,
                  full: selectedScenario.roundLimit.FULL,
                })}
              </strong>
            </div>
          </div>
          <p>{selectedScenario.moralCenter}</p>
        </aside>
      </section>

      <section className="shell-panel guidelines-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('ui.guidelines.guidebook', 'Guidebook')}</span>
            <h2>{t('ui.guidelines.howItShouldFeel', 'How This Scenario Should Feel')}</h2>
          </div>
        </div>

        <div className="guidelines-story-grid">
          <article className="shell-card">
            <h3>{t('ui.game.situation', 'Situation')}</h3>
            <p>{excerpt(selectedScenario.introduction, 240)}</p>
          </article>
          <article className="shell-card">
            <h3>{t('ui.guidelines.playPattern', 'Play Pattern')}</h3>
            <p>{excerpt(selectedScenario.gameplay, 240)}</p>
          </article>
          <article className="shell-card">
            <h3>{t('ui.guidelines.tableFeel', 'Table Feel')}</h3>
            <p>{excerpt(selectedScenario.dramatization, 240)}</p>
          </article>
          <article className="shell-card">
            <h3>{t('ui.guidelines.mechanicalPressure', 'Mechanical Pressure')}</h3>
            <p>{excerpt(selectedScenario.mechanics, 240)}</p>
          </article>
        </div>

        <div className="guidelines-rule-grid">
          {selectedScenario.specialRuleChips.map((rule) => (
            <article key={rule.id} className="shell-card guidelines-rule-card">
              <strong>{rule.label}</strong>
              <p>{rule.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell-panel guidelines-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t('ui.guidelines.scenarios', 'Scenarios')}</span>
            <h2>{t('ui.guidelines.switchGuide', 'Switch Guide')}</h2>
          </div>
        </div>
        <div className="guidelines-switch-grid">
          {localizedScenarios.map((scenario) => (
            <article key={scenario.id} className={`shell-card guidelines-switch-card ${scenario.id === selectedScenario.id ? 'is-active' : ''}`}>
              <button type="button" className="guidelines-switch-trigger" onClick={() => onSelectScenario(scenario.id)}>
                <div className="row-split">
                  <strong>{scenario.name}</strong>
                  <span className="status-pill neutral">
                    {scenario.id === selectedScenario.id ? t('ui.status.open', 'Open') : t('ui.guidelines.view', 'View')}
                  </span>
                </div>
                <p>{excerpt(scenario.description, 120)}</p>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
