import { listScenarios } from '../../engine/index.ts';
import { getCivicSpaceLabel, localizeScenarioDefinition } from '../i18n/index.ts';

interface GuidelinesScreenProps {
  scenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
  onBackHome: () => void;
  onOpenOffline: () => void;
}

const SCENARIOS = listScenarios().map(localizeScenarioDefinition);

function excerpt(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function GuidelinesScreen({
  scenarioId,
  onSelectScenario,
  onBackHome,
  onOpenOffline,
}: GuidelinesScreenProps) {
  const selectedScenario = SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? SCENARIOS[0];

  if (!selectedScenario) {
    return null;
  }

  return (
    <div className="home-shell guidelines-shell">
      <section className="hero-panel guidelines-hero">
        <div className="hero-copy">
          <span className="eyebrow">Guidelines</span>
          <h1>{selectedScenario.name}</h1>
          <p>{selectedScenario.description}</p>
          <div className="hero-actions">
            <button className="primary-button hero-action-button" onClick={onOpenOffline}>
              Open Offline Mode
            </button>
            <button className="secondary-button hero-action-button" onClick={onBackHome}>
              Home
            </button>
          </div>
        </div>

        <div className="hero-brief scenario-hero-brief compact-brief">
          <span className="eyebrow">Scenario pulse</span>
          <div className="scenario-brief-metrics">
            <div>
              <span>Civic space</span>
              <strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong>
            </div>
            <div>
              <span>Starting heat</span>
              <strong>+{selectedScenario.setup.temperature}°C</strong>
            </div>
            <div>
              <span>Round window</span>
              <strong>
                {selectedScenario.roundLimit.CORE}-{selectedScenario.roundLimit.FULL} rounds
              </strong>
            </div>
          </div>
          <p>{selectedScenario.moralCenter}</p>
        </div>
      </section>

      <section className="panel guidelines-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Guidebook</span>
            <h2>How This Scenario Should Feel</h2>
          </div>
        </div>

        <div className="guidelines-grid">
          <article className="story-block">
            <h3>Situation</h3>
            <p>{excerpt(selectedScenario.introduction, 240)}</p>
          </article>
          <article className="story-block">
            <h3>Play Pattern</h3>
            <p>{excerpt(selectedScenario.gameplay, 240)}</p>
          </article>
          <article className="story-block">
            <h3>Table Feel</h3>
            <p>{excerpt(selectedScenario.dramatization, 240)}</p>
          </article>
          <article className="story-block">
            <h3>Mechanical Pressure</h3>
            <p>{excerpt(selectedScenario.mechanics, 240)}</p>
          </article>
        </div>

        <div className="guidelines-rules">
          {selectedScenario.specialRuleChips.map((rule) => (
            <article key={rule.id} className="rule-feature active">
              <strong>{rule.label}</strong>
              <p>{rule.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel guidelines-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Scenarios</span>
            <h2>Switch Guide</h2>
          </div>
        </div>
        <div className="scenario-card-grid">
          {SCENARIOS.map((scenario) => (
            <article key={scenario.id} className={`scenario-choice-card ${scenario.id === selectedScenario.id ? 'active' : ''}`}>
              <button type="button" className="scenario-choice-main" onClick={() => onSelectScenario(scenario.id)}>
                <div className="row-split">
                  <strong>{scenario.name}</strong>
                  <span className="status-pill neutral">{scenario.id === selectedScenario.id ? 'Open' : 'View'}</span>
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
