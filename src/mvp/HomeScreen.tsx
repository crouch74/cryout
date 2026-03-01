import { useState } from 'react';
import { listScenarios, type GameMode, type RoleId } from '../../engine/index.ts';
import { getCivicSpaceLabel, getRoleName, localizeScenarioDefinition, t } from '../i18n/index.ts';
import type { SetupConfig } from './urlState.ts';

interface HomeScreenProps {
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
      <div className="home-shell">
        <section className="panel">
          <h2>{t('ui.home.noScenariosTitle', 'No scenarios found')}</h2>
          <p>{t('ui.home.noScenariosBody', 'The content registry did not return any playable scenarios.')}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="home-shell">
      <section className="hero-panel home-command-center">
        <div className="hero-copy">
          <span className="eyebrow">{t('ui.home.eyebrow', 'Playable MVP')}</span>
          <h1>{t('ui.home.title', 'Dignity Rising')}</h1>
          <p>
            {t(
              'ui.home.subtitle',
              'A cooperative strategy game about protecting civilians, defending truth, and building institutions under the pressure of a systemic antagonist.',
            )}
          </p>
          <div className="home-stat-strip">
            <article>
              <span>{t('ui.home.scenario', 'Scenario')}</span>
              <strong>{localizedScenarios.length}</strong>
              <small>Distinct crisis frames</small>
            </article>
            <article>
              <span>{t('ui.home.playerCount', 'Player Count')}</span>
              <strong>{config.playerCount}</strong>
              <small>Seats configured</small>
            </article>
            <article>
              <span>{t('ui.home.mode', 'Mode')}</span>
              <strong>{config.mode}</strong>
              <small>{config.surface === 'local' ? 'Same-screen table' : 'Synced room session'}</small>
            </article>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button hero-action-button"
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
              <button className="secondary-button hero-action-button" onClick={onLoadAutosave}>
                {t('ui.home.loadAutosave', 'Load Autosave')}
              </button>
            )}
            <button className="secondary-button hero-action-button" onClick={() => onOpenGuidelines(selectedScenario.id)}>
              {mode === 'offline' ? 'Scenario Guidelines' : 'Open Guidelines'}
            </button>
          </div>
        </div>

        <div className="hero-brief scenario-hero-brief compact-brief">
          <span className="eyebrow">{t('ui.home.selectedChapter', 'Selected Chapter')}</span>
          <h2>{selectedScenario.name}</h2>
          <p>{excerpt(selectedScenario.description, 130)}</p>
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
                {t('ui.home.roundWindow', '{{core}} core rounds / {{full}} full rounds', {
                  core: selectedScenario.roundLimit.CORE,
                  full: selectedScenario.roundLimit.FULL,
                })}
              </strong>
            </div>
          </div>
          <div className="compact-story-grid">
            <article>
              <span>Premise</span>
              <p>{excerpt(selectedScenario.introduction, 170)}</p>
            </article>
            <article>
              <span>Play pressure</span>
              <p>{excerpt(selectedScenario.gameplay, 170)}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-dashboard">
        <div className="panel home-panel scenarios-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Scenario Menu</span>
              <h3>{t('ui.home.scenario', 'Scenario')}</h3>
            </div>
          </div>
          <div className="scenario-card-grid">
            {localizedScenarios.map((scenario) => {
              const active = scenario.id === selectedScenario.id;

              return (
                <article key={scenario.id} className={`scenario-choice-card ${active ? 'active' : ''}`}>
                  <button type="button" className="scenario-choice-main" onClick={() => onConfigChange({ scenarioId: scenario.id })}>
                    <div className="row-split">
                      <strong>{scenario.name}</strong>
                      <span className="status-pill neutral">{active ? 'Selected' : 'Available'}</span>
                    </div>
                    <p>{excerpt(scenario.description, 120)}</p>
                    <div className="scenario-choice-meta">
                      <span>{getCivicSpaceLabel(scenario.setup.civicSpace)}</span>
                      <span>+{scenario.setup.temperature}°C</span>
                      <span>{scenario.roundLimit.CORE}-{scenario.roundLimit.FULL} rounds</span>
                    </div>
                    <div className="chip-row">
                      {scenario.specialRuleChips.slice(0, 2).map((rule) => (
                        <span key={rule.id} className="rule-chip">
                          {rule.label}
                        </span>
                      ))}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="panel home-panel launch-panel" id="table-setup">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('ui.home.launch', 'Launch')}</span>
              <h3>Table Configuration</h3>
            </div>
          </div>
          <div className="segmented">
            <button
              className={config.surface === 'local' ? 'active' : ''}
              onClick={() => onConfigChange({ surface: 'local' })}
            >
              {t('ui.home.localTable', 'Local Table')}
            </button>
            <button
              className={config.surface === 'room' ? 'active' : ''}
              onClick={() => onConfigChange({ surface: 'room' })}
            >
              {t('ui.home.roomPlay', 'Room Play')}
            </button>
          </div>

          <div className="launch-form-grid compact-launch-form-grid">
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

        <div className="panel home-panel coalition-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('ui.home.coalitionSeats', 'Coalition Seats')}</span>
              <h3>Seat Assignments</h3>
            </div>
          </div>
          <div className="seat-grid">
            {Array.from({ length: config.playerCount }).map((_, seat) => (
              <article key={seat} className="seat-assignment-card">
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
                <p>{selectedRoles[seat] ? ROLE_OPTIONS.find((role) => role.id === selectedRoles[seat]) && getRoleName(selectedRoles[seat]) : ''}</p>
              </article>
            ))}
          </div>
          {hasDuplicateRoles && <p className="inline-error">{t('ui.home.rolesMustBeUnique', 'Roles must be unique.')}</p>}
        </div>

        <div className="panel home-panel save-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('ui.home.loadSave', 'Load Save')}</span>
              <h3>Utilities</h3>
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
          <p className="panel-footnote">URLs stay in sync with the active scenario and table configuration.</p>
        </div>
      </section>
    </div>
  );
}
