import { listRulesets, type FactionId, type VictoryMode } from '../../engine/index.ts';
import {
  formatNumber,
  localizeFactionField,
  localizeRulesetField,
  t,
  type Locale,
} from '../i18n/index.ts';
import type { SetupConfig } from './urlState.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, TabletopControls, ThemePlate } from './tabletop.tsx';

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
  onOpenGuidelines: () => void;
  onOpenPlayerGuide: () => void;
  mode?: 'home' | 'offline';
}

const FACTION_OPTIONS: FactionId[] = [
  'congo_basin_collective',
  'levant_sumud',
  'mekong_echo_network',
  'amazon_guardians',
];

const RULESET = listRulesets()[0];

function getFactionLabel(factionId: FactionId) {
  return localizeFactionField(
    factionId,
    'name',
    {
      congo_basin_collective: 'Congo Basin Collective',
      levant_sumud: 'Levant Sumud Front',
      mekong_echo_network: 'Mekong Echo Network',
      amazon_guardians: 'Amazon Guardians',
    }[factionId],
  );
}

function getModeLabel(mode: VictoryMode) {
  return mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic');
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
  const selectedFactions = config.factionIds.slice(0, config.playerCount);
  const hasDuplicateFactions = new Set(selectedFactions).size !== selectedFactions.length;

  const updateFaction = (seat: number, factionId: FactionId) => {
    const nextFactionIds = config.factionIds.slice();
    nextFactionIds[seat] = factionId;
    onConfigChange({ factionIds: nextFactionIds });
  };

  return (
    <TableSurface className="home-table setup-table">
      <div className="setup-scene">
        <header className="setup-header">
          <EngravedHeader
            eyebrow={t('ui.home.eyebrow', 'Design-Faithful Cutover')}
            title={localizeRulesetField(RULESET?.id ?? 'base_design', 'name', RULESET?.name ?? 'Where the Stones Cry Out')}
            detail={localizeRulesetField(
              RULESET?.id ?? 'base_design',
              'description',
              RULESET?.description ?? 'Six regions. Extraction as the central threat. Bodies and Evidence as the coalition economy.',
            )}
            actions={
              <div className="header-action-plates">
                <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
                <TabletopControls />
              </div>
            }
          />
        </header>

        <main className="setup-board-layout">
          <PaperSheet tone="board" className="setup-feature-board">
            <div className="setup-board-grid">
              <section className="setup-scenario-cover">
                <span className="engraved-eyebrow">{t('ui.home.ruleset', 'Canonical Ruleset')}</span>
                <h2>{localizeRulesetField(RULESET?.id ?? 'base_design', 'name', RULESET?.name ?? 'Where the Stones Cry Out')}</h2>
                <p>{localizeRulesetField(RULESET?.id ?? 'base_design', 'introduction', RULESET?.introduction ?? 'Break extraction instead of merely surviving it.')}</p>
                <div className="setup-stat-ribbon">
                  <div><span>{t('ui.home.playerCount', 'Player Count')}</span><strong>{formatNumber(config.playerCount)}</strong></div>
                  <div><span>{t('ui.home.mode', 'Mode')}</span><strong>{getModeLabel(config.mode)}</strong></div>
                  <div><span>{t('ui.home.regions', 'Regions')}</span><strong>{t('ui.home.sixTheatres', '6 canonical theatres')}</strong></div>
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
                      disabled={hasDuplicateFactions}
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
                      <label key={seat} className="seat-placard">
                        <span>{t('ui.home.seat', 'Seat {{seat}}', { seat: seat + 1 })}</span>
                        <select value={selectedFactions[seat]} onChange={(event) => updateFaction(seat, event.target.value as FactionId)}>
                          {FACTION_OPTIONS.map((factionId) => (
                            <option key={factionId} value={factionId}>{getFactionLabel(factionId)}</option>
                          ))}
                        </select>
                        <strong>{getFactionLabel(selectedFactions[seat])}</strong>
                      </label>
                    ))}
                  </div>
                  {hasDuplicateFactions ? <p className="inline-error">{t('ui.home.duplicateFactions', 'Factions must be unique.')}</p> : null}
                </PaperSheet>
              </section>
            </div>

            <PaperSheet tone="note">
              <span className="engraved-eyebrow">{t('ui.home.replaces', 'This Ruleset Replaces')}</span>
              <p>{t('ui.home.replacesBody', 'The product now ships one canonical six-region map, Bodies and Evidence, Global Gaze, War Machine, Extraction Tokens, Secret Mandates, and Liberation or Symbolic victory.')}</p>
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
