import { buildBalancedSeatOwners, listRulesets, type FactionId, type VictoryMode } from '../../../engine/index.ts';
import {
  formatNumber,
  localizeFactionField,
  localizeRulesetField,
  t,
} from '../../../i18n/index.ts';
import type { SessionSetupDraft } from '../model/sessionTypes.ts';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, TabletopControls, ThemePlate } from '../../../ui/layout/tabletop.tsx';

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

function getModeLabel(mode: VictoryMode) {
  return mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic');
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
  const currentRuleset = RULESETS.find((r) => r.id === config.rulesetId) || RULESETS[0];
  const selectedFactions = config.factionIds.length > 0 ? config.factionIds : currentRuleset.factions.map((faction) => faction.id);
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
                  <div><span>{t('ui.home.humanPlayerCount', 'Human Players')}</span><strong>{formatNumber(config.humanPlayerCount)}</strong></div>
                  <div><span>{t('ui.home.factionSeatCount', 'Faction Seats')}</span><strong>{formatNumber(selectedFactions.length)}</strong></div>
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
                        ? t('ui.home.roomOfflineOnly', 'This build is configured for offline play only.')
                        : roomPlayChecking
                          ? t('ui.home.roomChecking', 'Checking room service...')
                          : roomPlayAvailable
                            ? t('ui.home.roomReachable', 'Room service reachable.')
                            : t('ui.home.roomUnavailable', 'Room service unavailable. Local table still works.')}
                    </p>
                  ) : null}
                  <div className="header-action-plates">
                    <ThemePlate
                      label={config.surface === 'local' ? t('ui.home.startLocal', 'Start Local Table') : t('ui.home.createRoom', 'Create Room')}
                      onClick={() => onStart(config)}
                    />
                    <ThemePlate label={mode === 'offline' ? t('ui.home.rulesBrief', 'Rules Brief') : t('ui.home.openRulesBrief', 'Open Rules Brief')} onClick={onOpenGuidelines} />
                    <ThemePlate label={t('ui.home.playerGuide', 'Player Guide')} onClick={onOpenPlayerGuide} />
                  </div>
                </PaperSheet>

                <PaperSheet tone="tray">
                  <span className="engraved-eyebrow">{t('ui.home.factionSeats', 'Faction Distribution')}</span>
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

            <PaperSheet tone="note">
              <span className="engraved-eyebrow">{t('ui.home.asymmetricAbilities', 'Asymmetric Factions')}</span>
              <p>{t('ui.home.rulesBody', 'Each faction remains its own seat with distinct mandates, passive bonuses, and specialized weaknesses. Human players may coordinate multiple seats, but every faction stays in play and every region remains covered.')}</p>
            </PaperSheet>
          </PaperSheet>
        </main>
      </div>
    </TableSurface>
  );
}

export { SessionSetupScreen as HomeScreen };
