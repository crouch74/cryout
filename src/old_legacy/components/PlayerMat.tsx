// ============================================================
// PlayerMat — Player Info, Resources, and Card Hand
// ============================================================

import type { Player, Card } from '../game/types';

interface PlayerMatProps {
    player: Player;
    isActive: boolean;
    selectedCards: string[];
    onToggleCard: (cardId: string) => void;
}

const FACTION_EMOJIS: Record<string, string> = {
    forest_defenders: '🌿',
    the_sumud: '🫒',
    riverkeepers: '🌊',
    the_guardians: '🌳',
};

export function PlayerMat({ player, isActive, selectedCards, onToggleCard }: PlayerMatProps) {
    return (
        <div className={`player-mat faction-${player.faction.id} ${isActive ? 'active' : ''}`}>
            <div
                className="player-avatar"
                style={{ background: player.faction.themeColor + '33', border: `2px solid ${player.faction.themeColor}` }}
            >
                {FACTION_EMOJIS[player.faction.id] || '🏴'}
            </div>

            <div className="player-info">
                <div className="player-name">{player.faction.displayName}</div>
                <div className="player-ability">{player.faction.abilityName}</div>
            </div>

            <div className="player-resources">
                <div className="resource-counter bodies" title="Bodies (People Power)">
                    🔴 {player.bodies}
                </div>
                <div className="resource-counter evidence" title="Evidence Cards">
                    🔵 {player.evidenceHand.length}
                </div>
                {isActive && (
                    <div className="resource-counter actions" title="Actions Remaining">
                        ⚡ {player.actionsRemaining}
                    </div>
                )}
            </div>

            {/* Card Hand */}
            {isActive && (player.evidenceHand.length > 0 || player.resistanceHand.length > 0) && (
                <div className="card-hand">
                    {player.resistanceHand.map(card => (
                        <CardThumbnail
                            key={card.id}
                            card={card}
                            deckType="resistance"
                            isSelected={selectedCards.includes(card.id)}
                            onClick={() => onToggleCard(card.id)}
                        />
                    ))}
                    {player.evidenceHand.map(card => (
                        <CardThumbnail
                            key={card.id}
                            card={card}
                            deckType="evidence"
                            isSelected={selectedCards.includes(card.id)}
                            onClick={() => onToggleCard(card.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CardThumbnail({
    card, deckType, isSelected, onClick,
}: {
    card: Card;
    deckType: 'resistance' | 'evidence';
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <div
            className={`game-card ${deckType} ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            title={`${card.name}\n${card.effect}\n\n"${card.flavorText}"`}
        >
            <div className="card-name">{card.name}</div>
            <div className="card-type-badge">{card.type}</div>
            {card.campaignBonus && (
                <div className="card-bonus">+{card.campaignBonus}</div>
            )}
            <div className="card-flavor">{card.flavorText.substring(0, 60)}...</div>
        </div>
    );
}
