import { useEffect, useEffectEvent, useState } from 'react';
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
import { PlayerGuideScreen } from './mvp/PlayerGuideScreen.tsx';
import { ToastStack, type ToastMessage } from './mvp/ToastStack.tsx';
import { buildRuntimeLocation, getRuntimeOptions, parseRuntimeRoute } from './mvp/runtime.ts';
import { getLocaleDirection, isLocale, localizeContent, setLocale, t, type Locale } from './i18n/index.ts';
import {
  DEFAULT_GAME_VIEW_STATE,
  type AppRoute,
  type GameViewState,
  type SetupConfig,
} from './mvp/urlState.ts';

interface ActiveSession {
  surface: 'local' | 'room';
  roomId: string | null;
  roomUrl: string;
  content: CompiledContent;
  state: EngineState;
}

const AUTOSAVE_KEY = 'dignity-rising-autosave';
const LOCALE_KEY = 'dignity-rising-locale';
const DEFAULT_SCENARIO_ID = listScenarios()[0]?.id ?? 'witness_dignity';
const ROOM_HEALTH_TIMEOUT_MS = 1_500;
const RUNTIME = getRuntimeOptions();

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
  const [locale, setSelectedLocale] = useState<Locale>(() => {
    const stored = globalThis.localStorage?.getItem(LOCALE_KEY);
    return stored && isLocale(stored) ? stored : 'en';
  });
  const [initialRoute] = useState(() =>
    parseRuntimeRoute(window.location.pathname, window.location.hash, DEFAULT_SCENARIO_ID, RUNTIME),
  );
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => ({
    ...DEFAULT_CONFIG,
    scenarioId: initialRoute.scenarioId,
    surface: RUNTIME.forceOfflineOnly ? 'local' : initialRoute.page === 'room' ? 'room' : DEFAULT_CONFIG.surface,
  }));
  const [viewState, setViewState] = useState<GameViewState>(DEFAULT_GAME_VIEW_STATE);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrating, setHydrating] = useState(initialRoute.page === 'room' && Boolean(initialRoute.roomId));
  const [roomServiceReachable, setRoomServiceReachable] = useState<boolean>(RUNTIME.forceOfflineOnly ? false : true);
  const [roomServiceChecking, setRoomServiceChecking] = useState(false);

  const startLocalSession = useEffectEvent((config: SetupConfig, reason?: Omit<ToastMessage, 'id'>) => {
    const content = localizeContent(compileContent(config.scenarioId, config.expansionIds));
    const state = initializeGame({
      type: 'StartGame',
      scenarioId: config.scenarioId,
      mode: config.mode,
      playerCount: config.playerCount,
      roleIds: config.roleIds,
      seed: config.seed,
      expansionIds: config.expansionIds,
    });

    setSetupConfig((current) => ({ ...current, ...config, surface: 'local' }));
    setSession({
      surface: 'local',
      roomId: null,
      roomUrl: config.roomUrl,
      content,
      state,
    });
    setRoute({ page: 'offline', scenarioId: config.scenarioId, roomId: null });

    if (reason) {
      pushToast(reason);
    }
  });

  const pushToast = useEffectEvent((toast: Omit<ToastMessage, 'id'>) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }]);
  });

  const switchRoomSessionToLocal = useEffectEvent((toast: Omit<ToastMessage, 'id'>) => {
    setSetupConfig((current) => ({ ...current, surface: 'local' }));
    setSession((current) =>
      current && current.surface === 'room'
        ? {
          ...current,
          surface: 'local',
          roomId: null,
        }
        : current,
    );
    setRoute((current) => ({ ...current, page: 'offline', roomId: null }));
    pushToast(toast);
  });

  useEffect(() => {
    setLocale(locale);
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocaleDirection(locale);
  }, [locale]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setSession((current) =>
      current
        ? {
          ...current,
          content: localizeContent(compileContent(current.state.scenarioId, setupConfig.expansionIds)),
        }
        : current,
    );
  }, [locale, session?.state.scenarioId, setupConfig.expansionIds]);

  useEffect(() => {
    if (!session || session.surface !== 'local') {
      return;
    }

    localStorage.setItem(AUTOSAVE_KEY, serializeGame(session.state));
  }, [session]);

  useEffect(() => {
    if (RUNTIME.forceOfflineOnly) {
      setRoomServiceReachable(false);
      setRoomServiceChecking(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ROOM_HEALTH_TIMEOUT_MS);

    setRoomServiceChecking(true);

    const probeRoomService = async () => {
      try {
        const response = await fetch(`${setupConfig.roomUrl}/api/health`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Room health probe failed with status ${response.status}`);
        }

        if (!cancelled) {
          setRoomServiceReachable(true);
        }
      } catch (roomError) {
        if ((roomError as Error).name !== 'AbortError') {
          console.error(roomError);
        }
        if (!cancelled) {
          setRoomServiceReachable(false);
        }
      } finally {
        if (!cancelled) {
          setRoomServiceChecking(false);
        }
      }
    };

    void probeRoomService();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [setupConfig.roomUrl]);

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
          pushToast({
            tone: 'success',
            title: t('ui.toast.roomRestoredTitle', 'Room restored'),
            message: t('ui.toast.roomRestoredMessage', 'The permalink resolved into a live room session.'),
            dismissAfterMs: 2400,
          });
        } catch (roomError) {
          console.error(roomError);
          if (!cancelled) {
            setSetupConfig((current) => ({ ...current, surface: 'local' }));
            setRoute((current) => ({ ...current, page: 'offline', roomId: null }));
            pushToast({
              tone: 'error',
              title: t('ui.toast.roomUnavailableTitle', 'Room unavailable'),
              message: t(
                'ui.toast.roomPermalinkFailedMessage',
                'Room permalink could not be restored. Start `npm run dev:rooms` and try again.',
              ),
              dismissAfterMs: 4800,
            });
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
        if (!response.ok) {
          throw new Error(`Room poll failed with status ${response.status}`);
        }
        const payload = (await response.json()) as { state: EngineState };
        setSession((current) =>
          current && current.surface === 'room' ? { ...current, state: payload.state } : current,
        );
      } catch (roomError) {
        console.error(roomError);
        switchRoomSessionToLocal({
          tone: 'warning',
          title: t('ui.toast.roomSyncLostTitle', 'Room sync lost'),
          message: t(
            'ui.toast.roomSyncLostMessage',
            'The room service stopped responding. The current table has been kept alive in offline mode.',
          ),
          dismissAfterMs: 5200,
        });
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
        ? buildRuntimeLocation({ page: 'room', scenarioId: setupConfig.scenarioId, roomId: session.roomId }, RUNTIME)
        : buildRuntimeLocation({ page: 'offline', scenarioId: setupConfig.scenarioId, roomId: null }, RUNTIME)
      : buildRuntimeLocation({
        page: route.page,
        scenarioId: setupConfig.scenarioId,
        roomId: route.roomId,
      }, RUNTIME);
    window.history.replaceState(null, '', pathname);
  }, [hydrating, route.page, route.roomId, session, setupConfig.scenarioId]);

  const startSession = async (config: SetupConfig) => {
    const nextConfig = {
      ...config,
      surface: RUNTIME.forceOfflineOnly ? 'local' : config.surface,
      seed: generateSessionSeed(),
    };
    setSetupConfig(nextConfig);
    setViewState(DEFAULT_GAME_VIEW_STATE);

    if (nextConfig.surface === 'local') {
      startLocalSession(nextConfig);
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
      if (!response.ok) {
        throw new Error(`Room create failed with status ${response.status}`);
      }

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
      setRoomServiceReachable(false);
      startLocalSession(nextConfig, {
        tone: 'warning',
        title: t('ui.toast.roomUnavailableTitle', 'Room unavailable'),
        message: t(
          'ui.toast.roomServiceFallbackMessage',
          'Could not reach the room service. Online mode was disabled and the game started offline instead.',
        ),
        dismissAfterMs: 5200,
      });
    }
  };

  const sendCommand = async (command: EngineCommand) => {
    if (!session) {
      return;
    }

    if (session.surface === 'local') {
      setSession((current) =>
        current && current.surface === 'local'
          ? {
            ...current,
            state: dispatchCommand(current.state, command, current.content),
          }
          : current,
      );
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
      if (!response.ok) {
        throw new Error(`Room command failed with status ${response.status}`);
      }
      const payload = (await response.json()) as { state: EngineState };
      setSession({ ...session, state: payload.state });
    } catch (roomError) {
      console.error(roomError);
      setRoomServiceReachable(false);
      switchRoomSessionToLocal({
        tone: 'warning',
        title: t('ui.toast.commandFailedTitle', 'Command failed'),
        message: t(
          'ui.toast.commandFailedFallbackMessage',
          'The room service rejected the command dispatch. The table has been switched to offline mode.',
        ),
        dismissAfterMs: 5200,
      });
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
      pushToast({
        tone: 'success',
        title: t('ui.toast.saveRestoredTitle', 'Save restored'),
        message: t('ui.toast.saveRestoredMessage', 'Serialized state loaded into a local table.'),
        dismissAfterMs: 2600,
      });
    } catch (loadError) {
      console.error(loadError);
      pushToast({
        tone: 'error',
        title: t('ui.toast.saveInvalidTitle', 'Save invalid'),
        message: t('ui.toast.saveInvalidMessage', 'Save payload could not be parsed.'),
        dismissAfterMs: 4200,
      });
    }
  };

  const loadAutosave = () => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) {
      pushToast({
        tone: 'warning',
        title: t('ui.toast.autosaveMissingTitle', 'Autosave missing'),
        message: t('ui.toast.autosaveMissingMessage', 'No autosave was found for this browser.'),
        dismissAfterMs: 3200,
      });
      return;
    }

    loadSerialized(raw);
  };

  const exportSave = async (serialized: string) => {
    try {
      await navigator.clipboard.writeText(serialized);
      pushToast({
        tone: 'success',
        title: t('ui.toast.saveCopiedTitle', 'Save copied'),
        message: t('ui.toast.saveCopiedMessage', 'Serialized save copied to the clipboard.'),
        dismissAfterMs: 2600,
      });
    } catch (clipboardError) {
      console.error(clipboardError);
      pushToast({
        tone: 'warning',
        title: t('ui.toast.clipboardUnavailableTitle', 'Clipboard unavailable'),
        message: t(
          'ui.toast.clipboardUnavailableMessage',
          'Copy the serialized save from devtools state if needed.',
        ),
        dismissAfterMs: 4200,
      });
    }
  };

  const scenarioTone = (session?.state.scenarioId ?? setupConfig.scenarioId) === 'green_resistance'
    ? 'verdant'
    : 'witness';
  const localeDirection = getLocaleDirection(locale);

  setLocale(locale);

  return (
    <div className="app-root" data-scenario-tone={scenarioTone} dir={localeDirection} lang={locale}>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
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
          locale={locale}
          onLocaleChange={setSelectedLocale}
          devMode={RUNTIME.devMode}
          surface={session.surface}
          roomId={session.roomId}
          state={session.state}
          content={session.content}
          viewState={viewState}
          onViewStateChange={(patch) => setViewState((current) => ({ ...current, ...patch }))}
          onCommand={sendCommand}
          onToast={pushToast}
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
          locale={locale}
          onLocaleChange={setSelectedLocale}
          scenarioId={setupConfig.scenarioId}
          onSelectScenario={(scenarioId) => setSetupConfig((current) => ({ ...current, scenarioId }))}
          onBackHome={() => setRoute({ page: 'home', scenarioId: setupConfig.scenarioId, roomId: null })}
          onOpenOffline={() => setRoute({ page: 'offline', scenarioId: setupConfig.scenarioId, roomId: null })}
        />
      ) : route.page === 'player-guide' ? (
        <PlayerGuideScreen
          locale={locale}
          onLocaleChange={setSelectedLocale}
          onBackHome={() => setRoute({ page: 'home', scenarioId: setupConfig.scenarioId, roomId: null })}
        />
      ) : (
        <HomeScreen
          locale={locale}
          onLocaleChange={setSelectedLocale}
          config={setupConfig}
          hasAutosave={Boolean(localStorage.getItem(AUTOSAVE_KEY))}
          roomPlayAvailable={roomServiceReachable}
          roomPlayChecking={roomServiceChecking}
          roomPlayDisabledByBuild={RUNTIME.forceOfflineOnly}
          onConfigChange={(patch) => setSetupConfig((current) => ({ ...current, ...patch }))}
          onStart={startSession}
          onLoadSave={loadSerialized}
          onLoadAutosave={loadAutosave}
          onOpenGuidelines={(scenarioId) => {
            setSetupConfig((current) => ({ ...current, scenarioId }));
            setRoute({ page: 'guidelines', scenarioId, roomId: null });
          }}
          onOpenPlayerGuide={() => setRoute({ page: 'player-guide', scenarioId: setupConfig.scenarioId, roomId: null })}
          mode={route.page === 'offline' ? 'offline' : 'home'}
        />
      )}
    </div>
  );
}
