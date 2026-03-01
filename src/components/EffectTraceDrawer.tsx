// src/components/EffectTraceDrawer.tsx
import type { EffectTrace } from '../engine/types';

interface EffectTraceDrawerProps {
    logEntry: { emoji: string; message: string; traces?: EffectTrace[] } | null;
    onClose: () => void;
}

export function EffectTraceDrawer({ logEntry, onClose }: EffectTraceDrawerProps) {
    if (!logEntry || !logEntry.traces) return null;

    return (
        <div className="drawer glass-panel open right">
            <div className="drawer-header">
                <h3>{logEntry.emoji} Effect Trace</h3>
                <button className="btn-close" onClick={onClose}>&times;</button>
            </div>
            <div className="drawer-content">
                <p className="log-summary">{logEntry.message}</p>
                <div className="trace-list">
                    {logEntry.traces.map((trace, idx) => (
                        <div key={idx} className={`trace-item ${trace.status}`}>
                            <div className="trace-header">
                                <span className="trace-status-icon">
                                    {trace.status === 'executed' ? '✅' : '❌'}
                                </span>
                                <strong>{getEffectSummary(trace.effect)}</strong>
                            </div>
                            {trace.reason && <p className="trace-error">{trace.reason}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function getEffectSummary(effect: any): string {
    if (effect.modify_track) return `Modify ${effect.modify_track.target} by ${effect.modify_track.delta}`;
    if (effect.add_token) return `Add ${effect.add_token.count} ${effect.add_token.token_type} to ${effect.add_token.region || 'global'}`;
    if (effect.remove_token) return `Remove ${effect.remove_token.count} ${effect.remove_token.token_type} from ${effect.remove_token.region || 'global'}`;
    if (effect.add_lock) return `Add ${effect.add_lock.lock_type} lock to ${effect.add_lock.region}`;
    if (effect.remove_lock) return `Remove ${effect.remove_lock.lock_type} lock from ${effect.remove_lock.region}`;
    if (effect.log) return `Log: ${effect.log.message}`;
    return "Unknown Effect";
}
