import { useState } from 'react';
import { listScenarios, type GameMode, type RoleId } from '../../engine/index.ts';
import { getCivicSpaceLabel, getRoleName, localizeScenarioDefinition, t, type Locale } from '../i18n/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import type { SetupConfig } from './urlState.ts';

interface HomeScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  config: SetupConfig;
  hasAutosave: boolean;
  onConfigChange: (patch: Partial<SetupConfig>) => void;
  onStart: (config: SetupConfig) => void;
  onLoadSave: (serialized: string) => void;
  onLoadAutosave: () => void;
  onOpenGuidelines: (scenarioId: string) => void;
  mode?: 'home' | 'offline';
}

const ROLE_OPTIONS: Array<{ id: RoleId }> = [
  { id: 'organizer' },
  { id: 'investigative_journalist' },
  { id: 'human_rights_lawyer' },
  { id: 'climate_energy_planner' },
];

const SCENARIOS = listScenarios();

function excerpt(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function HomeScreen({
  locale,
  onLocaleChange,
  config,
  hasAutosave,
  onConfigChange,
  onStart,
  onLoadSave,
  onLoadAutosave,
  onOpenGuidelines,
  mode = 'home',
}: HomeScreenProps) {
  const [saveText, setSaveText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const localizedScenarios = SCENARIOS.map(localizeScenarioDefinition);
  const selectedScenario = localizedScenarios.find((scenario) => scenario.id === config.scenarioId) ?? localizedScenarios[0];
  const selectedRoles = config.roleIds.slice(0, config.playerCount);
  const hasDuplicateRoles = new Set(selectedRoles).size !== selectedRoles.length;

  const updateRole = (seat: number, roleId: RoleId) => {
    const nextRoles = config.roleIds.slice();
    nextRoles[seat] = roleId;
    onConfigChange({ roleIds: nextRoles });
  };

  if (!selectedScenario) {
    return (
      <div className="home-screen">
        <section className="shell-panel home-empty-state">
          <h2>{t('ui.home.noScenariosTitle', 'No scenarios found')}</h2>
          <p>{t('ui.home.noScenariosBody', 'The content registry did not return any playable scenarios.')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="home-screen">
      <section className="shell-panel home-hero">
        <div className="home-hero-copy">
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
          <span className="eyebrow">{t('ui.home.eyebrow', 'Playable MVP')}</span>
          <h1>{t('ui.home.title', 'Dignity Rising')}</h1>
          <p>
            {t(
              'ui.home.subtitle',
              'A cooperative strategy game about protecting civilians, defending truth, and building institutions under the pressure of a systemic antagonist.',
            )}
          </p>
          <div className="home-stat-grid">
            <article className="shell-card">
              <span className="eyebrow">{t('ui.home.scenario', 'Scenario')}</span>
              <strong>{localizedScenarios.length}</strong>
              <p>{t('ui.home.distinctCrisisFrames', 'Distinct crisis frames.')}</p>
            </article>
            <article className="shell-card">
              <span className="eyebrow">{t('ui.home.playerCount', 'Player Count')}</span>
              <strong>{config.playerCount}</strong>
              <p>{t('ui.home.seatsConfigured', 'Seats configured for this table.')}</p>
            </article>
            <article className="shell-card">
              <span className="eyebrow">{t('ui.home.mode', 'Mode')}</span>
              <strong>{config.mode}</strong>
              <p>{config.surface === 'local' ? t('ui.home.sameScreenTable', 'Same-screen table.') : t('ui.home.syncedRoomSession', 'Synced room session.')}</p>
            </article>
          </div>
          <div className="home-action-row">
            <button
              className="primary-button"
              disabled={hasDuplicateRoles}
              onClick={() => {
                if (hasDuplicateRoles) {
                  setError(t('ui.home.rolesMustBeUnique', 'Roles must be unique.'));
                  return;
                }

                setError(null);
                onStart({ ...config, scenarioId: selectedScenario.id, roleIds: selectedRoles });
              }}
            >
              {config.surface === 'local'
                ? t('ui.home.startLocal', 'Start Local Table')
                : t('ui.home.createRoom', 'Create Room')}
            </button>
            {hasAutosave && (
              <button className="secondary-button" onClick={onLoadAutosave}>
                {t('ui.home.loadAutosave', 'Load Autosave')}
              </button>
            )}
            <button className="secondary-button" onClick={() => onOpenGuidelines(selectedScenario.id)}>
              {mode === 'offline'
                ? t('ui.home.scenarioGuidelines', 'Scenario Guidelines')
                : t('ui.home.openGuidelines', 'Open Guidelines')}
            </button>
          </div>
        </div>

        <aside className="home-hero-aside shell-card">
          <span className="eyebrow">{t('ui.home.selectedChapter', 'Selected Chapter')}</span>
          <h2>{selectedScenario.name}</h2>
          <p>{excerpt(selectedScenario.description, 130)}</p>
          <div className="home-scenario-metrics">
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
                {t('ui.home.roundWindow', '{{core}} core rounds / {{full}} full rounds', {
                  core: selectedScenario.roundLimit.CORE,
                  full: selectedScenario.roundLimit.FULL,
                })}
              </strong>
            </div>
          </div>
          <div className="home-story-grid">
            <article>
              <span className="eyebrow">{t('ui.home.premise', 'Premise')}</span>
              <p>{excerpt(selectedScenario.introduction, 170)}</p>
            </article>
            <article>
              <span className="eyebrow">{t('ui.home.playPressure', 'Play pressure')}</span>
              <p>{excerpt(selectedScenario.gameplay, 170)}</p>
            </article>
          </div>
        </aside>
      </section>

      <section className="home-dashboard">
        <div className="shell-panel home-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('ui.home.scenarioMenu', 'Scenario Menu')}</span>
              <h3>{t('ui.home.scenario', 'Scenario')}</h3>
            </div>
          </div>
          <div className="home-scenario-grid">
            {localizedScenarios.map((scenario) => {
              const active = scenario.id === selectedScenario.id;

              return (
                <article key={scenario.id} className={`home-scenario-card shell-card ${active ? 'is-active' : ''}`}>
                  <button type="button" className="home-scenario-trigger" onClick={() => onConfigChange({ scenarioId: scenario.id })}>
                    <div className="row-split">
                      <strong>{scenario.name}</strong>
                      <span className="status-pill neutral">{active ? t('ui.home.selected', 'Selected') : t('ui.home.available', 'Available')}</span>
                    </div>
                    <p>{excerpt(scenario.description, 120)}</p>
                    <div className="chip-row">
                      <span className="rule-chip">{getCivicSpaceLabel(scenario.setup.civicSpace)}</span>
                      <span className="rule-chip">+{scenario.setup.temperature}°C</span>
                      <span className="rule-chip">{scenario.roundLimit.CORE}-{scenario.roundLimit.FULL} rounds</span>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="home-dashboard-side">
          <div className="shell-panel home-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t('ui.home.launch', 'Launch')}</span>
                <h3>{t('ui.home.tableConfiguration', 'Table Configuration')}</h3>
              </div>
            </div>
            <div className="segmented">
              <button className={config.surface === 'local' ? 'active' : ''} onClick={() => onConfigChange({ surface: 'local' })}>
                {t('ui.home.localTable', 'Local Table')}
              </button>
              <button className={config.surface === 'room' ? 'active' : ''} onClick={() => onConfigChange({ surface: 'room' })}>
                {t('ui.home.roomPlay', 'Room Play')}
              </button>
            </div>

            <div className="home-form-grid">
              <label>
                {t('ui.home.mode', 'Mode')}
                <select value={config.mode} onChange={(event) => onConfigChange({ mode: event.target.value as GameMode })}>
                  <option value="CORE">{t('ui.home.modeCore', 'Core')}</option>
                  <option value="FULL">{t('ui.home.modeFull', 'Full')}</option>
                </select>
              </label>

              <label>
                {t('ui.home.playerCount', 'Player Count')}
                <select
                  value={config.playerCount}
                  onChange={(event) => onConfigChange({ playerCount: Number(event.target.value) as 2 | 3 | 4 })}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
            </div>

            {config.surface === 'room' && (
              <label>
                {t('ui.home.roomUrl', 'Room Service URL')}
                <input
                  type="text"
                  value={config.roomUrl}
                  onChange={(event) => onConfigChange({ roomUrl: event.target.value })}
                  placeholder="http://localhost:3010"
                />
              </label>
            )}

            {error && <p className="inline-error">{error}</p>}
          </div>

          <div className="shell-panel home-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t('ui.home.coalitionSeats', 'Coalition Seats')}</span>
                <h3>{t('ui.home.seatAssignments', 'Seat Assignments')}</h3>
              </div>
            </div>
            <div className="home-seat-grid">
              {Array.from({ length: config.playerCount }).map((_, seat) => (
                <article key={seat} className="shell-card home-seat-card">
                  <label>
                    {t('ui.home.seatLabel', 'Seat {{seat}}', { seat: seat + 1 })}
                    <select value={selectedRoles[seat]} onChange={(event) => updateRole(seat, event.target.value as RoleId)}>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.id} value={role.id}>
                          {getRoleName(role.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>{selectedRoles[seat] ? getRoleName(selectedRoles[seat]) : ''}</p>
                </article>
              ))}
            </div>
            {hasDuplicateRoles && <p className="inline-error">{t('ui.home.rolesMustBeUnique', 'Roles must be unique.')}</p>}
          </div>

          <div className="shell-panel home-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t('ui.home.loadSave', 'Load Save')}</span>
                <h3>{t('ui.home.utilities', 'Utilities')}</h3>
              </div>
            </div>
            <textarea
              value={saveText}
              onChange={(event) => setSaveText(event.target.value)}
              placeholder={t('ui.home.savePlaceholder', 'Paste a serialized save payload here.')}
            />
            <button
              className="secondary-button"
              onClick={() => {
                if (!saveText.trim()) {
                  setError(t('ui.home.pasteSaveFirst', 'Paste a save payload first.'));
                  return;
                }

                setError(null);
                onLoadSave(saveText);
              }}
            >
              {t('ui.home.loadSaveButton', 'Load Save Into Local Table')}
            </button>
            <p className="panel-footnote">
              {t('ui.home.routesStayStable', 'Routes stay stable while the selected scenario and active table state change underneath.')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
