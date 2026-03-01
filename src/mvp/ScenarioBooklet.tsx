import type { FrontId, RegionId, ScenarioDefinition } from '../../engine/index.ts';
import { getCivicSpaceLabel, getFrontLabel, getRegionLabel, t } from '../i18n/index.ts';

interface ScenarioBookletProps {
  scenarios: ScenarioDefinition[];
  selectedScenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
}

function getPressureProfile(scenario: ScenarioDefinition) {
  return Object.entries(scenario.setup.frontOverrides)
    .map(([frontId, stats]) => ({
      frontId,
      pressure: stats?.pressure ?? 0,
    }))
    .sort((left, right) => right.pressure - left.pressure)
    .slice(0, 3);
}

function getFeaturedRegions(scenario: ScenarioDefinition) {
  return Object.entries(scenario.setup.regionOverrides)
    .map(([regionId, override]) => ({
      regionId,
      weight:
        Object.values(override.vulnerability ?? {}).reduce((sum, value) => sum + (value ?? 0), 0) +
        Object.values(override.tokens ?? {}).reduce((sum, value) => sum + (value ?? 0), 0) +
        (override.locks?.length ?? 0),
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4)
    .map((entry) => entry.regionId);
}

export function ScenarioBooklet({ scenarios, selectedScenarioId, onSelectScenario }: ScenarioBookletProps) {
  if (scenarios.length === 0) {
    return null;
  }

  const currentIndex = Math.max(
    0,
    scenarios.findIndex((scenario) => scenario.id === selectedScenarioId),
  );
  const scenario = scenarios[currentIndex] ?? scenarios[0];
  const pressureProfile = getPressureProfile(scenario);
  const featuredRegions = getFeaturedRegions(scenario);

  return (
    <section className="booklet-section" id="scenario-booklet">
      <div className="booklet-header">
        <div>
          <span className="eyebrow">{t('ui.scenarioBooklet.eyebrow', 'Scenario Booklet')}</span>
          <h2>{t('ui.scenarioBooklet.title', 'Stories, rules, and table texture')}</h2>
          <p>{t('ui.scenarioBooklet.subtitle', 'Read each dossier like a spread from the campaign guide, then carry the selected chapter straight into setup.')}</p>
        </div>
        <div className="booklet-nav">
          <button
            className="secondary-button booklet-nav-button"
            disabled={currentIndex === 0}
            onClick={() => onSelectScenario(scenarios[currentIndex - 1].id)}
          >
            {t('ui.scenarioBooklet.previous', 'Previous Chapter')}
          </button>
          <button
            className="secondary-button booklet-nav-button"
            disabled={currentIndex === scenarios.length - 1}
            onClick={() => onSelectScenario(scenarios[currentIndex + 1].id)}
          >
            {t('ui.scenarioBooklet.next', 'Next Chapter')}
          </button>
        </div>
      </div>

      <div className="booklet-spread">
        <article className="booklet-paper">
          <span className="booklet-page-label">
            {t('ui.scenarioBooklet.chapter', 'Chapter {{chapter}}', {
              chapter: String(currentIndex + 1).padStart(2, '0'),
            })}
          </span>
          <p className="booklet-kicker">{scenario.description}</p>
          <h3>{scenario.name}</h3>
          <p className="booklet-lead">{scenario.introduction}</p>

          <div className="booklet-copy-block">
            <span className="booklet-copy-label">{t('ui.scenarioBooklet.story', 'Story')}</span>
            <p>{scenario.story}</p>
          </div>

          <div className="booklet-copy-block">
            <span className="booklet-copy-label">{t('ui.scenarioBooklet.dramatization', 'Dramatization')}</span>
            <p>{scenario.dramatization}</p>
          </div>
        </article>

        <article className="booklet-paper">
          <span className="booklet-page-label">{t('ui.scenarioBooklet.rulesFolio', 'Rules Folio')}</span>

          <div className="booklet-meta-grid">
            <div>
              <span>{t('ui.scenarioBooklet.moralCenter', 'Moral center')}</span>
              <strong>{scenario.moralCenter}</strong>
            </div>
            <div>
              <span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span>
              <strong>{getCivicSpaceLabel(scenario.setup.civicSpace)}</strong>
            </div>
            <div>
              <span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span>
              <strong>+{scenario.setup.temperature}°C</strong>
            </div>
            <div>
              <span>{t('ui.scenarioBooklet.roundWindow', 'Round window')}</span>
              <strong>
                {t('ui.scenarioBooklet.roundWindowValue', '{{core}} core / {{full}} full', {
                  core: scenario.roundLimit.CORE,
                  full: scenario.roundLimit.FULL,
                })}
              </strong>
            </div>
          </div>

          <div className="booklet-copy-block">
            <span className="booklet-copy-label">{t('ui.scenarioBooklet.gameplay', 'Gameplay')}</span>
            <p>{scenario.gameplay}</p>
          </div>

          <div className="booklet-copy-block">
            <span className="booklet-copy-label">{t('ui.scenarioBooklet.mechanics', 'Mechanics')}</span>
            <p>{scenario.mechanics}</p>
          </div>

          <div className="booklet-insight-grid">
            <div className="booklet-note">
              <span className="booklet-copy-label">{t('ui.scenarioBooklet.pressureProfile', 'Pressure Profile')}</span>
              <div className="hero-tags">
                {pressureProfile.map((front) => (
                  <span key={front.frontId}>
                    {getFrontLabel(front.frontId as FrontId)} {front.pressure}
                  </span>
                ))}
              </div>
            </div>

            <div className="booklet-note">
              <span className="booklet-copy-label">{t('ui.scenarioBooklet.featuredRegions', 'Featured Regions')}</span>
              <div className="hero-tags">
                {featuredRegions.map((regionId) => (
                  <span key={regionId}>{getRegionLabel(regionId as RegionId)}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="booklet-rule-grid">
            {scenario.specialRuleChips.map((rule) => (
              <div key={rule.id} className="booklet-rule-card">
                <strong>{rule.label}</strong>
                <p>{rule.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="booklet-chapter-rail">
        {scenarios.map((entry, index) => (
          <article key={entry.id} className={`booklet-chapter-card ${entry.id === scenario.id ? 'active' : ''}`}>
            <button type="button" className="booklet-chapter-main" onClick={() => onSelectScenario(entry.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{entry.name}</strong>
              <p>{entry.description}</p>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
