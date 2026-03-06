import { useMemo } from 'react';
import { listRulesets, type FactionId } from '../../../engine/index.ts';
import { formatNumber, localizeFactionField, localizeRulesetField, t } from '../../../i18n/index.ts';
import type { RoomLobbySnapshot } from '../api/schemas.ts';
import { IconPlateButton } from '../../../ui/components/actions/IconPlateButton.tsx';
import { MetricRibbon } from '../../../ui/components/data/MetricRibbon.tsx';
import { CopyField } from '../../../ui/components/forms/CopyField.tsx';
import { SeatCard } from '../../../ui/components/seats/SeatCard.tsx';
import { ShellScreenLayout } from '../../../ui/components/shell/ShellScreenLayout.tsx';
import { ShellSectionCard } from '../../../ui/components/shell/ShellSectionCard.tsx';
import './room-lobby-screen.css';

interface RoomLobbyScreenProps {
  roomId: string;
  snapshot: RoomLobbySnapshot;
  onClaimOwner: (ownerId: number) => Promise<void> | void;
  onStartRoom: () => Promise<void> | void;
  onBack: () => void;
  onCopyRoomLink: (roomLink: string) => Promise<void> | void;
}

const EMPTY_SEAT_FACTION_IDS: FactionId[] = [];
const EMPTY_SEAT_OWNER_IDS: number[] = [];

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
  const seatFactionIds = snapshot.config.seatFactionIds ?? EMPTY_SEAT_FACTION_IDS;
  const seatOwnerIds = snapshot.config.seatOwnerIds ?? EMPTY_SEAT_OWNER_IDS;
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
    <ShellScreenLayout
      tableClassName="shell-table room-lobby-table"
      boardClassName="shell-board room-lobby-board"
      eyebrow={t('ui.room.lobbyEyebrow', 'Room Lobby')}
      title={localizeRulesetField(snapshot.config.rulesetId, 'name', ruleset?.name ?? snapshot.config.rulesetId)}
      detail={t(
        'ui.room.lobbyDetail',
        'Claim one player slot, gather the full coalition, then let the host launch the room into active play.',
      )}
      actions={(
        <div className="header-action-plates shell-actions">
          <IconPlateButton
            icon="home"
            size="sm"
            variant="utility"
            label={t('ui.guide.backHome', 'Back Home')}
            ariaLabel={t('ui.guide.backHome', 'Back Home')}
            onClick={onBack}
          />
        </div>
      )}
    >
      <div className="room-lobby-grid">
        <ShellSectionCard icon="mandate" title={t('ui.room.roomCode', 'Room Code')} className="shell-card room-lobby-summary">
          <h2>{roomId}</h2>
          <p>{t('ui.room.shareRoom', 'Share this room link with the coalition so each player can claim their own slot.')}</p>
          <div className="room-lobby-link-row">
            <CopyField
              value={shareUrl}
              copyLabel={t('ui.room.copyRoomLink', 'Copy Room Link')}
              ariaLabel={t('ui.room.copyRoomLink', 'Copy Room Link')}
              onCopy={() => onCopyRoomLink(shareUrl)}
            />
          </div>
          <MetricRibbon
            className="room-lobby-ribbon"
            columns={3}
            items={[
              { label: t('ui.home.humanPlayerCount', 'Human Players'), value: formatNumber(snapshot.config.humanPlayerCount) },
              { label: t('ui.home.factionSeatCount', 'Faction Seats'), value: formatNumber(seatFactionIds.length) },
              { label: t('ui.home.mode', 'Mode'), value: snapshot.config.mode === 'LIBERATION' ? t('ui.mode.liberation', 'Liberation') : t('ui.mode.symbolic', 'Symbolic') },
            ]}
          />
          <p className="room-lobby-note">
            {t(
              'ui.room.secretMandatesOnline',
              'Secret Mandates stay private in room play. The full board remains public, but each browser only controls its own factions.',
            )}
          </p>
        </ShellSectionCard>

        <ShellSectionCard icon="comrades" title={t('ui.room.coalitionRoster', 'Coalition Roster')} className="shell-card room-lobby-owners">
          <div className="room-owner-grid">
            {ownerFactionMap.map((owner) => {
              const isViewer = owner.ownerId === viewerOwnerId;
              const canClaim = viewerOwnerId === null && !owner.claimed;

              return (
                <SeatCard
                  key={owner.ownerId}
                  className={`room-owner-card ${owner.claimed ? 'is-claimed' : 'is-open'}`.trim()}
                  title={t('ui.home.playerSeatGroup', 'Player {{seat}}', { seat: owner.ownerId + 1 })}
                  subtitle={
                    owner.ownerId === snapshot.hostOwnerId
                      ? t('ui.room.hostSeat', 'Host seat')
                      : owner.claimed
                        ? t('ui.room.claimed', 'Claimed')
                        : t('ui.room.openSeat', 'Open')
                  }
                  badge={isViewer ? t('ui.room.you', 'You') : undefined}
                  status={owner.claimed ? 'claimed' : 'open'}
                  children={<p>{owner.factionIds.map((factionId) => getFactionLabel(factionId)).join(', ')}</p>}
                  action={
                    canClaim ? (
                      <IconPlateButton
                        icon="check"
                        label={t('ui.room.claimSeat', 'Claim This Slot')}
                        ariaLabel={t('ui.room.claimSeat', 'Claim This Slot')}
                        onClick={() => onClaimOwner(owner.ownerId)}
                      />
                    ) : (
                      <div className="room-owner-status">
                        {owner.claimed
                          ? t('ui.room.seatLocked', 'This player slot is already claimed.')
                          : t('ui.room.waitingForClaim', 'Waiting for a player to claim this slot.')}
                      </div>
                    )
                  }
                />
              );
            })}
          </div>
        </ShellSectionCard>
      </div>

      <ShellSectionCard icon="launchCampaign" title={t('ui.room.launchRoom', 'Launch Room')} tone="note" className="shell-card room-lobby-actions">
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
            <IconPlateButton
              icon="launchCampaign"
              size="sm"
              variant="primary"
              label={t('ui.room.startRoom', 'Start Room Match')}
              ariaLabel={t('ui.room.startRoom', 'Start Room Match')}
              disabled={!allClaimed}
              onClick={() => onStartRoom()}
            />
          </div>
        ) : null}
      </ShellSectionCard>
    </ShellScreenLayout>
  );
}
