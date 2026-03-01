// src/components/PhaseTimeline.tsx
export function PhaseTimeline({ phase }: { phase: string }) {
    const phases = ['WORLD', 'COALITION', 'COMPROMISE', 'END'];
    const currentIdx = phases.indexOf(phase);

    return (
        <div className="phase-timeline">
            {phases.map((p, idx) => (
                <div
                    key={p}
                    className={`phase-step ${p === phase ? 'active' : ''} ${idx < currentIdx ? 'past' : ''}`}
                >
                    <div className="phase-dot" />
                    <span className="phase-name">{p}</span>
                </div>
            ))}
        </div>
    );
}
