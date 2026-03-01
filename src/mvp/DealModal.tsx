import type { CompiledContent, EngineCommand, EngineState } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';

interface DealModalProps {
  state: EngineState;
  content: CompiledContent;
  onCommand: (command: EngineCommand) => void;
}

export function DealModal({ state, content, onCommand }: DealModalProps) {
  if (!state.activeCompromise) {
    return null;
  }

  return (
    <div className="modal-shell">
      <div className="modal-card">
        <h2>{t('ui.dealModal.title', 'Compromise Offer')}</h2>
        <p>{state.activeCompromise.prompt}</p>

        <div className="compromise-options">
          {state.activeCompromise.options.map((option) => (
            <div key={option.id} className="compromise-option">
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </div>
          ))}
        </div>

        <div className="vote-grid">
          {state.players.map((player) => {
            const role = content.roles[player.roleId];
            const vote = state.activeCompromise?.votes[player.seat];
            return (
              <div key={player.seat} className="vote-row">
                <span>
                  Seat {player.seat + 1}: {role.shortName}
                </span>
                {vote === undefined ? (
                  <div className="vote-actions">
                    <button onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: true })}>
                      {t('ui.dealModal.yes', 'YES')}
                    </button>
                    <button onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: false })}>
                      {t('ui.dealModal.no', 'NO')}
                    </button>
                  </div>
                ) : (
                  <span>{vote ? t('ui.dealModal.yes', 'YES') : t('ui.dealModal.no', 'NO')}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
