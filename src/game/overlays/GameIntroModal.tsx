import type { CompiledContent, EngineState } from '../../engine/index.ts';
import { localizeRulesetField, t } from '../../i18n/index.ts';
import { Icon } from '../../ui/icon/Icon.tsx';
import { PaperSheet } from '../../ui/layout/tabletop.tsx';

interface GameIntroModalProps {
  open: boolean;
  state: EngineState;
  content: CompiledContent;
  onDismiss: () => void;
}

export function GameIntroModal({ open, state, content, onDismiss }: GameIntroModalProps) {
  if (!open) {
    return null;
  }

  const modeTitle = state.mode === 'SYMBOLIC'
    ? t('ui.mode.symbolic', 'Symbolic Victory')
    : t('ui.mode.liberation', 'Liberation');

  return (
    <div className="paper-modal-shell context-intro-modal" role="presentation">
      <PaperSheet tone="folio" className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <header className="debug-panel-header game-intro-header">
          <h2 id="intro-title" className="game-intro-title">
            {localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
          </h2>
        </header>

        <div className="game-intro-content">
          <p className="game-intro-description">
            {localizeRulesetField(content.ruleset.id, 'introduction', content.ruleset.introduction)}
          </p>

          <div className="game-intro-mode-card">
            <strong className="game-intro-mode-title">
              {t('ui.game.currentMode', 'Current Mode: {{mode}}', { mode: modeTitle })}
            </strong>
            <p className="game-intro-mode-description">
              {state.mode === 'SYMBOLIC'
                ? t('ui.game.modeDescSymbolic', 'In Symbolic mode, the coalition must complete beacons to demonstrate unity before the 6th round. Keep extraction low, and use public attention to shift system pressure.')
                : t('ui.game.modeDescLiberation', 'In Liberation mode, you must systematically sever extraction from every region. Drive extraction to 0 across the globe, balancing risks against the ever-growing System.')}
            </p>
          </div>
        </div>

        <div className="game-intro-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onDismiss}
          >
            {t('ui.game.beginStruggle', 'Begin the Struggle')} <Icon type="objective" size="md" />
          </button>
        </div>
      </PaperSheet>
    </div>
  );
}
