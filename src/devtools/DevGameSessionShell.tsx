import { useEffect, useState } from 'react';
import {
  type CompiledContent,
  type EngineCommand,
  type EngineState,
} from '../engine/index.ts';
import { t } from '../i18n/index.ts';
import { GameSessionScreen } from '../game/screens/GameSessionScreen.tsx';
import { DebugOverlay, type AutoPlaySpeedLevel } from './panels/DebugPanel.tsx';
import type { SessionViewport } from '../features/session-setup/model/sessionTypes.ts';
import { getAutoPlayLogMessage, getAutoPlaySelectionPreview, selectAutoPlayDecision } from './autoPlaySelector.ts';

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

    const selection = selectAutoPlayDecision(state, content);
    if (!selection) {
      stopAutoPlay(t('ui.debug.autoplayNoCommand', 'Autoplay found no legal command and stopped.'));
      return;
    }

    const timer = window.setTimeout(() => {
      if (selection.command.type === 'QueueIntent') {
        onViewStateChange({
          focusedSeat: selection.command.seat,
          regionId: selection.command.action.regionId ?? null,
        });
      }

      const preview = getAutoPlaySelectionPreview(state, content, selection);
      if (preview) {
        onToast({
          tone: 'info',
          title: preview.title,
          message: preview.message,
          dismissAfterMs: 1400,
        });
      }

      console.log(getAutoPlayLogMessage(state, content, selection));
      void Promise.resolve(onCommand(selection.command)).catch((error) => {
        console.error('🧪 [DevPanel] Autoplay command failed.', error);
        setAutoPlayRunning(false);
        setAutoPlayTargetRound(null);
        setAutoPlayStatus(t('ui.debug.autoplayCommandError', 'Autoplay stopped after a command error.'));
      });
    }, AUTOPLAY_SPEED_DELAYS[autoPlaySpeed]);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoPlayRunning, autoPlaySpeed, autoPlayTargetRound, content, onCommand, onToast, onViewStateChange, state]);

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
