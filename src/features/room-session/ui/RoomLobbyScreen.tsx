import { useMemo } from 'react';
import { listRulesets, type FactionId } from '../../../engine/index.ts';
import { formatNumber, localizeFactionField, localizeRulesetField, t } from '../../../i18n/index.ts';
import type { RoomLobbySnapshot } from '../api/schemas.ts';
import { Icon } from '../../../ui/icon/Icon.tsx';
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
    <TableSurface className="room-lobby-table">
      <div className="room-lobby-scene">
        <PaperSheet tone="board" className="room-lobby-board">
          <EngravedHeader
            eyebrow={t('ui.room.lobbyEyebrow', 'Room Lobby')}
            title={localizeRulesetField(snapshot.config.rulesetId, 'name', ruleset?.name ?? snapshot.config.rulesetId)}
            detail={t(
              'ui.room.lobbyDetail',
              'Claim one player slot, gather the full coalition, then let the host launch the room into active play.',
            )}
            actions={(
              <div className="header-action-plates">
                <LocaleSwitcher />
                <ThemePlate label={t('ui.guide.backHome', 'Back Home')} onClick={onBack} />
              </div>
            )}
          />

          <div className="room-lobby-grid">
            <PaperSheet tone="tray" className="room-lobby-summary">
              <span className="engraved-eyebrow">{t('ui.room.roomCode', 'Room Code')}</span>
              <h2>{roomId}</h2>
              <p>{t('ui.room.shareRoom', 'Share this room link with the coalition so each player can claim their own slot.')}</p>
              <div className="room-lobby-link-row">
                <div className="room-lobby-link">
                  <span className="room-lobby-link-text">{shareUrl}</span>
                  <button
                    type="button"
                    className="room-lobby-link-copy"
                    onClick={() => onCopyRoomLink(shareUrl)}
                    aria-label={t('ui.room.copyRoomLink', 'Copy Room Link')}
                    title={t('ui.room.copyRoomLink', 'Copy Room Link')}
                  >
                    <Icon type="copy" size={15} />
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

            <PaperSheet tone="tray" className="room-lobby-owners">
              <span className="engraved-eyebrow">{t('ui.room.coalitionRoster', 'Coalition Roster')}</span>
              <div className="room-owner-grid">
                {ownerFactionMap.map((owner) => {
                  const isViewer = owner.ownerId === viewerOwnerId;
                  const canClaim = viewerOwnerId === null && !owner.claimed;

                  return (
                    <div key={owner.ownerId} className={`room-owner-card ${owner.claimed ? 'is-claimed' : 'is-open'}`.trim()}>
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

          <PaperSheet tone="note" className="room-lobby-actions">
            <span className="engraved-eyebrow">{t('ui.room.launchRoom', 'Launch Room')}</span>
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
              <div className="header-action-plates">
                <ThemePlate
                  label={t('ui.room.startRoom', 'Start Room Match')}
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
