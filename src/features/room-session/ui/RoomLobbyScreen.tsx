import { useMemo } from 'react';
import { listRulesets, type FactionId } from '../../../engine/index.ts';
import { formatNumber, localizeFactionField, localizeRulesetField, t } from '../../../i18n/index.ts';
import type { RoomLobbySnapshot } from '../api/schemas.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
import { GameIcon } from '../../../ui/icon/GameIcon.tsx';
import { EngravedHeader, LocaleSwitcher, PaperSheet, TableSurface, ThemePlate } from '../../../ui/layout/tabletop.tsx';

interface RoomLobbyScreenProps {
  roomId: string;
  snapshot: RoomLobbySnapshot;
  onClaimOwner: (ownerId: number) => Promise<void> | void;
  onStartRoom: () => Promise<void> | void;
  onBack: () => void;
  onCopyRoomLink: (roomLink: string) => Promise<void> | void;
}

function getFactionLabel(factionId: FactionId) {
  return localizeFactionField(factionId, 'name', factionId);
}

export function RoomLobbyScreen({
  roomId,
  snapshot,
  onClaimOwner,
  onStartRoom,
  onBack,
  onCopyRoomLink,
}: RoomLobbyScreenProps) {
  const ruleset = listRulesets().find((entry) => entry.id === snapshot.config.rulesetId);
  const seatFactionIds = snapshot.config.seatFactionIds ?? [];
  const seatOwnerIds = snapshot.config.seatOwnerIds ?? [];
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return `/rooms/${roomId}`;
    }
    return window.location.href;
  }, [roomId]);
  const ownerFactionMap = useMemo(() => {
    return snapshot.owners.map((owner) => ({
      ...owner,
      factionIds: seatFactionIds.filter((_, seat) => seatOwnerIds[seat] === owner.ownerId) as FactionId[],
    }));
  }, [seatFactionIds, seatOwnerIds, snapshot.owners]);
  const allClaimed = snapshot.owners.every((owner) => owner.claimed);
  const viewerOwnerId = snapshot.viewerOwnerId;
  const viewerIsHost = viewerOwnerId === snapshot.hostOwnerId;

  return (
    <TableSurface className="room-lobby-table shell-table shell-depth-surface">
      <div className="room-lobby-scene">
        <PaperSheet tone="board" className="room-lobby-board shell-board shell-surface shell-surface-focus">
          <EngravedHeader
            eyebrow={t('ui.room.lobbyEyebrow', 'Room Lobby')}
            title={localizeRulesetField(snapshot.config.rulesetId, 'name', ruleset?.name ?? snapshot.config.rulesetId)}
            detail={t(
              'ui.room.lobbyDetail',
              'Claim one player slot, gather the full coalition, then let the host launch the room into active play.',
            )}
            actions={(
              <div className="header-action-plates shell-actions">
                <LocaleSwitcher showLabel={false} compact />
                <ThemePlate
                  size="sm"
                  variant="utility"
                  label={(
                    <span className="plate-label-with-icon">
                      <GameIcon name="home" size="xs" ariaLabel={t('ui.guide.backHome', 'Back Home')} />
                      <span>{t('ui.guide.backHome', 'Back Home')}</span>
                    </span>
                  )}
                  onClick={onBack}
                />
              </div>
            )}
          />

          <div className="room-lobby-grid">
            <PaperSheet tone="tray" className="room-lobby-summary shell-card shell-surface-note">
              <span className="engraved-eyebrow shell-title-row"><Icon type="mandate" size="xs" ariaLabel={t('ui.room.roomCode', 'Room Code')} />{t('ui.room.roomCode', 'Room Code')}</span>
              <h2>{roomId}</h2>
              <p>{t('ui.room.shareRoom', 'Share this room link with the coalition so each player can claim their own slot.')}</p>
              <div className="room-lobby-link-row">
                <div className="room-lobby-link shell-inline-field">
                  <span className="room-lobby-link-text">{shareUrl}</span>
                  <button
                    type="button"
                    className="room-lobby-link-copy shell-icon-button"
                    onClick={() => onCopyRoomLink(shareUrl)}
                    aria-label={t('ui.room.copyRoomLink', 'Copy Room Link')}
                    title={t('ui.room.copyRoomLink', 'Copy Room Link')}
                  >
                    <GameIcon name="copy" size="sm" ariaLabel={t('ui.room.copyRoomLink', 'Copy Room Link')} />
                  </button>
                </div>
              </div>
              <div className="setup-stat-ribbon room-lobby-ribbon">
                <div><span>{t('ui.home.humanPlayerCount', 'Human Players')}</span><strong>{formatNumber(snapshot.config.humanPlayerCount)}</strong></div>
                <div><span>{t('ui.home.factionSeatCount', 'Faction Seats')}</span><strong>{formatNumber(seatFactionIds.length)}</strong></div>
                <div><span>{t('ui.home.mode', 'Mode')}</span><strong>{snapshot.config.mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic')}</strong></div>
              </div>
              <p className="room-lobby-note">
                {t(
                  'ui.room.secretMandatesOnline',
                  'Secret Mandates stay private in room play. The full board remains public, but each browser only controls its own factions.',
                )}
              </p>
            </PaperSheet>

            <PaperSheet tone="tray" className="room-lobby-owners shell-card shell-surface-note">
              <span className="engraved-eyebrow shell-title-row"><Icon type="bodies" size="xs" ariaLabel={t('ui.room.coalitionRoster', 'Coalition Roster')} />{t('ui.room.coalitionRoster', 'Coalition Roster')}</span>
              <div className="room-owner-grid">
                {ownerFactionMap.map((owner) => {
                  const isViewer = owner.ownerId === viewerOwnerId;
                  const canClaim = viewerOwnerId === null && !owner.claimed;

                  return (
                    <div key={owner.ownerId} className={`room-owner-card shell-card ${owner.claimed ? 'is-claimed' : 'is-open'}`.trim()}>
                      <div className="room-owner-card-header">
                        <div>
                          <strong>{t('ui.home.playerSeatGroup', 'Player {{seat}}', { seat: owner.ownerId + 1 })}</strong>
                          <span>
                            {owner.ownerId === snapshot.hostOwnerId
                              ? t('ui.room.hostSeat', 'Host seat')
                              : owner.claimed
                                ? t('ui.room.claimed', 'Claimed')
                                : t('ui.room.openSeat', 'Open')}
                          </span>
                        </div>
                        {isViewer ? <span className="room-owner-badge">{t('ui.room.you', 'You')}</span> : null}
                      </div>

                      <p>{owner.factionIds.map((factionId) => getFactionLabel(factionId)).join(', ')}</p>

                      {canClaim ? (
                        <ThemePlate
                          label={t('ui.room.claimSeat', 'Claim This Slot')}
                          onClick={() => onClaimOwner(owner.ownerId)}
                        />
                      ) : (
                        <div className="room-owner-status">
                          {owner.claimed
                            ? t('ui.room.seatLocked', 'This player slot is already claimed.')
                            : t('ui.room.waitingForClaim', 'Waiting for a player to claim this slot.')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </PaperSheet>
          </div>

          <PaperSheet tone="note" className="room-lobby-actions shell-card shell-surface-note">
            <span className="engraved-eyebrow shell-title-row"><Icon type="launchCampaign" size="xs" ariaLabel={t('ui.room.launchRoom', 'Launch Room')} />{t('ui.room.launchRoom', 'Launch Room')}</span>
            <p>
              {viewerIsHost
                ? allClaimed
                  ? t('ui.room.hostReadyToLaunch', 'Every player slot is claimed. Launch the room when the coalition is ready.')
                  : t('ui.room.hostWaitingToLaunch', 'The host can launch the room once every player slot is claimed.')
                : allClaimed
                  ? t('ui.room.waitingForHost', 'All slots are claimed. Waiting for the host to launch the room.')
                  : t('ui.room.waitingForCoalition', 'Waiting for the remaining players to claim their slots.')}
            </p>
            {viewerIsHost ? (
              <div className="header-action-plates shell-actions">
                <ThemePlate
                  size="sm"
                  variant="primary"
                  label={(
                    <span className="plate-label-with-icon">
                      <GameIcon name="launchCampaign" size="xs" ariaLabel={t('ui.room.startRoom', 'Start Room Match')} />
                      <span>{t('ui.room.startRoom', 'Start Room Match')}</span>
                    </span>
                  )}
                  disabled={!allClaimed}
                  onClick={() => onStartRoom()}
                />
              </div>
            ) : null}
          </PaperSheet>
        </PaperSheet>
      </div>
    </TableSurface>
  );
}
