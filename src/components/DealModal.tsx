// src/components/DealModal.tsx
export function DealModal({ isOpen, onClose, onResolve }: { isOpen: boolean, onClose: () => void, onResolve: (choice: string) => void }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <h2>COMPROMISE DEAL</h2>
                <p>The system offers immediate relief, but it comes at a long-term cost to civil rights.</p>

                <div className="deal-options">
                    <button className="btn-deal relief" onClick={() => onResolve('relief')}>
                        <strong>IMMEDIATE RELIEF</strong>
                        <span>+2 Relief Tokens, +1 Debt Token</span>
                    </button>
                    <button className="btn-deal rights" onClick={() => onResolve('rights')}>
                        <strong>PROTECT RIGHTS</strong>
                        <span>-1 Solidarity, Avoid Debt</span>
                    </button>
                </div>

                <button className="btn-cancel" onClick={onClose}>Decline Deal</button>
            </div>
        </div>
    );
}
