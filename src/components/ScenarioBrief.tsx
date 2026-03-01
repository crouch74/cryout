// src/components/ScenarioBrief.tsx
import { useState } from 'react';

export function ScenarioBrief({ title, description, rules }: { title: string, description: string, rules: string[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="scenario-brief glass-panel">
            <h4>{title}</h4>
            <p className="scenario-desc" style={{ display: isExpanded ? 'block' : '-webkit-box', WebkitLineClamp: isExpanded ? 'none' : 2, WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden' }}>
                {description}
            </p>
            <span className="scenario-expand" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? 'less' : 'more...'}
            </span>
            <div className="special-rules" style={{ marginTop: '1rem' }}>
                {rules.map((rule, idx) => (
                    <span key={idx} className="rule-chip">🛡️ {rule}</span>
                ))}
            </div>
        </div>
    );
}
