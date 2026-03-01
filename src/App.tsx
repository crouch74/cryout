import { useEffect, useState } from 'react';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  listScenarios,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
} from '../engine/index.ts';
import { GameScreen } from './mvp/GameScreen.tsx';
import { GuidelinesScreen } from './mvp/GuidelinesScreen.tsx';
import { HomeScreen } from './mvp/HomeScreen.tsx';
import { localizeContent, t } from './i18n/index.ts';
import {
  DEFAULT_GAME_VIEW_STATE,
  buildAppPath,
  parseAppRoute,
  type AppRoute,
  type GameViewState,
  type SetupConfig,
} from './mvp/urlState.ts';
import './index.css';

interface ActiveSession {
  surface: 'local' | 'room';
  roomId: string | null;
  roomUrl: string;
  content: CompiledContent;
  state: EngineState;
}

const AUTOSAVE_KEY = 'dignity-rising-autosave';
const DEFAULT_SCENARIO_ID = listScenarios()[0]?.id ?? 'witness_dignity';

const DEFAULT_CONFIG: SetupConfig = {
  surface: 'local',
  scenarioId: DEFAULT_SCENARIO_ID,
  mode: 'CORE',
  playerCount: 2,
  roleIds: [
    'organizer',
    'investigative_journalist',
    'human_rights_lawyer',
    'climate_energy_planner',
  ],
  seed: Math.floor(Date.now() % 1_000_000),
  roomUrl: 'http://localhost:3010',
  expansionIds: [],
};

function generateSessionSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] >>> 0;
}

function clampPlayerCount(playerCount: number): 2 | 3 | 4 {
  if (playerCount === 3 || playerCount === 4) {
    return playerCount;
  }

  return 2;
}

function createConfigFromState(
  state: EngineState,
  previous: SetupConfig,
  surface: SetupConfig['surface'],
): SetupConfig {
  return {
    ...previous,
    surface,
    scenarioId: state.scenarioId,
    mode: state.mode,
    playerCount: clampPlayerCount(state.players.length),
    roleIds: state.players.map((player) => player.roleId),
    seed: state.seed,
  };
}

export default function App() {
  const [initialRoute] = useState(() => parseAppRoute(window.location.pathname, DEFAULT_SCENARIO_ID));
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => ({
    ...DEFAULT_CONFIG,
    scenarioId: initialRoute.scenarioId,
    surface: initialRoute.page === 'room' ? 'room' : DEFAULT_CONFIG.surface,
  }));
  const [viewState, setViewState] = useState<GameViewState>(DEFAULT_GAME_VIEW_STATE);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(initialRoute.page === 'room' && Boolean(initialRoute.roomId));

  useEffect(() => {
    if (!session || session.surface !== 'local') {
      return;
    }

    localStorage.setItem(AUTOSAVE_KEY, serializeGame(session.state));
  }, [session]);

  useEffect(() => {
    if (!hydrating) {
      return;
    }

    let cancelled = false;

    const restoreFromPermalink = async () => {
      if (initialRoute.roomId) {
        try {
          const response = await fetch(`${setupConfig.roomUrl}/api/rooms/${initialRoute.roomId}`);
          const payload = (await response.json()) as { state: EngineState };
          if (cancelled) {
            return;
          }

          const nextConfig = createConfigFromState(payload.state, setupConfig, 'room');
          setSetupConfig(nextConfig);

          setSession({
            surface: 'room',
            roomId: initialRoute.roomId,
            roomUrl: setupConfig.roomUrl,
            content: localizeContent(compileContent(payload.state.scenarioId, nextConfig.expansionIds)),
            state: payload.state,
          });
          setError(null);
        } catch (roomError) {
          console.error(roomError);
          if (!cancelled) {
            setError('Room permalink could not be restored. Start `npm run dev:rooms` and try again.');
          }
        } finally {
          if (!cancelled) {
            setHydrating(false);
          }
        }
        return;
      }

      setHydrating(false);
    };

    void restoreFromPermalink();

    return () => {
      cancelled = true;
    };
  }, [hydrating, initialRoute.roomId, setupConfig]);

  useEffect(() => {
    if (!session || session.surface !== 'room' || !session.roomId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`${session.roomUrl}/api/rooms/${session.roomId}`);
        const payload = (await response.json()) as { state: EngineState };
        setSession((current) =>
          current && current.surface === 'room' ? { ...current, state: payload.state } : current,
        );
      } catch (roomError) {
        console.error(roomError);
      }
    }, 750);

    return () => window.clearInterval(interval);
  }, [session?.surface, session?.roomId, session?.roomUrl]);

  useEffect(() => {
    if (hydrating) {
      return;
    }

    const pathname = session
      ? session.surface === 'room' && session.roomId
        ? buildAppPath({ page: 'room', scenarioId: setupConfig.scenarioId, roomId: session.roomId })
        : buildAppPath({ page: 'offline', scenarioId: setupConfig.scenarioId, roomId: null })
      : buildAppPath({
          page: route.page,
          scenarioId: setupConfig.scenarioId,
          roomId: route.roomId,
        });
    window.history.replaceState(null, '', pathname);
  }, [hydrating, route.page, route.roomId, session, setupConfig.scenarioId]);

  const startSession = async (config: SetupConfig) => {
    setError(null);
    setNotice(null);
    const nextConfig = {
      ...config,
      seed: generateSessionSeed(),
    };
    setSetupConfig(nextConfig);
    setViewState(DEFAULT_GAME_VIEW_STATE);

    if (nextConfig.surface === 'local') {
      const content = localizeContent(compileContent(nextConfig.scenarioId, nextConfig.expansionIds));
      const state = initializeGame({
        type: 'StartGame',
        scenarioId: nextConfig.scenarioId,
        mode: nextConfig.mode,
        playerCount: nextConfig.playerCount,
        roleIds: nextConfig.roleIds,
        seed: nextConfig.seed,
        expansionIds: nextConfig.expansionIds,
      });
      setSession({
        surface: 'local',
        roomId: null,
        roomUrl: nextConfig.roomUrl,
        content,
        state,
      });
      setRoute((current) => ({ ...current, page: 'offline', roomId: null }));
      return;
    }

    try {
      const response = await fetch(`${nextConfig.roomUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: nextConfig.scenarioId,
          mode: nextConfig.mode,
          playerCount: nextConfig.playerCount,
          roleIds: nextConfig.roleIds,
          seed: nextConfig.seed,
          expansionIds: nextConfig.expansionIds,
        }),
      });

      const payload = (await response.json()) as { roomId: string; state: EngineState };
      const content = localizeContent(compileContent(nextConfig.scenarioId, nextConfig.expansionIds));
      setSession({
        surface: 'room',
        roomId: payload.roomId,
        roomUrl: nextConfig.roomUrl,
        content,
        state: payload.state,
      });
      setRoute({
        page: 'room',
        scenarioId: payload.state.scenarioId,
        roomId: payload.roomId,
      });
    } catch (roomError) {
      console.error(roomError);
      setError('Could not reach the room service. Start `npm run dev:rooms` and try again.');
    }
  };

  const sendCommand = async (command: EngineCommand) => {
    if (!session) {
      return;
    }

    if (session.surface === 'local') {
      setSession({
        ...session,
        state: dispatchCommand(session.state, command, session.content),
      });
      return;
    }

    if (!session.roomId) {
      return;
    }

    try {
      const response = await fetch(`${session.roomUrl}/api/rooms/${session.roomId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: [command] }),
      });
      const payload = (await response.json()) as { state: EngineState };
      setSession({ ...session, state: payload.state });
    } catch (roomError) {
      console.error(roomError);
      setError('Command dispatch failed.');
    }
  };

  const loadSerialized = (serialized: string) => {
    try {
      const payload = deserializeGame(serialized);
      const nextConfig = createConfigFromState(payload.snapshot, setupConfig, 'local');

      setSetupConfig(nextConfig);
      setViewState(DEFAULT_GAME_VIEW_STATE);
      setSession({
        surface: 'local',
        roomId: null,
        roomUrl: nextConfig.roomUrl,
        content: localizeContent(compileContent(payload.scenarioId, nextConfig.expansionIds)),
        state: payload.snapshot,
      });
      setRoute((current) => ({ ...current, page: 'offline', roomId: null }));
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setError('Save payload could not be parsed.');
    }
  };

  const loadAutosave = () => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) {
      setError('No autosave found.');
      return;
    }

    loadSerialized(raw);
  };

  const exportSave = async (serialized: string) => {
    try {
      await navigator.clipboard.writeText(serialized);
      setNotice('Serialized save copied to clipboard.');
    } catch (clipboardError) {
      console.error(clipboardError);
      setNotice('Clipboard unavailable. Copy the save from devtools state if needed.');
    }
  };

  return (
    <div className="app-root">
      {notice && <div className="banner notice">{notice}</div>}
      {error && <div className="banner error">{error}</div>}
      {hydrating ? (
        <div className="loading-shell">
          <div className="loading-card">
            <span className="eyebrow">{t('ui.app.restoringEyebrow', 'Restoring Session')}</span>
            <h1>{t('ui.app.restoringTitle', 'Rebuilding the table state')}</h1>
            <p>{t('ui.app.restoringBody', 'The permalink is being resolved into a live session.')}</p>
          </div>
        </div>
      ) : session ? (
        <GameScreen
          surface={session.surface}
          roomId={session.roomId}
          state={session.state}
          content={session.content}
          viewState={viewState}
          onViewStateChange={(patch) => setViewState((current) => ({ ...current, ...patch }))}
          onCommand={sendCommand}
          onBack={() => {
            setSession(null);
            setViewState(DEFAULT_GAME_VIEW_STATE);
            setRoute((current) => ({
              ...current,
              page: current.page === 'room' ? 'home' : current.page,
              roomId: null,
            }));
          }}
          onExportSave={exportSave}
        />
      ) : route.page === 'guidelines' ? (
        <GuidelinesScreen
          scenarioId={setupConfig.scenarioId}
          onSelectScenario={(scenarioId) => setSetupConfig((current) => ({ ...current, scenarioId }))}
          onBackHome={() => setRoute({ page: 'home', scenarioId: setupConfig.scenarioId, roomId: null })}
          onOpenOffline={() => setRoute({ page: 'offline', scenarioId: setupConfig.scenarioId, roomId: null })}
        />
      ) : (
        <HomeScreen
          config={setupConfig}
          hasAutosave={Boolean(localStorage.getItem(AUTOSAVE_KEY))}
          onConfigChange={(patch) => setSetupConfig((current) => ({ ...current, ...patch }))}
          onStart={startSession}
          onLoadSave={loadSerialized}
          onLoadAutosave={loadAutosave}
          onOpenGuidelines={(scenarioId) => {
            setSetupConfig((current) => ({ ...current, scenarioId }));
            setRoute({ page: 'guidelines', scenarioId, roomId: null });
          }}
          mode={route.page === 'offline' ? 'offline' : 'home'}
        />
      )}
    </div>
  );
}
