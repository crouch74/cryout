import { useState } from 'react';
import { listScenarios, type GameMode, type RoleId } from '../../engine/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { getCivicSpaceLabel, getRoleName, localizeScenarioDefinition, t, type Locale } from '../i18n/index.ts';
import type { SetupConfig } from './urlState.ts';
import { EngravedHeader, PaperSheet, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

interface HomeScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  config: SetupConfig;
  hasAutosave: boolean;
  roomPlayAvailable: boolean;
  roomPlayChecking: boolean;
  roomPlayDisabledByBuild: boolean;
  onConfigChange: (patch: Partial<SetupConfig>) => void;
  onStart: (config: SetupConfig) => void;
  onLoadSave: (serialized: string) => void;
  onLoadAutosave: () => void;
  onOpenGuidelines: (scenarioId: string) => void;
  onOpenPlayerGuide: () => void;
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
  roomPlayAvailable,
  roomPlayChecking,
  roomPlayDisabledByBuild,
  onConfigChange,
  onStart,
  onLoadSave,
  onLoadAutosave,
  onOpenGuidelines,
  onOpenPlayerGuide,
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
    return null;
  }

  return (
    <TableSurface className="home-table">
      <div className="home-paper-layout">
        <PaperSheet tone="folio" className="home-title-sheet">
          <EngravedHeader
            eyebrow={t('ui.home.eyebrow', 'Playable MVP')}
            title={t('ui.home.title', 'Dignity Rising')}
            detail={t(
              'ui.home.subtitle',
              'A cooperative civic strategy game about protecting civilians, defending truth, and building institutions under pressure.',
            )}
            actions={
              <div className="header-control-stack">
                <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
                <TabletopControls />
              </div>
            }
          />

          <div className="home-title-grid">
            <PaperSheet tone="plain">
              <span className="engraved-eyebrow">{t('ui.home.selectedChapter', 'Selected Chapter')}</span>
              <h2>{selectedScenario.name}</h2>
              <p>{excerpt(selectedScenario.description, 220)}</p>
              <div className="ledger-list">
                <div className="ledger-row"><span>{t('ui.home.playerCount', 'Player Count')}</span><strong>{config.playerCount}</strong></div>
                <div className="ledger-row"><span>{t('ui.home.mode', 'Mode')}</span><strong>{config.mode}</strong></div>
                <div className="ledger-row"><span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span><strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong></div>
                <div className="ledger-row"><span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span><strong>+{selectedScenario.setup.temperature}°C</strong></div>
              </div>
            </PaperSheet>

            <PaperSheet tone="plain">
              <span className="engraved-eyebrow">{t('ui.home.whatChanges', 'What Changes')}</span>
              <ul className="guide-list">
                {selectedScenario.specialRuleChips.slice(0, 4).map((chip) => (
                  <li key={chip.id}>{chip.label}</li>
                ))}
              </ul>
              <p>{selectedScenario.moralCenter}</p>
            </PaperSheet>
          </div>

          <div className="home-launch-row">
            <ThemePlate
              label={config.surface === 'local' ? t('ui.home.startLocal', 'Start Local Table') : t('ui.home.createRoom', 'Create Room')}
              onClick={() => {
                if (hasDuplicateRoles) {
                  setError(t('ui.home.rolesMustBeUnique', 'Roles must be unique.'));
                  return;
                }
                setError(null);
                onStart({ ...config, scenarioId: selectedScenario.id, roleIds: selectedRoles });
              }}
            />
            {hasAutosave ? <ThemePlate label={t('ui.home.loadAutosave', 'Load Autosave')} onClick={onLoadAutosave} /> : null}
            <ThemePlate label={mode === 'offline' ? t('ui.home.scenarioGuidelines', 'Scenario Guidelines') : t('ui.home.openGuidelines', 'Open Guidelines')} onClick={() => onOpenGuidelines(selectedScenario.id)} />
            <ThemePlate label={t('ui.home.playerGuide', 'Player Guide')} onClick={onOpenPlayerGuide} />
          </div>
        </PaperSheet>

        <div className="home-dossier-grid">
          <PaperSheet tone="folio">
            <span className="engraved-eyebrow">{t('ui.home.scenarioMenu', 'Scenario Menu')}</span>
            <h2>{t('ui.home.scenario', 'Scenario')}</h2>
            <div className="scenario-card-grid">
              {localizedScenarios.map((scenario) => {
                const active = scenario.id === selectedScenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    className={`scenario-dossier-card ${active ? 'is-active' : ''}`}
                    onClick={() => onConfigChange({ scenarioId: scenario.id })}
                  >
                    <span className="engraved-eyebrow">{active ? t('ui.home.selected', 'Selected') : t('ui.home.available', 'Available')}</span>
                    <strong>{scenario.name}</strong>
                    <p>{excerpt(scenario.description, 130)}</p>
                    <div className="ledger-list">
                      <div className="ledger-row"><span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span><strong>{getCivicSpaceLabel(scenario.setup.civicSpace)}</strong></div>
                      <div className="ledger-row"><span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span><strong>+{scenario.setup.temperature}°C</strong></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </PaperSheet>

          <div className="home-right-column">
            <PaperSheet tone="folio">
              <span className="engraved-eyebrow">{t('ui.home.launch', 'Launch')}</span>
              <h2>{t('ui.home.tableConfiguration', 'Table Configuration')}</h2>
              <div className="plate-toggle-row">
                <ThemePlate label={t('ui.home.localTable', 'Local Table')} active={config.surface === 'local'} onClick={() => onConfigChange({ surface: 'local' })} />
                <ThemePlate
                  label={t('ui.home.roomPlay', 'Room Play')}
                  active={config.surface === 'room'}
                  disabled={roomPlayDisabledByBuild}
                  onClick={() => onConfigChange({ surface: 'room' })}
                />
              </div>
              {roomPlayDisabledByBuild ? (
                <p>{t('ui.home.roomPlayDisabledPages', 'Room play is disabled in the GitHub Pages build. Offline mode is always used there.')}</p>
              ) : null}
              <div className="paper-form-grid">
                <label>
                  <span>{t('ui.home.mode', 'Mode')}</span>
                  <select value={config.mode} onChange={(event) => onConfigChange({ mode: event.target.value as GameMode })}>
                    <option value="CORE">{t('ui.home.modeCore', 'Core')}</option>
                    <option value="FULL">{t('ui.home.modeFull', 'Full')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('ui.home.playerCount', 'Player Count')}</span>
                  <select value={config.playerCount} onChange={(event) => onConfigChange({ playerCount: Number(event.target.value) as 2 | 3 | 4 })}>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </label>
              </div>
              {config.surface === 'room' ? (
                <>
                  <label>
                    <span>{t('ui.home.roomUrl', 'Room Service URL')}</span>
                    <input
                      type="text"
                      value={config.roomUrl}
                      onChange={(event) => onConfigChange({ roomUrl: event.target.value })}
                      placeholder="http://localhost:3010"
                    />
                  </label>
                  <p>
                    {roomPlayChecking
                      ? t('ui.home.roomChecking', 'Checking room service availability...')
                      : roomPlayAvailable
                        ? t('ui.home.roomAvailable', 'Room service reachable. Online room play is available.')
                        : t(
                          'ui.home.roomUnavailableFallback',
                          'Room service unavailable. Starting the game will fall back to a local offline table.',
                        )}
                  </p>
                </>
              ) : null}
            </PaperSheet>

            <PaperSheet tone="folio">
              <span className="engraved-eyebrow">{t('ui.home.coalitionSeats', 'Coalition Seats')}</span>
              <h2>{t('ui.home.seatAssignments', 'Seat Assignments')}</h2>
              <div className="seat-placard-grid">
                {Array.from({ length: config.playerCount }).map((_, seat) => (
                  <PaperSheet key={seat} tone="plain">
                    <label>
                      <span>{t('ui.home.seatLabel', 'Seat {{seat}}', { seat: seat + 1 })}</span>
                      <select value={selectedRoles[seat]} onChange={(event) => updateRole(seat, event.target.value as RoleId)}>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.id} value={role.id}>
                            {getRoleName(role.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>{getRoleName(selectedRoles[seat])}</p>
                  </PaperSheet>
                ))}
              </div>
              {hasDuplicateRoles ? <p className="inline-error">{t('ui.home.rolesMustBeUnique', 'Roles must be unique.')}</p> : null}
              {error ? <p className="inline-error">{error}</p> : null}
            </PaperSheet>

            <PaperSheet tone="folio">
              <span className="engraved-eyebrow">{t('ui.home.loadSave', 'Load Save')}</span>
              <h2>{t('ui.home.utilities', 'Utilities')}</h2>
              <textarea
                value={saveText}
                onChange={(event) => setSaveText(event.target.value)}
                placeholder={t('ui.home.savePlaceholder', 'Paste a serialized save payload here.')}
              />
              <ThemePlate
                label={t('ui.home.loadSaveButton', 'Load Save Into Local Table')}
                onClick={() => {
                  if (!saveText.trim()) {
                    setError(t('ui.home.pasteSaveFirst', 'Paste a save payload first.'));
                    return;
                  }
                  setError(null);
                  onLoadSave(saveText);
                }}
              />
              <p>{t('ui.home.routesStayStable', 'Routes stay stable while the selected scenario and active table state change underneath.')}</p>
            </PaperSheet>
          </div>
        </div>
      </div>
    </TableSurface>
  );
}
