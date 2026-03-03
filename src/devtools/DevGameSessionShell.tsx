import { useEffect, useState } from 'react';
import {
  getAvailableDomains,
  getAvailableRegions,
  getSeatActions,
  getSeatDisabledReason,
  type ActionId,
  type CompiledContent,
  type DomainId,
  type EngineCommand,
  type EngineState,
  type QueuedIntent,
  type RegionId,
} from '../engine/index.ts';
import { t } from '../i18n/index.ts';
import { GameSessionScreen } from '../game/screens/GameSessionScreen.tsx';
import { DebugOverlay, type AutoPlaySpeedLevel } from './panels/DebugPanel.tsx';
import type { SessionViewport } from '../features/session-setup/model/sessionTypes.ts';

interface DevGameSessionShellProps {
  surface: 'local' | 'room';
  roomId?: string | null;
  state: EngineState;
  content: CompiledContent;
  viewState: SessionViewport;
  onViewStateChange: (patch: Partial<SessionViewport>) => void;
  onCommand: (command: EngineCommand) => Promise<void> | void;
  onToast: (toast: { tone: 'info' | 'success' | 'warning' | 'error'; message: string; title?: string; dismissAfterMs?: number }) => void;
  onBack: () => void;
  authorizedOwnerId?: number | null;
}

const AUTOPLAY_SPEED_DELAYS: Record<AutoPlaySpeedLevel, number> = {
  1: 1800,
  2: 1300,
  3: 900,
  4: 600,
  5: 320,
};

const TERMINAL_PHASES: EngineState['phase'][] = ['WIN', 'LOSS'];

function createAutoPlayIntent(
  state: EngineState,
  content: CompiledContent,
  seat: number,
  actionId: ActionId,
): Omit<QueuedIntent, 'slot'> | null {
  const action = content.actions[actionId];
  const player = state.players[seat];
  if (!action || !player) {
    return null;
  }

  const compatibleCardId = player.resistanceHand.find((cardId) => {
    const card = content.cards[cardId];
    return card?.deck === 'resistance' && (!action.cardType || card.type === action.cardType);
  });
  const regionCandidates = action.needsRegion ? getAvailableRegions(content) : [undefined];
  const domainCandidates = action.needsDomain ? getAvailableDomains(content) : [undefined];
  const targetSeatCandidates = action.needsTargetSeat
    ? state.players.filter((candidate) => candidate.seat !== seat).map((candidate) => candidate.seat)
    : [undefined];

  for (const regionId of regionCandidates) {
    const bodiesInRegion = regionId ? state.regions[regionId].bodiesPresent[seat] ?? 0 : 0;
    const maxBodies = action.needsBodies ? Math.max(1, bodiesInRegion) : 1;
    const bodyCandidates = action.needsBodies
      ? Array.from({ length: maxBodies }, (_, index) => index + 1)
      : [undefined];
    const evidenceCandidates = action.needsEvidence
      ? Array.from({ length: Math.max(player.evidence, 0) + 1 }, (_, index) => index)
      : [undefined];

    for (const domainId of domainCandidates) {
      for (const targetSeat of targetSeatCandidates) {
        for (const bodiesCommitted of bodyCandidates) {
          for (const evidenceCommitted of evidenceCandidates) {
            const intent: Omit<QueuedIntent, 'slot'> = {
              actionId,
              regionId: regionId as RegionId | undefined,
              domainId: domainId as DomainId | undefined,
              targetSeat,
              bodiesCommitted,
              evidenceCommitted,
              cardId: action.needsCard ? compatibleCardId : undefined,
            };
            const disabledReason = getSeatDisabledReason(state, content, seat, intent);
            if (!disabledReason.disabled) {
              return intent;
            }
          }
        }
      }
    }
  }

  return null;
}

function getNextAutoPlayCommand(state: EngineState, content: CompiledContent): EngineCommand | null {
  if (state.phase === 'SYSTEM') {
    return { type: 'ResolveSystemPhase' };
  }

  if (state.phase === 'COALITION') {
    for (const player of state.players) {
      if (player.actionsRemaining > 0) {
        for (const action of getSeatActions(content)) {
          const intent = createAutoPlayIntent(state, content, player.seat, action.id);
          if (intent) {
            return {
              type: 'QueueIntent',
              seat: player.seat,
              action: intent,
            };
          }
        }
        return null;
      }

      if (!player.ready) {
        return { type: 'SetReady', seat: player.seat, ready: true };
      }
    }

    return { type: 'CommitCoalitionIntent' };
  }

  if (state.phase === 'RESOLUTION') {
    return { type: 'ResolveResolutionPhase' };
  }

  return null;
}

export default function DevGameSessionShell({
  surface,
  roomId = null,
  state,
  content,
  viewState,
  onViewStateChange,
  onCommand,
  onToast,
  onBack,
  authorizedOwnerId,
}: DevGameSessionShellProps) {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showDebugSnapshot, setShowDebugSnapshot] = useState(false);
  const [autoPlayRounds, setAutoPlayRounds] = useState('1');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<AutoPlaySpeedLevel>(3);
  const [autoPlayTargetRound, setAutoPlayTargetRound] = useState<number | null>(null);
  const [autoPlayRunning, setAutoPlayRunning] = useState(false);
  const [autoPlayStatus, setAutoPlayStatus] = useState<string | null>(null);

  useEffect(() => {
    if (surface !== 'local' && autoPlayRunning) {
      console.log('🧪 [DevPanel] Autoplay halted because the table is no longer local.');
      setAutoPlayRunning(false);
      setAutoPlayTargetRound(null);
      setAutoPlayStatus(t('ui.debug.autoplayLocalOnly', 'Autoplay is only available on local tables.'));
    }
  }, [autoPlayRunning, surface]);

  useEffect(() => {
    if (!autoPlayRunning) {
      return;
    }

    const stopAutoPlay = (message: string) => {
      console.log(`🧪 [DevPanel] ${message}`);
      setAutoPlayRunning(false);
      setAutoPlayTargetRound(null);
      setAutoPlayStatus(message);
    };

    if (TERMINAL_PHASES.includes(state.phase)) {
      stopAutoPlay(
        state.phase === 'WIN'
          ? t('ui.debug.autoplayWon', 'Autoplay stopped because the coalition won.')
          : t('ui.debug.autoplayLost', 'Autoplay stopped because the coalition lost.'),
      );
      return;
    }

    if (autoPlayTargetRound !== null && state.round >= autoPlayTargetRound && state.phase === 'SYSTEM') {
      stopAutoPlay(t('ui.debug.autoplayFinished', 'Autoplay finished at the requested round mark.'));
      return;
    }

    const command = getNextAutoPlayCommand(state, content);
    if (!command) {
      stopAutoPlay(t('ui.debug.autoplayNoCommand', 'Autoplay found no legal command and stopped.'));
      return;
    }

    const timer = window.setTimeout(() => {
      console.log(`🎲 [DevPanel] Autoplay dispatching ${command.type} during ${state.phase}.`);
      void Promise.resolve(onCommand(command)).catch((error) => {
        console.error('🧪 [DevPanel] Autoplay command failed.', error);
        setAutoPlayRunning(false);
        setAutoPlayTargetRound(null);
        setAutoPlayStatus(t('ui.debug.autoplayCommandError', 'Autoplay stopped after a command error.'));
      });
    }, AUTOPLAY_SPEED_DELAYS[autoPlaySpeed]);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoPlayRunning, autoPlaySpeed, autoPlayTargetRound, content, onCommand, state]);

  const handleAutoPlayStart = () => {
    if (surface !== 'local') {
      setAutoPlayStatus(t('ui.debug.autoplayLocalOnly', 'Autoplay is only available on local tables.'));
      return;
    }

    const parsedRounds = Number.parseInt(autoPlayRounds, 10);
    if (!Number.isFinite(parsedRounds) || parsedRounds <= 0) {
      setAutoPlayStatus(t('ui.debug.autoplayInvalid', 'Enter a valid round count before starting autoplay.'));
      return;
    }

    const roundsToPlay = Math.min(parsedRounds, 24);
    setAutoPlayRounds(String(roundsToPlay));
    setAutoPlayTargetRound(state.round + roundsToPlay);
    setAutoPlayRunning(true);
    setAutoPlayStatus(t('ui.debug.autoplayArmed', 'Autoplay armed for {{count}} rounds.', { count: roundsToPlay }));
    console.log(`🧪 [DevPanel] Autoplay armed for ${roundsToPlay} rounds at speed ${autoPlaySpeed}.`);
  };

  const handleAutoPlayStop = () => {
    console.log('🧪 [DevPanel] Autoplay stopped by user.');
    setAutoPlayRunning(false);
    setAutoPlayTargetRound(null);
    setAutoPlayStatus(t('ui.debug.autoplayStopped', 'Autoplay stopped.'));
  };

  const autoPlayStatusText = autoPlayRunning
    ? t('ui.debug.autoplayTick', 'Autoplay: round {{round}}, phase {{phase}}.', {
      round: state.round,
      phase: t(`ui.phases.${state.phase}`, state.phase),
    })
    : autoPlayStatus;

  return (
    <>
      <GameSessionScreen
        state={state}
        content={content}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        onCommand={onCommand}
        onToast={onToast}
        onBack={onBack}
        authorizedOwnerId={authorizedOwnerId}
        autoAdvanceTransientUi={autoPlayRunning}
      />

      <button
        type="button"
        className={`dev-panel-toggle ${showDevPanel ? 'is-active' : ''}`.trim()}
        onClick={() => setShowDevPanel((current) => !current)}
        aria-expanded={showDevPanel}
        aria-controls="debug-panel-title"
      >
        <span className="dev-panel-emoji" aria-hidden="true">🛠</span>
        <span className="dev-panel-label">
          {showDevPanel ? t('ui.debug.hidePanel', 'Hide Dev Panel') : t('ui.debug.showPanel', 'Dev Panel')}
        </span>
      </button>

      {showDevPanel ? (
        <DebugOverlay
          state={state}
          content={content}
          roomId={roomId}
          showDebugSnapshot={showDebugSnapshot}
          autoPlayRounds={autoPlayRounds}
          autoPlaySpeed={autoPlaySpeed}
          autoPlayRunning={autoPlayRunning}
          autoPlayStatus={autoPlayStatusText}
          onToggleDebugSnapshot={() => setShowDebugSnapshot((current) => !current)}
          onAutoPlayRoundsChange={setAutoPlayRounds}
          onAutoPlaySpeedChange={setAutoPlaySpeed}
          onAutoPlayStart={handleAutoPlayStart}
          onAutoPlayStop={handleAutoPlayStop}
          onClose={() => setShowDevPanel(false)}
        />
      ) : null}
    </>
  );
}
