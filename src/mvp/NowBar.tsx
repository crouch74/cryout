import { type EngineCommand, type EngineState, getTemperatureBand } from '../../engine/index.ts';
import { t } from '../i18n/index.ts';

interface NowBarProps {
    state: EngineState;
    onCommand: (command: EngineCommand) => void;
    worldPhaseSelected: boolean;
    setWorldPhaseSelected: (selected: boolean) => void;
}

export function NowBar({ state, onCommand, worldPhaseSelected, setWorldPhaseSelected }: NowBarProps) {
    const getPhaseDetails = () => {
        switch (state.phase) {
            case 'WORLD': {
                const band = getTemperatureBand(state.temperature);
                return {
                    step: '1/4',
                    name: t('ui.phases.WORLD', 'World Phase'),
                    actionable: t('ui.now.worldAction', 'Draw {{count}} crisis card{{plural}} at Band {{band}}', { count: band.crisisCount, plural: band.crisisCount === 1 ? '' : 's', band: band.band }),
                    blockers: t('ui.now.worldBlockers', 'Phase locked until crisis is selected'),
                    choices: t('ui.now.worldChoices', 'Select crisis to enable phase resolution.'),
                };
            }
            case 'COALITION': {
                const unreadySeats = state.players.filter(p => !p.ready).map(p => `Seat ${p.seat + 1}`);
                return {
                    step: '2/4',
                    name: t('ui.phases.COALITION', 'Coalition Phase'),
                    actionable: t('ui.now.coalitionAction', 'Plan and queue intent actions in the Coalition Desk.'),
                    blockers: unreadySeats.length > 0 ? t('ui.now.coalitionBlockers', 'Waiting for: {{seats}} (Planning)', { seats: unreadySeats.join(', ') }) : null,
                    choices: unreadySeats.length > 0 ? t('ui.now.coalitionChoices', 'Players selecting intents') : t('ui.now.coalitionReady', 'Commit coalition intent'),
                };
            }
            case 'COMPROMISE': {
                return {
                    step: '3/4',
                    name: t('ui.phases.COMPROMISE', 'Compromise Phase'),
                    actionable: t('ui.now.compromiseAction', 'Vote on the current compromise modal.'),
                    blockers: t('ui.now.compromiseBlockers', 'Compromise vote is live blocking the board.'),
                    choices: t('ui.now.compromiseChoices', 'Resolve the modal to continue.'),
                };
            }
            case 'END': {
                return {
                    step: '4/4',
                    name: t('ui.phases.END', 'End Phase'),
                    actionable: t('ui.now.endAction', 'Resolve end phase to advance round.'),
                    blockers: null,
                    choices: t('ui.now.endChoices', 'Ready to advance round.'),
                };
            }
            case 'WIN':
            case 'LOSS': {
                return {
                    step: '-',
                    name: t('ui.phases.GAMEOVER', 'Game Over'),
                    actionable: t('ui.now.gameOverAction', 'Review the charter outcome.'),
                    blockers: null,
                    choices: t('ui.now.gameOverChoices', 'Export a shareable state if desired.'),
                };
            }
            default:
                return {
                    step: '-',
                    name: state.phase,
                    actionable: '-',
                    blockers: null,
                    choices: '-',
                };
        }
    };

    const details = getPhaseDetails();

    return (
        <div className="now-bar shell-card">
            <div className="now-bar-content">
                <div className="now-bar-phase">
                    <span className="eyebrow">{t('ui.now.phase', 'Phase')}</span>
                    <strong>{details.name} ({t('ui.now.step', 'Step {{step}}', { step: details.step })})</strong>
                </div>

                <div className="now-bar-details">
                    <div className="now-detail-row">
                        <span className="eyebrow">{t('ui.now.youCan', 'You can')}</span>
                        <p>{details.actionable}</p>
                    </div>
                    <div className="now-detail-row">
                        <span className="eyebrow">{t('ui.now.choices', 'Your choices')}</span>
                        <p>{details.choices}</p>
                    </div>
                    {details.blockers && (
                        <div className="now-detail-row blocker">
                            <span className="eyebrow">{t('ui.now.blockedBy', 'Blocked by')}</span>
                            <p>{details.blockers}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="now-bar-actions">
                {state.phase === 'WORLD' && (
                    <div className="two-step-resolve">
                        <button
                            className={`secondary-button ${worldPhaseSelected ? 'active' : ''}`}
                            onClick={() => setWorldPhaseSelected(!worldPhaseSelected)}>
                            {t('ui.now.selectCrisis', '1. Select Crisis')}
                        </button>
                        <button
                            className="primary-button"
                            disabled={!worldPhaseSelected}
                            onClick={() => onCommand({ type: 'ResolveWorldPhase' })}>
                            {t('ui.game.resolveWorldPhase', '2. Resolve World Phase')}
                        </button>
                    </div>
                )}
                {state.phase === 'COALITION' && (
                    <button
                        className="primary-button map-primary-action"
                        disabled={state.players.filter(p => !p.ready).length > 0}
                        onClick={() => onCommand({ type: 'CommitCoalitionIntent' })}>
                        {t('ui.game.commitCoalitionIntent', 'Commit Coalition Intent')}
                    </button>
                )}
                {state.phase === 'END' && (
                    <button
                        className="primary-button map-primary-action"
                        onClick={() => onCommand({ type: 'ResolveEndPhase' })}>
                        {t('ui.game.resolveEndPhase', 'Resolve End Phase')}
                    </button>
                )}
            </div>
        </div>
    );
}
