import { LazyMotion, domAnimation, m } from 'framer-motion';
import type { CSSProperties } from 'react';
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
import { GameIcon } from '../../../ui/icon/GameIcon.tsx';
import {
  LocaleSwitcher,
  PaperSheet,
  TableSurface,
  ThemePlate,
  useTabletopTheme,
} from '../../../ui/layout/tabletop.tsx';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '../../../ui/primitives/index.ts';

interface SessionSetupScreenProps {
  config: SessionSetupDraft;
  roomPlayAvailable?: boolean;
  roomPlayChecking?: boolean;
  roomPlayDisabledByBuild?: boolean;
  onConfigChange: (patch: Partial<SessionSetupDraft>) => void;
  onStart: (config: SessionSetupDraft) => void;
  onOpenGuidelines: () => void;
  onOpenPlayerGuide: () => void;
  onOpenBoardTour: () => void;
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
  onOpenBoardTour,
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
  const factionById = new Map(currentRuleset.factions.map((faction) => [faction.id, faction]));

  const getSeatAccent = (factionIds: FactionId[]) => {
    for (const factionId of factionIds) {
      const faction = factionById.get(factionId);
      if (!faction) {
        continue;
      }
      const accent = currentRuleset.board.regions[faction.homeRegion]?.accent;
      if (accent) {
        return accent;
      }
    }
    return 'var(--color-accent)';
  };

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
  const roomStatusMessage = roomPlayDisabledByBuild
    ? t('ui.home.roomOfflineOnly', 'This build was cut for offline play only.')
    : roomPlayChecking
      ? t('ui.home.roomChecking', 'Checking whether the room service can hold the table...')
      : roomPlayAvailable
        ? null
        : t('ui.home.roomUnavailable', 'Room service did not answer. Local play remains available.');

  return (
    <TableSurface className="home-table setup-table home-depth-surface">
      <div className="setup-scene premium-home">
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
                    <div className="setup-briefing-head">
                      <div className="setup-briefing-title-row">
                        <DropdownMenuRoot>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="locale-icon-trigger scenario-icon-trigger"
                              aria-label={t('ui.home.ruleset', 'Scenario')}
                              title={localizeRulesetField(currentRuleset.id, 'name', currentRuleset.name)}
                            >
                              <GameIcon name="scrollText" size="sm" ariaLabel={t('ui.home.ruleset', 'Scenario')} />
                              <GameIcon name="chevronDown" size="xs" ariaLabel={t('ui.home.ruleset', 'Scenario')} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent
                              className="locale-dropdown-menu"
                              align="end"
                              side="bottom"
                              sideOffset={8}
                            >
                              {RULESETS.map((ruleset) => (
                                <DropdownMenuItem
                                  key={ruleset.id}
                                  className="locale-dropdown-item"
                                  data-active={ruleset.id === config.rulesetId ? 'true' : 'false'}
                                  onSelect={() => {
                                    handleRulesetChange(ruleset.id);
                                  }}
                                >
                                  <span>{localizeRulesetField(ruleset.id, 'name', ruleset.name)}</span>
                                  {ruleset.id === config.rulesetId ? <GameIcon name="check" size="xs" ariaLabel={t('ui.home.ruleset', 'Scenario')} /> : null}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenuRoot>
                        <h2 className="setup-briefing-title">{localizeRulesetField(currentRuleset.id, 'name', currentRuleset.name)}</h2>
                      </div>
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
                            <span className="setup-briefing-item-label"><Icon type="comrades" size="sm" ariaLabel={t('ui.home.humanPlayerCount', 'Human Players')} />{t('ui.home.humanPlayerCount', 'Human Players')}</span>
                            <strong>{formatNumber(config.humanPlayerCount)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="objective" size="sm" ariaLabel={t('ui.home.regions', 'Regions')} />{t('ui.home.regions', 'Regions')}</span>
                            <strong>{formatNumber(currentRuleset.regions.length)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="seat" size="sm" ariaLabel={t('ui.home.factionSeatCount', 'Faction Seats')} />{t('ui.home.factionSeatCount', 'Faction Seats')}</span>
                            <strong>{formatNumber(selectedFactions.length)}</strong>
                          </li>
                        </ul>
                      </section>
                      <section className="setup-briefing-column setup-briefing-column-system" aria-label={t('ui.home.systemPressure', 'System Pressure')}>
                        <span className="engraved-eyebrow">{t('ui.home.systemPressure', 'System Pressure')}</span>
                        <ul className="setup-briefing-list">
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="warMachine" size="sm" ariaLabel={getFrontLabel('WarMachine')} />{getFrontLabel('WarMachine')}</span>
                            <strong>{formatTrackFraction(setupWarMachine, 12)}</strong>
                          </li>
                          <li className="setup-briefing-item">
                            <span className="setup-briefing-item-label"><Icon type="globalGaze" size="sm" ariaLabel={t('ui.game.globalGaze', 'Global Gaze')} />{t('ui.game.globalGaze', 'Global Gaze')}</span>
                            <strong>{formatTrackFraction(setupGlobalGaze, 20)}</strong>
                          </li>
                          <li className={`setup-briefing-item ${highestExtractionSeed >= 5 ? 'is-critical' : ''}`.trim()}>
                            <span className="setup-briefing-item-label"><Icon type="extraction" size="sm" ariaLabel={t('ui.home.highestExtraction', 'Highest Extraction')} />{t('ui.home.highestExtraction', 'Highest Extraction')}</span>
                            <strong>{formatTrackFraction(highestExtractionSeed, extractionDefeatThreshold)}</strong>
                          </li>
                        </ul>
                      </section>
                    </div>
                    <div className={`setup-briefing-threat ${highestExtractionSeed >= 5 ? 'is-escalating' : ''}`.trim()}>
                      <div className="setup-briefing-threat-title">
                        <Icon type="crisis" size="md" ariaLabel={t('ui.home.existentialThreat', 'Existential Threat')} />
                        <span>{t('ui.home.existentialThreat', 'Existential Threat')}</span>
                      </div>
                      <p>{t('ui.home.threatValue', 'If any region reaches 6 Extraction Tokens, the coalition loses.')}</p>
                      {highestExtractionRegionId ? (
                        <p><strong>{t('ui.home.currentPeakRegion', 'Current peak: {{region}}.', { region: getRegionLabel(highestExtractionRegionId) })}</strong></p>
                      ) : null}
                    </div>
                  </section>

                  <section className="setup-launch-tray">
                    <PaperSheet tone="tray" className="home-surface launch-surface coalition-setup-surface">
                      <div className="coalition-panel-head">
                        <span className="engraved-eyebrow">{t('ui.home.launch', 'Open Table')}</span>
                        <div className="setup-utility-strip" aria-label={t('ui.home.utilities', 'Utilities')}>
                          <LocaleSwitcher showLabel={false} compact />
                        </div>
                      </div>
                      <h3 className="coalition-setup-title">
                        <GameIcon name="settings" size="sm" ariaLabel={t('ui.home.coalitionSetup', 'Coalition Setup')} />
                        <span>{t('ui.home.coalitionSetup', 'Coalition Setup')}</span>
                      </h3>
                      <div className="coalition-field-grid">
                        <label className="coalition-field">
                          <span>{t('ui.home.mode', 'Mode')}</span>
                          <div className="coalition-select-shell">
                            <select value={config.mode} onChange={(event) => onConfigChange({ mode: event.target.value as VictoryMode })}>
                              <option value="LIBERATION">{t('ui.mode.liberation', 'Liberation')}</option>
                              <option value="SYMBOLIC">{t('ui.mode.symbolic', 'Symbolic')}</option>
                            </select>
                            <GameIcon name="chevronDown" size="sm" ariaLabel={t('ui.home.mode', 'Mode')} />
                          </div>
                        </label>
                        <label className="coalition-field">
                          <span>{t('ui.home.playerCount', 'Player Count')}</span>
                          <div className="coalition-select-shell">
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
                            <GameIcon name="chevronDown" size="sm" ariaLabel={t('ui.home.playerCount', 'Player Count')} />
                          </div>
                        </label>
                      </div>
                      <div className="plate-toggle-row coalition-surface-toggle">
                        <ThemePlate
                          label={t('ui.home.localTable', 'Local Table')}
                          active={config.surface === 'local'}
                          variant={config.surface === 'local' ? 'default' : 'quiet'}
                          size="sm"
                          className="coalition-surface-button"
                          onClick={() => onConfigChange({ surface: 'local' })}
                        />
                        <ThemePlate
                          label={t('ui.home.roomPlay', 'Room Play')}
                          active={config.surface === 'room'}
                          variant={config.surface === 'room' ? 'default' : 'quiet'}
                          size="sm"
                          className="coalition-surface-button"
                          onClick={() => onConfigChange({ surface: 'room' })}
                        />
                      </div>
                      {config.surface === 'room' && roomStatusMessage ? (
                        <p className="room-status-note coalition-room-status">
                          {roomStatusMessage}
                        </p>
                      ) : null}
                      <div className="header-action-plates home-launch-actions coalition-actions">
                        <ThemePlate
                          label={t('ui.home.startSession', 'Start Session')}
                          variant="primary"
                          size="lg"
                          className="home-primary-action"
                          onClick={() => onStart(config)}
                        />
                        <div className="coalition-secondary-links" aria-label={t('ui.home.utilities', 'Utilities')}>
                          <button type="button" className="coalition-secondary-link" onClick={onOpenPlayerGuide}>
                            {t('ui.home.playerGuide', 'Player Guide')}
                          </button>
                          <span aria-hidden="true">·</span>
                          <button type="button" className="coalition-secondary-link" onClick={onOpenBoardTour}>
                            {t('ui.home.boardTour', 'Board Tour')}
                          </button>
                          <span aria-hidden="true">·</span>
                          <button type="button" className="coalition-secondary-link" onClick={onOpenGuidelines}>
                            {mode === 'offline' ? t('ui.home.rulesBrief', 'Rules Brief') : t('ui.home.openRulesBrief', 'Open Rules Brief')}
                          </button>
                        </div>
                      </div>
                    </PaperSheet>

                    <PaperSheet tone="tray" className="home-surface seat-assembly-surface">
                      <span className="engraved-eyebrow">{t('ui.home.factionSeats', 'Faction Seats')}</span>
                      <div className="seat-placard-grid seat-assembly-grid">
                        {factionGroups.map((group) => {
                          const seatAccent = getSeatAccent(group.factionIds);
                          const seatStyle = { ['--seat-accent' as string]: seatAccent } as CSSProperties;
                          return (
                            <article key={group.ownerId} className="seat-placard seat-assembly-card" style={seatStyle}>
                              <span className="seat-assembly-seat">{t('ui.home.playerSeatGroup', 'Player {{seat}}', { seat: group.ownerId + 1 })}</span>
                              <strong className="seat-assembly-faction">{group.factionIds.map((factionId) => getFactionLabel(factionId)).join(' · ')}</strong>
                            </article>
                          );
                        })}
                      </div>
                    </PaperSheet>
                  </section>
                </div>
              </PaperSheet>
            </m.section>
          </main>
        </LazyMotion>
      </div>
    </TableSurface>
  );
}

export { SessionSetupScreen as HomeScreen };
