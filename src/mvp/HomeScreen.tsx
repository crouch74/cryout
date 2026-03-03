import { listRulesets, type FactionId, type VictoryMode } from '../../engine/index.ts';
import {
  formatNumber,
  localizeFactionField,
  localizeRulesetField,
  t,
} from '../i18n/index.ts';
import type { SetupConfig } from './urlState.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

interface HomeScreenProps {
  config: SetupConfig;
  hasAutosave: boolean;
  roomPlayAvailable?: boolean;
  roomPlayChecking?: boolean;
  roomPlayDisabledByBuild?: boolean;
  onConfigChange: (patch: Partial<SetupConfig>) => void;
  onStart: (config: SetupConfig) => void;
  onLoadSave: (serialized: string) => void;
  onLoadAutosave: () => void;
  onOpenGuidelines: () => void;
  onOpenPlayerGuide: () => void;
  mode?: 'home' | 'offline';
}

const RULESETS = listRulesets();

function getFactionLabel(factionId: FactionId) {
  return localizeFactionField(
    factionId,
    'name',
    factionId,
  );
}

function getModeLabel(mode: VictoryMode) {
  return mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic');
}

export function HomeScreen({
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
  const currentRuleset = RULESETS.find((r) => r.id === config.rulesetId) || RULESETS[0];
  const selectedFactions = currentRuleset.factions.map((faction) => faction.id);

  const handleRulesetChange = (rulesetId: string) => {
    const nextRuleset = RULESETS.find((r) => r.id === rulesetId) || RULESETS[0];
    onConfigChange({
      rulesetId,
      factionIds: nextRuleset.factions.map((f) => f.id),
      playerCount: nextRuleset.factions.length as 2 | 3 | 4,
    });
  };

  return (
    <TableSurface className="home-table setup-table">
      <div className="setup-scene">
        <header className="setup-header">
          <EngravedHeader
            eyebrow={t('ui.home.eyebrow', 'Operational Briefing')}
            title={localizeRulesetField(currentRuleset.id, 'name', currentRuleset.name)}
            detail={localizeRulesetField(
              currentRuleset.id,
              'description',
              currentRuleset.description,
            )}
            actions={
              <div className="header-action-plates">
                <LocaleSwitcher />
                <TabletopControls />
              </div>
            }
          />
        </header>

        <main className="setup-board-layout">
          <PaperSheet tone="board" className="setup-feature-board">
            <div className="setup-board-grid">
              <section className="setup-scenario-cover">
                <span className="engraved-eyebrow">{t('ui.home.ruleset', 'Scenario Selection')}</span>
                <select
                  className="scenario-select-major"
                  value={config.rulesetId}
                  onChange={(e) => handleRulesetChange(e.target.value)}
                >
                  {RULESETS.map(r => (
                    <option key={r.id} value={r.id}>{localizeRulesetField(r.id, 'name', r.name)}</option>
                  ))}
                </select>
                <h2>{localizeRulesetField(currentRuleset.id, 'name', currentRuleset.name)}</h2>
                <p>{localizeRulesetField(currentRuleset.id, 'introduction', currentRuleset.introduction)}</p>
                <div className="setup-stat-ribbon">
                  <div><span>{t('ui.home.playerCount', 'Player Count')}</span><strong>{formatNumber(config.playerCount)}</strong></div>
                  <div><span>{t('ui.home.mode', 'Mode')}</span><strong>{getModeLabel(config.mode)}</strong></div>
                  <div><span>{t('ui.home.regions', 'Regions')}</span><strong>{t('ui.home.regionCount', '{{count}} sectors', { count: currentRuleset.regions.length })}</strong></div>
                  <div><span>{t('ui.home.threat', 'Threat')}</span><strong>{t('ui.home.threatValue', 'Extraction tokens to 6 = defeat')}</strong></div>
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
                      <select value={config.mode} onChange={(event) => onConfigChange({ mode: event.target.value as VictoryMode })}>
                        <option value="LIBERATION">{t('ui.mode.liberation', 'Liberation')}</option>
                        <option value="SYMBOLIC">{t('ui.mode.symbolic', 'Symbolic')}</option>
                      </select>
                    </label>
                    <div>
                      <span>{t('ui.home.playerCount', 'Player Count')}</span>
                      <strong>{config.playerCount}</strong>
                    </div>
                  </div>
                  {config.surface === 'room' ? (
                    <>
                      <label>
                        <span>{t('ui.home.roomServiceUrl', 'Room Service URL')}</span>
                        <input
                          type="text"
                          value={config.roomUrl}
                          onChange={(event) => onConfigChange({ roomUrl: event.target.value })}
                          placeholder="http://localhost:3010"
                        />
                      </label>
                      <p className="room-status-note">
                        {roomPlayDisabledByBuild
                          ? t('ui.home.roomOfflineOnly', 'This build is configured for offline play only.')
                          : roomPlayChecking
                            ? t('ui.home.roomChecking', 'Checking room service...')
                            : roomPlayAvailable
                              ? t('ui.home.roomReachable', 'Room service reachable.')
                              : t('ui.home.roomUnavailable', 'Room service unavailable. Local table still works.')}
                      </p>
                    </>
                  ) : null}
                  <div className="header-action-plates">
                    <ThemePlate
                      label={config.surface === 'local' ? t('ui.home.startLocal', 'Start Local Table') : t('ui.home.createRoom', 'Create Room')}
                      onClick={() => onStart(config)}
                    />
                    {hasAutosave ? <ThemePlate label={t('ui.home.loadAutosave', 'Load Autosave')} onClick={onLoadAutosave} /> : null}
                    <ThemePlate label={mode === 'offline' ? t('ui.home.rulesBrief', 'Rules Brief') : t('ui.home.openRulesBrief', 'Open Rules Brief')} onClick={onOpenGuidelines} />
                    <ThemePlate label={t('ui.home.playerGuide', 'Player Guide')} onClick={onOpenPlayerGuide} />
                  </div>
                </PaperSheet>

                <PaperSheet tone="tray">
                  <span className="engraved-eyebrow">{t('ui.home.factionSeats', 'Faction Seats')}</span>
                  <div className="seat-placard-grid">
                    {Array.from({ length: config.playerCount }).map((_, seat) => (
                      <div key={seat} className="seat-placard">
                        <span>{t('ui.home.seat', 'Seat {{seat}}', { seat: seat + 1 })}</span>
                        <strong>{getFactionLabel(selectedFactions[seat])}</strong>
                      </div>
                    ))}
                  </div>
                </PaperSheet>
              </section>
            </div>

            <PaperSheet tone="note">
              <span className="engraved-eyebrow">{t('ui.home.asymmetricAbilities', 'Asymmetric Factions')}</span>
              <p>{t('ui.home.rulesBody', 'Each seat represents a different faction with distinct mandates, passive bonuses, and specialized weaknesses. Success requires horizontal coordination across all seats.')}</p>
            </PaperSheet>

            <details className="setup-utility-drawer">
              <summary>{t('ui.home.loadSave', 'Load Save')}</summary>
              <PaperSheet tone="tray">
                <span className="engraved-eyebrow">{t('ui.home.utilities', 'Utilities')}</span>
                <textarea
                  placeholder={t('ui.home.pasteSave', 'Paste a serialized save payload here.')}
                  onBlur={(event) => {
                    if (event.target.value.trim()) {
                      onLoadSave(event.target.value);
                      event.target.value = '';
                    }
                  }}
                />
              </PaperSheet>
            </details>
          </PaperSheet>
        </main>
      </div>
    </TableSurface>
  );
}
