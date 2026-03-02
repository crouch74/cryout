// src/components/EffectTraceDrawer.tsx
import type { EffectTrace } from '../engine/types';
import { formatNumber, t } from '../i18n/index.ts';

interface EffectTraceDrawerProps {
    logEntry: { emoji: string; message: string; traces?: EffectTrace[] } | null;
    onClose: () => void;
}

export function EffectTraceDrawer({ logEntry, onClose }: EffectTraceDrawerProps) {
    if (!logEntry || !logEntry.traces) return null;

    return (
        <div className="drawer glass-panel open right">
            <div className="drawer-header">
                <h3>{logEntry.emoji} {t('ui.legacyDashboard.effectTrace', 'Effect Trace')}</h3>
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
    if (effect.modify_track) {
        return t('ui.legacyDashboard.effectModifyTrack', 'Modify {{target}} by {{delta}}', {
            target: effect.modify_track.target,
            delta: formatNumber(effect.modify_track.delta),
        });
    }
    if (effect.add_token) {
        return t('ui.legacyDashboard.effectAddToken', 'Add {{count}} {{tokenType}} to {{region}}', {
            count: effect.add_token.count,
            tokenType: effect.add_token.token_type,
            region: effect.add_token.region || t('ui.legacyDashboard.global', 'global'),
        });
    }
    if (effect.remove_token) {
        return t('ui.legacyDashboard.effectRemoveToken', 'Remove {{count}} {{tokenType}} from {{region}}', {
            count: effect.remove_token.count,
            tokenType: effect.remove_token.token_type,
            region: effect.remove_token.region || t('ui.legacyDashboard.global', 'global'),
        });
    }
    if (effect.add_lock) {
        return t('ui.legacyDashboard.effectAddLock', 'Add {{lockType}} lock to {{region}}', {
            lockType: effect.add_lock.lock_type,
            region: effect.add_lock.region,
        });
    }
    if (effect.remove_lock) {
        return t('ui.legacyDashboard.effectRemoveLock', 'Remove {{lockType}} lock from {{region}}', {
            lockType: effect.remove_lock.lock_type,
            region: effect.remove_lock.region,
        });
    }
    if (effect.log) {
        return t('ui.legacyDashboard.effectLog', 'Log: {{message}}', {
            message: effect.log.message,
        });
    }
    return t('ui.legacyDashboard.unknownEffect', 'Unknown Effect');
}
