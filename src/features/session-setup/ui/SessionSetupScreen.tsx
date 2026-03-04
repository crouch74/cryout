import { LazyMotion, domAnimation, m } from 'framer-motion';
import { buildBalancedSeatOwners, listRulesets, type FactionId, type VictoryMode } from '../../../engine/index.ts';
import {
  formatNumber,
  formatTrackFraction,
  getFrontLabel,
  getRegionLabel,
  localizeFactionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import type { SessionSetupDraft } from '../model/sessionTypes.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
import {
  LocaleSwitcher,
  PaperSheet,
  TableSurface,
  ThemePlate,
  useTabletopTheme,
} from '../../../ui/layout/tabletop.tsx';

interface SessionSetupScreenProps {
  config: SessionSetupDraft;
  roomPlayAvailable?: boolean;
  roomPlayChecking?: boolean;
  roomPlayDisabledByBuild?: boolean;
  onConfigChange: (patch: Partial<SessionSetupDraft>) => void;
  onStart: (config: SessionSetupDraft) => void;
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

export function SessionSetupScreen({
  config,
  roomPlayAvailable = true,
  roomPlayChecking = false,
  roomPlayDisabledByBuild = false,
  onConfigChange,
  onStart,
  onOpenGuidelines,
  onOpenPlayerGuide,
  mode = 'home',
}: SessionSetupScreenProps) {
  const { motionMode } = useTabletopTheme();
  const currentRuleset = RULESETS.find((r) => r.id === config.rulesetId) || RULESETS[0];
  const selectedFactions = config.factionIds.length > 0 ? config.factionIds : currentRuleset.factions.map((faction) => faction.id);
  const setupGlobalGaze = currentRuleset.setup?.globalGaze ?? 5;
  const setupWarMachine = currentRuleset.setup?.northernWarMachine ?? 7;
  const highestExtractionSeed = Math.max(
    0,
    ...Object.values(currentRuleset.setup?.extractionSeeds ?? {}).map((value) => value ?? 0),
  );
  const highestExtractionRegionId = Object.entries(currentRuleset.setup?.extractionSeeds ?? {})
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]?.[0] ?? null;
  const extractionDefeatThreshold = 6;
  const playerOptions = Array.from(
    { length: Math.max(0, currentRuleset.factions.length - 1) },
    (_, index) => index + 2,
  ) as Array<2 | 3 | 4>;
  const seatOwnerIds = config.seatOwnerIds.length === selectedFactions.length
    ? config.seatOwnerIds
    : buildBalancedSeatOwners(config.humanPlayerCount, selectedFactions);
  const factionGroups = Array.from({ length: config.humanPlayerCount }, (_, ownerId) => ({
    ownerId,
    factionIds: selectedFactions.filter((_, seat) => seatOwnerIds[seat] === ownerId),
  }));

  const handleRulesetChange = (rulesetId: string) => {
    const nextRuleset = RULESETS.find((r) => r.id === rulesetId) || RULESETS[0];
    const factionIds = nextRuleset.factions.map((f) => f.id);
    const humanPlayerCount = nextRuleset.factions.length as 2 | 3 | 4;
    onConfigChange({
      rulesetId,
      factionIds,
      humanPlayerCount,
      seatOwnerIds: buildBalancedSeatOwners(humanPlayerCount, factionIds),
    });
  };

  const canAnimate = motionMode !== 'reduced';

  return (
    <TableSurface className="home-table setup-table home-depth-surface">
      <div className="setup-scene premium-home">
        <header className="setup-header setup-header-minimal">
          <div className="setup-utility-strip" aria-label={t('ui.home.utilities', 'Utilities')}>
            <LocaleSwitcher showLabel={false} compact />
          </div>
        </header>

        <LazyMotion features={domAnimation}>
          <main className="setup-board-layout">
            <m.section
              className="setup-hero-band"
              initial={canAnimate ? { opacity: 0, y: 18 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={canAnimate ? { duration: 0.42 } : undefined}
            >
              <PaperSheet tone="board" className="setup-feature-board home-surface home-focus-surface">
                <div className="setup-board-grid">
                  <section className="setup-scenario-cover">
                    <span className="engraved-eyebrow">{t('ui.home.ruleset', 'Scenario')}</span>
                    <select
                      className="scenario-select-major"
                      value={config.rulesetId}
                      onChange={(e) => handleRulesetChange(e.target.value)}
                    >
                      {RULESETS.map(r => (
                        <option key={r.id} value={r.id}>{localizeRulesetField(r.id, 'name', r.name)}</option>
                      ))}
                    </select>
                    <div className="setup-briefing-head">
                      <h2 className="setup-briefing-title">{localizeRulesetField(currentRuleset.id, 'name', currentRuleset.name)}</h2>
                      <p className="setup-briefing-window">
                        {t('ui.home.briefingWindow', 'Window')} · {t('ui.home.briefingWindowValue', 'to round {{round}}', { round: formatNumber(currentRuleset.suddenDeathRound) })}
                      </p>
                      <p className="setup-briefing-thesis">
                        {localizeRulesetField(currentRuleset.id, 'description', currentRuleset.description)}
                      </p>
                    </div>
                    <div className="setup-briefing-divider" aria-hidden="true" />
                    <div className="setup-briefing-summary">
                      <section className="setup-briefing-column setup-briefing-column-movement" aria-label={t('ui.home.movementState', 'Movement State')}>
                        <span className="engraved-eyebrow">{t('ui.home.movementState', 'Movement State')}</span>
                        <ul className="setup-briefing-list">
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="comrades" size={16} ariaLabel={t('ui.home.humanPlayerCount', 'Human Players')} />{t('ui.home.humanPlayerCount', 'Human Players')}</span>
                            <strong>{formatNumber(config.humanPlayerCount)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="objective" size={16} ariaLabel={t('ui.home.regions', 'Regions')} />{t('ui.home.regions', 'Regions')}</span>
                            <strong>{formatNumber(currentRuleset.regions.length)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="seat" size={16} ariaLabel={t('ui.home.factionSeatCount', 'Faction Seats')} />{t('ui.home.factionSeatCount', 'Faction Seats')}</span>
                            <strong>{formatNumber(selectedFactions.length)}</strong>
                          </li>
                        </ul>
                      </section>
                      <section className="setup-briefing-column setup-briefing-column-system" aria-label={t('ui.home.systemPressure', 'System Pressure')}>
                        <span className="engraved-eyebrow">{t('ui.home.systemPressure', 'System Pressure')}</span>
                        <ul className="setup-briefing-list">
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="warMachine" size={16} ariaLabel={getFrontLabel('WarMachine')} />{getFrontLabel('WarMachine')}</span>
                            <strong>{formatTrackFraction(setupWarMachine, 12)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="globalGaze" size={16} ariaLabel={t('ui.game.globalGaze', 'Global Gaze')} />{t('ui.game.globalGaze', 'Global Gaze')}</span>
                            <strong>{formatTrackFraction(setupGlobalGaze, 20)}</strong>
                          </li>
                          <li className={`setup-briefing-item ${highestExtractionSeed >= 5 ? 'is-critical' : ''}`.trim()}>
                            <span className="setup-briefing-item-label"><Icon type="extraction" size={16} ariaLabel={t('ui.home.highestExtraction', 'Highest Extraction')} />{t('ui.home.highestExtraction', 'Highest Extraction')}</span>
                            <strong>{formatTrackFraction(highestExtractionSeed, extractionDefeatThreshold)}</strong>
                          </li>
                        </ul>
                      </section>
                    </div>
                    <div className={`setup-briefing-threat ${highestExtractionSeed >= 5 ? 'is-escalating' : ''}`.trim()}>
                      <div className="setup-briefing-threat-title">
                        <Icon type="crisis" size={18} ariaLabel={t('ui.home.existentialThreat', 'Existential Threat')} />
                        <span>{t('ui.home.existentialThreat', 'Existential Threat')}</span>
                      </div>
                      <p>
                        {t('ui.home.threatValue', 'If any region reaches 6 Extraction Tokens, the coalition loses.')}
                        {highestExtractionRegionId ? (
                          <strong>{` ${t('ui.home.currentPeakRegion', 'Current peak: {{region}}.', { region: getRegionLabel(highestExtractionRegionId) })}`}</strong>
                        ) : null}
                      </p>
                    </div>
                  </section>

                  <section className="setup-launch-tray">
                    <PaperSheet tone="tray" className="home-surface launch-surface">
                      <span className="engraved-eyebrow">{t('ui.home.launch', 'Open Table')}</span>
                      <div className="plate-toggle-row">
                        <ThemePlate
                          label={t('ui.home.localTable', 'Local Table')}
                          active={config.surface === 'local'}
                          variant={config.surface === 'local' ? 'default' : 'quiet'}
                          size="sm"
                          onClick={() => onConfigChange({ surface: 'local' })}
                        />
                        <ThemePlate
                          label={t('ui.home.roomPlay', 'Room Play')}
                          active={config.surface === 'room'}
                          variant={config.surface === 'room' ? 'default' : 'quiet'}
                          size="sm"
                          onClick={() => onConfigChange({ surface: 'room' })}
                        />
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
                          <span>{t('ui.home.humanPlayerCount', 'Human Players')}</span>
                          <select
                            value={config.humanPlayerCount}
                            onChange={(event) => {
                              const humanPlayerCount = Number(event.target.value) as 2 | 3 | 4;
                              onConfigChange({
                                humanPlayerCount,
                                seatOwnerIds: buildBalancedSeatOwners(humanPlayerCount, selectedFactions),
                              });
                            }}
                          >
                            {playerOptions.map((playerCount) => (
                              <option key={playerCount} value={playerCount}>{playerCount}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {config.surface === 'room' ? (
                        <p className="room-status-note">
                          {roomPlayDisabledByBuild
                            ? t('ui.home.roomOfflineOnly', 'This build was cut for offline play only.')
                            : roomPlayChecking
                              ? t('ui.home.roomChecking', 'Checking whether the room service can hold the table...')
                              : roomPlayAvailable
                                ? t('ui.home.roomReachable', 'Room service is reachable.')
                                : t('ui.home.roomUnavailable', 'Room service did not answer. Local play remains available.')}
                        </p>
                      ) : null}
                      <div className="header-action-plates home-launch-actions">
                        <ThemePlate
                          label={config.surface === 'local' ? t('ui.home.startLocal', 'Start Local Table') : t('ui.home.createRoom', 'Create Room')}
                          variant="primary"
                          size="lg"
                          className="home-primary-action"
                          onClick={() => onStart(config)}
                        />
                        <ThemePlate
                          label={mode === 'offline' ? t('ui.home.rulesBrief', 'Rules Brief') : t('ui.home.openRulesBrief', 'Open Rules Brief')}
                          variant="quiet"
                          size="sm"
                          onClick={onOpenGuidelines}
                        />
                        <ThemePlate
                          label={t('ui.home.playerGuide', 'Player Guide')}
                          variant="quiet"
                          size="sm"
                          onClick={onOpenPlayerGuide}
                        />
                      </div>
                    </PaperSheet>

                    <PaperSheet tone="tray" className="home-surface">
                      <span className="engraved-eyebrow">{t('ui.home.factionSeats', 'Faction Seats')}</span>
                      <div className="seat-placard-grid">
                        {factionGroups.map((group) => (
                          <div key={group.ownerId} className="seat-placard">
                            <span>{t('ui.home.playerSeatGroup', 'Player {{seat}}', { seat: group.ownerId + 1 })}</span>
                            <strong>{group.factionIds.map((factionId) => getFactionLabel(factionId)).join(', ')}</strong>
                          </div>
                        ))}
                      </div>
                    </PaperSheet>
                  </section>
                </div>

                <PaperSheet tone="note" className="home-surface home-surface-note">
                  <span className="engraved-eyebrow">{t('ui.home.asymmetricAbilities', 'Distinct Movements')}</span>
                  <p>{t('ui.home.rulesBody', 'Each seat carries a movement with distinct pressure, costs, and strategic obligations. Coordinate together without erasing the tension between collective survival and private mandates.')}</p>
                </PaperSheet>
              </PaperSheet>
            </m.section>
          </main>
        </LazyMotion>
      </div>
    </TableSurface>
  );
}

export { SessionSetupScreen as HomeScreen };
