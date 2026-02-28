// ============================================================
// CrisisCard — Crisis Card Display Modal
// ============================================================

import type { Card } from '../game/types';

interface CrisisCardProps {
    card: Card;
    onDismiss: () => void;
}

export function CrisisCard({ card, onDismiss }: CrisisCardProps) {
    return (
        <div className="modal-overlay" onClick={onDismiss}>
            <div className="crisis-display" onClick={e => e.stopPropagation()}>
                <div className="crisis-badge">⚡ CRISIS</div>
                <div className="crisis-name">{card.name}</div>
                {card.region && card.region !== 'any' && (
                    <div style={{ fontFamily: 'var(--font-evidence)', fontSize: '0.7rem', color: 'var(--silver)', marginBottom: '8px' }}>
                        Region: {card.region}
                    </div>
                )}
                <div className="crisis-effect">{card.effect}</div>
                <div className="crisis-flavor">"{card.flavorText}"</div>
                <button className="btn btn-danger" onClick={onDismiss} style={{ marginTop: '16px' }}>
                    Continue
                </button>
            </div>
        </div>
    );
}
