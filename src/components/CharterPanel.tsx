// src/components/CharterPanel.tsx
import type { CharterClause } from '../engine/types';

export function CharterPanel({ clauses }: { clauses: CharterClause[] }) {
    const ratifiedCount = clauses.filter(c => c.status === 'ratified').length;

    return (
        <div className="charter-panel glass-panel">
            <h3>PEOPLE'S CHARTER ({ratifiedCount}/{clauses.length})</h3>
            <div className="clause-list">
                {clauses.map(clause => (
                    <div key={clause.id} className={`clause-item ${clause.status}`}>
                        <div className="clause-status-icon">
                            {clause.status === 'locked' && '🔒'}
                            {clause.status === 'unlocked' && '⚪'}
                            {clause.status === 'ratified' && '✅'}
                        </div>
                        <div className="clause-info">
                            <strong>{clause.title}</strong>
                            <p>{clause.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
