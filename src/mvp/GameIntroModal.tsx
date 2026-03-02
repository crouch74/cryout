import { useState } from 'react';
import type { CompiledContent, EngineState } from '../../engine/index.ts';
import { localizeRulesetField, t } from '../i18n/index.ts';
import { Icon } from './icons/Icon.tsx';
import { PaperSheet } from './tabletop.tsx';

interface GameIntroModalProps {
    state: EngineState;
    content: CompiledContent;
}

export function GameIntroModal({ state, content }: GameIntroModalProps) {
    const [dismissed, setDismissed] = useState(false);

    // We only show this at the very beginning of the game.
    const isGameStart = state.round === 1 && state.commandLog.length === 1;

    if (!isGameStart || dismissed) {
        return null;
    }

    const modeTitle = state.mode === 'SYMBOLIC'
        ? t('ui.mode.symbolic', 'Symbolic Victory')
        : t('ui.mode.liberation', 'Liberation');

    return (
        <div className="paper-modal-shell context-intro-modal" role="presentation">
            <PaperSheet tone="folio" className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
                <header className="debug-panel-header">
                    <h2 id="intro-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
                        {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
                    </h2>
                </header>

                <div style={{ display: 'grid', gap: '16px', lineHeight: 1.6 }}>
                    <p style={{ fontSize: '1.1rem' }}>
                        {localizeRulesetField(content.ruleset.id, 'introduction', content.ruleset.introduction)}
                    </p>

                    <div style={{
                        background: 'var(--paper-inset)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--line-light)'
                    }}>
                        <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--burgundy)' }}>
                            {t('ui.game.currentMode', 'Current Mode: {{mode}}', { mode: modeTitle })}
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.95rem' }}>
                            {state.mode === 'SYMBOLIC'
                                ? t('ui.game.modeDescSymbolic', 'In Symbolic mode, the coalition must complete beacons to demonstrate unity before the 6th round. Keep extraction low, and use public attention to shift system pressure.')
                                : t('ui.game.modeDescLiberation', 'In Liberation mode, you must systematically sever extraction from every region. Drive extraction to 0 across the globe, balancing risks against the ever-growing System.')}
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="primary-button"
                        style={{ padding: '12px 24px', fontSize: '1.1rem' }}
                        onClick={() => setDismissed(true)}
                    >
                        {t('ui.game.beginStruggle', 'Begin the Struggle')} <Icon type="objective" size={18} />
                    </button>
                </div>
            </PaperSheet>
        </div>
    );
}
