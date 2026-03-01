import type { CompiledContent, EngineCommand, EngineState } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';
import { ActionCard, PaperSheet } from './tabletop.tsx';

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
    <div className="paper-modal-shell" role="presentation">
      <PaperSheet tone="folio" className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="compromise-title">
        <span className="engraved-eyebrow">{t('ui.dealModal.title', 'Compromise Offer')}</span>
        <h2 id="compromise-title">{state.activeCompromise.prompt}</h2>

        <div className="paper-modal-options">
          {state.activeCompromise.options.map((option) => (
            <PaperSheet key={option.id} tone="plain">
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </PaperSheet>
          ))}
        </div>

        <div className="paper-vote-grid">
          {state.players.map((player) => {
            const role = content.roles[player.roleId];
            const vote = state.activeCompromise?.votes[player.seat];
            return (
              <PaperSheet key={player.seat} tone="note" className="paper-vote-row">
                <div>
                  <span className="engraved-eyebrow">{t('ui.game.seat', 'Seat {{seat}}', { seat: player.seat + 1 })}</span>
                  <strong>{role.shortName}</strong>
                </div>
                {vote === undefined ? (
                  <div className="paper-vote-actions">
                    <ActionCard onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: true })}>
                      <strong>{t('ui.dealModal.yes', 'YES')}</strong>
                    </ActionCard>
                    <ActionCard onClick={() => onCommand({ type: 'VoteCompromise', seat: player.seat, accept: false })}>
                      <strong>{t('ui.dealModal.no', 'NO')}</strong>
                    </ActionCard>
                  </div>
                ) : (
                  <span className="engraved-eyebrow">{vote ? t('ui.dealModal.yes', 'YES') : t('ui.dealModal.no', 'NO')}</span>
                )}
              </PaperSheet>
            );
          })}
        </div>
      </PaperSheet>
    </div>
  );
}
