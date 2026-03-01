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
    <div className="modal-shell" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="compromise-title">
        <h2 id="compromise-title">{t('ui.dealModal.title', 'Compromise Offer')}</h2>
        <p>{state.activeCompromise.prompt}</p>

        <div className="modal-option-grid">
          {state.activeCompromise.options.map((option) => (
            <article key={option.id} className="shell-card modal-option-card">
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </article>
          ))}
        </div>

        <div className="modal-vote-grid">
          {state.players.map((player) => {
            const role = content.roles[player.roleId];
            const vote = state.activeCompromise?.votes[player.seat];
            return (
              <div key={player.seat} className="modal-vote-row">
                <span>
                  Seat {player.seat + 1}: {role.shortName}
                </span>
                {vote === undefined ? (
                  <div className="modal-vote-actions">
                    <button className="primary-button compact-button" onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: true })}>
                      {t('ui.dealModal.yes', 'YES')}
                    </button>
                    <button className="secondary-button compact-button" onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: false })}>
                      {t('ui.dealModal.no', 'NO')}
                    </button>
                  </div>
                ) : (
                  <span className="status-pill neutral">{vote ? t('ui.dealModal.yes', 'YES') : t('ui.dealModal.no', 'NO')}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
