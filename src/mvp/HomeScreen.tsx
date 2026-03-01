import { useState } from 'react';
import { listScenarios, type GameMode, type RoleId } from '../../engine/index.ts';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { formatNumber, formatTemperature, getCivicSpaceLabel, getRoleName, localizeScenarioDefinition, t, type Locale } from '../i18n/index.ts';
import type { SetupConfig } from './urlState.ts';
import { EngravedHeader, PaperSheet, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

interface HomeScreenProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  config: SetupConfig;
  hasAutosave: boolean;
  roomPlayAvailable?: boolean;
  roomPlayChecking?: boolean;
  roomPlayDisabledByBuild?: boolean;
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
  roomPlayAvailable = true,
  roomPlayChecking = false,
  roomPlayDisabledByBuild = false,
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
    <TableSurface className="home-table setup-table">
      <div className="setup-scene">
        <header className="setup-header">
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
        </header>

        <main className="setup-board-layout">
          <PaperSheet tone="board" className="setup-feature-board">
            <div className="setup-board-rail">
              <span>{t('ui.home.selectedChapter', 'Selected Chapter')}</span>
              <div className="header-action-plates">
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
                <ThemePlate
                  label={mode === 'offline' ? t('ui.home.scenarioGuidelines', 'Scenario Guidelines') : t('ui.home.openGuidelines', 'Open Guidelines')}
                  onClick={() => onOpenGuidelines(selectedScenario.id)}
                />
                <ThemePlate label={t('ui.home.playerGuide', 'Player Guide')} onClick={onOpenPlayerGuide} />
              </div>
            </div>

            <div className="setup-board-grid">
              <section className="setup-scenario-cover">
                <span className="engraved-eyebrow">{selectedScenario.name}</span>
                <h2>{excerpt(selectedScenario.description, 120)}</h2>
                <p>{excerpt(selectedScenario.moralCenter, 140)}</p>
                <div className="setup-stat-ribbon">
                  <div><span>{t('ui.home.playerCount', 'Player Count')}</span><strong>{formatNumber(config.playerCount)}</strong></div>
                  <div><span>{t('ui.home.mode', 'Mode')}</span><strong>{config.mode}</strong></div>
                  <div><span>{t('ui.scenarioBooklet.civicSpace', 'Civic space')}</span><strong>{getCivicSpaceLabel(selectedScenario.setup.civicSpace)}</strong></div>
                  <div><span>{t('ui.scenarioBooklet.startingHeat', 'Starting heat')}</span><strong>{formatTemperature(selectedScenario.setup.temperature)}</strong></div>
                </div>
                <div className="setup-rule-chips">
                  {selectedScenario.specialRuleChips.slice(0, 3).map((chip) => (
                    <span key={chip.id} className="rule-slip">{chip.label}</span>
                  ))}
                </div>
              </section>

              <section className="setup-launch-tray">
                <PaperSheet tone="tray">
                  <span className="engraved-eyebrow">{t('ui.home.launch', 'Launch')}</span>
                  <div className="plate-toggle-row">
                    <ThemePlate label={t('ui.home.localTable', 'Local Table')} active={config.surface === 'local'} onClick={() => onConfigChange({ surface: 'local' })} />
                    <ThemePlate label={t('ui.home.roomPlay', 'Room Play')} active={config.surface === 'room'} onClick={() => onConfigChange({ surface: 'room' })} />
                  </div>
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
                      <p className="room-status-note">
                        {roomPlayDisabledByBuild
                          ? t('ui.home.offlineOnly', 'This build is configured for offline play only.')
                          : roomPlayChecking
                            ? t('ui.home.checkingRoomPlay', 'Checking room service...')
                            : roomPlayAvailable
                              ? t('ui.home.roomPlayReady', 'Room service reachable.')
                              : t('ui.home.roomPlayUnavailable', 'Room service unavailable. Local table still works.')}
                      </p>
                    </>
                  ) : null}
                </PaperSheet>

                <PaperSheet tone="tray">
                  <span className="engraved-eyebrow">{t('ui.home.coalitionSeats', 'Coalition Seats')}</span>
                  <div className="seat-placard-grid">
                    {Array.from({ length: config.playerCount }).map((_, seat) => (
                      <label key={seat} className="seat-placard">
                        <span>{t('ui.home.seatLabel', 'Seat {{seat}}', { seat: seat + 1 })}</span>
                        <select value={selectedRoles[seat]} onChange={(event) => updateRole(seat, event.target.value as RoleId)}>
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.id} value={role.id}>
                              {getRoleName(role.id)}
                            </option>
                          ))}
                        </select>
                        <strong>{getRoleName(selectedRoles[seat])}</strong>
                      </label>
                    ))}
                  </div>
                  {hasDuplicateRoles ? <p className="inline-error">{t('ui.home.rolesMustBeUnique', 'Roles must be unique.')}</p> : null}
                  {error ? <p className="inline-error">{error}</p> : null}
                </PaperSheet>
              </section>
            </div>

            <div className="scenario-card-grid setup-scenario-rail">
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
                    <p>{excerpt(scenario.description, 92)}</p>
                  </button>
                );
              })}
            </div>
          </PaperSheet>

          <details className="setup-utility-drawer">
            <summary>{t('ui.home.loadSave', 'Load Save')}</summary>
            <PaperSheet tone="tray">
              <span className="engraved-eyebrow">{t('ui.home.utilities', 'Utilities')}</span>
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
            </PaperSheet>
          </details>
        </main>
      </div>
    </TableSurface>
  );
}
