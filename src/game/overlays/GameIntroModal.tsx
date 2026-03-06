import type { CompiledContent, EngineState } from '../../engine/index.ts';
import { localizeRulesetField, t } from '../../i18n/index.ts';
import { Icon } from '../../ui/icon/Icon.tsx';
import { ModalFrame } from '../../ui/components/overlay/ModalFrame.tsx';
import { UiButton } from '../../ui/components/actions/UiButton.tsx';

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
    <ModalFrame
      open={open}
      size="md"
      variant="game"
      title={localizeRulesetField(content.ruleset.id, 'name', content.ruleset.name)}
      description={localizeRulesetField(content.ruleset.id, 'introduction', content.ruleset.introduction)}
      onRequestClose={onDismiss}
      shellClassName="paper-modal-shell context-intro-modal"
      className="paper-modal-card"
    >
      <div className="game-intro-content">
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
        <UiButton
          variant="primary"
          onClick={onDismiss}
          icon={<Icon type="objective" size="md" />}
        >
          {t('ui.game.beginStruggle', 'Begin the Struggle')}
        </UiButton>
      </div>
    </ModalFrame>
  );
}
