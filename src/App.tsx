import { useEffect, useEffectEvent, useState } from 'react';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  listRulesets,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type FactionId,
} from '../engine/index.ts';
import { getLocaleDirection, isLocale, setLocale, t, type Locale } from './i18n/index.ts';
import { GameScreen } from './mvp/GameScreen.tsx';
import { GuidelinesScreen } from './mvp/GuidelinesScreen.tsx';
import { HomeScreen } from './mvp/HomeScreen.tsx';
import { PlayerGuideScreen } from './mvp/PlayerGuideScreen.tsx';
import { ToastStack, type ToastMessage } from './mvp/ToastStack.tsx';
import { buildRuntimeLocation, getRuntimeOptions, parseRuntimeRoute } from './mvp/runtime.ts';
import { DEFAULT_GAME_VIEW_STATE, type AppRoute, type GameViewState, type SetupConfig } from './mvp/urlState.ts';

interface RoomCredential {
  seat: number;
  seatToken: string;
}

interface ActiveSession {
  surface: 'local' | 'room';
  roomId: string | null;
  roomUrl: string;
  seatToken: string | null;
  authorizedSeat: number | null;
  content: CompiledContent;
  state: EngineState;
}

const AUTOSAVE_KEY = 'stones-cutover-autosave';
const LOCALE_KEY = 'stones-cutover-locale';
const ROOM_KEY_PREFIX = 'stones-cutover-room:';
const DEFAULT_RULESET_ID = listRulesets()[0]?.id ?? 'base_design';
const ROOM_HEALTH_TIMEOUT_MS = 1_500;
const RUNTIME = getRuntimeOptions();

const DEFAULT_FACTIONS: FactionId[] = [
  'congo_basin_collective',
  'levant_sumud',
  'mekong_echo_network',
  'amazon_guardians',
];

const DEFAULT_CONFIG: SetupConfig = {
  surface: 'local',
  rulesetId: DEFAULT_RULESET_ID,
  mode: 'LIBERATION',
  playerCount: 2,
  factionIds: DEFAULT_FACTIONS,
  seed: Math.floor(Date.now() % 1_000_000),
  roomUrl: 'http://localhost:3010',
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

function getRoomCredential(roomId: string): RoomCredential | null {
  const raw = localStorage.getItem(`${ROOM_KEY_PREFIX}${roomId}`);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RoomCredential;
  } catch {
    return null;
  }
}

function setRoomCredential(roomId: string, credential: RoomCredential) {
  localStorage.setItem(`${ROOM_KEY_PREFIX}${roomId}`, JSON.stringify(credential));
}

function createConfigFromState(state: EngineState, previous: SetupConfig, surface: SetupConfig['surface']): SetupConfig {
  return {
    ...previous,
    surface,
    rulesetId: state.rulesetId,
    mode: state.mode,
    playerCount: clampPlayerCount(state.players.length),
    factionIds: state.players.map((player) => player.factionId),
    seed: state.seed,
  };
}

export default function App() {
  const [locale, setSelectedLocale] = useState<Locale>(() => {
    const stored = globalThis.localStorage?.getItem(LOCALE_KEY);
    return stored && isLocale(stored) ? stored : 'en';
  });

  // 🌐 Synchronize i18n module state with React state during render to ensure children get updated translations
  setLocale(locale);

  const [initialRoute] = useState(() =>
    parseRuntimeRoute(window.location.pathname, window.location.hash, DEFAULT_RULESET_ID, RUNTIME),
  );
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => ({
    ...DEFAULT_CONFIG,
    rulesetId: initialRoute.rulesetId,
    surface: RUNTIME.forceOfflineOnly ? 'local' : initialRoute.page === 'room' ? 'room' : DEFAULT_CONFIG.surface,
  }));
  const [viewState, setViewState] = useState<GameViewState>(DEFAULT_GAME_VIEW_STATE);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrating, setHydrating] = useState(initialRoute.page === 'room' && Boolean(initialRoute.roomId));
  const [roomServiceReachable, setRoomServiceReachable] = useState<boolean>(RUNTIME.forceOfflineOnly ? false : true);
  const [roomServiceChecking, setRoomServiceChecking] = useState(false);

  const pushToast = useEffectEvent((toast: Omit<ToastMessage, 'id'>) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }]);
  });

  const startLocalSession = useEffectEvent((config: SetupConfig, reason?: Omit<ToastMessage, 'id'>) => {
    const content = compileContent(config.rulesetId);
    const state = initializeGame({
      type: 'StartGame',
      rulesetId: config.rulesetId,
      mode: config.mode,
      playerCount: config.playerCount,
      factionIds: config.factionIds,
      seed: config.seed,
    });

    setSetupConfig((current) => ({ ...current, ...config, surface: 'local' }));
    setSession({
      surface: 'local',
      roomId: null,
      roomUrl: config.roomUrl,
      seatToken: null,
      authorizedSeat: null,
      content,
      state,
    });
    setRoute({ page: 'offline', rulesetId: config.rulesetId, roomId: null });

    if (reason) {
      pushToast(reason);
    }
  });

  useEffect(() => {
    console.log(`🌍 [App] Applying locale: ${locale}`);
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocaleDirection(locale);
  }, [locale]);

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

    const probe = async () => {
      try {
        const response = await fetch(`${setupConfig.roomUrl}/api/health`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Health probe failed with ${response.status}`);
        }
        if (!cancelled) {
          setRoomServiceReachable(true);
        }
      } catch {
        if (!cancelled) {
          setRoomServiceReachable(false);
        }
      } finally {
        if (!cancelled) {
          setRoomServiceChecking(false);
        }
      }
    };

    void probe();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [setupConfig.roomUrl]);

  useEffect(() => {
    if (!hydrating || !initialRoute.roomId) {
      setHydrating(false);
      return;
    }

    const credential = getRoomCredential(initialRoute.roomId);
    if (!credential) {
      pushToast({
        tone: 'warning',
        title: t('ui.app.roomCredentialMissing', 'Room credential missing'),
        message: t('ui.app.roomCredentialMissingBody', 'No seat credential was found for this room on this browser. Start from the home screen or recreate the room.'),
        dismissAfterMs: 5200,
      });
      setHydrating(false);
      setRoute({ page: 'home', rulesetId: DEFAULT_RULESET_ID, roomId: null });
      return;
    }

    let cancelled = false;

    const restoreRoom = async () => {
      try {
        const response = await fetch(`${setupConfig.roomUrl}/api/rooms/${initialRoute.roomId}?seatToken=${encodeURIComponent(credential.seatToken)}`);
        if (!response.ok) {
          throw new Error(`Room restore failed with ${response.status}`);
        }
        const payload = (await response.json()) as { state: EngineState; seat: number };
        if (cancelled) {
          return;
        }
        const nextConfig = createConfigFromState(payload.state, setupConfig, 'room');
        setSetupConfig(nextConfig);
        setSession({
          surface: 'room',
          roomId: initialRoute.roomId,
          roomUrl: setupConfig.roomUrl,
          seatToken: credential.seatToken,
          authorizedSeat: payload.seat,
          content: compileContent(payload.state.rulesetId),
          state: payload.state,
        });
      } catch {
        if (!cancelled) {
          pushToast({
            tone: 'error',
            title: t('ui.app.roomUnavailable', 'Room unavailable'),
            message: t('ui.app.roomRestoreFailed', 'The room could not be restored. The app returned to the home screen.'),
            dismissAfterMs: 5200,
          });
          setRoute({ page: 'home', rulesetId: DEFAULT_RULESET_ID, roomId: null });
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    };

    void restoreRoom();
    return () => {
      cancelled = true;
    };
  }, [hydrating, initialRoute.roomId, pushToast, setupConfig]);

  useEffect(() => {
    if (!session || session.surface !== 'room' || !session.roomId || !session.seatToken) {
      return;
    }

    const roomId = session.roomId;
    const roomUrl = session.roomUrl;
    const seatToken = session.seatToken;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`${roomUrl}/api/rooms/${roomId}?seatToken=${encodeURIComponent(seatToken)}`);
        if (!response.ok) {
          throw new Error(`Room poll failed with ${response.status}`);
        }
        const payload = (await response.json()) as { state: EngineState; seat: number };
        setSession((current) =>
          current && current.surface === 'room'
            ? {
              ...current,
              authorizedSeat: payload.seat,
              state: payload.state,
            }
            : current,
        );
      } catch {
        startLocalSession(createConfigFromState(session.state, setupConfig, 'local'), {
          tone: 'warning',
          title: t('ui.app.roomSyncLost', 'Room sync lost'),
          message: t('ui.app.roomSyncLostBody', 'The room service stopped responding. The table was kept alive offline.'),
          dismissAfterMs: 5200,
        });
      }
    }, 900);

    return () => window.clearInterval(interval);
  }, [session, setupConfig, startLocalSession]);

  useEffect(() => {
    if (hydrating) {
      return;
    }
    const pathname = session
      ? session.surface === 'room' && session.roomId
        ? buildRuntimeLocation({ page: 'room', rulesetId: setupConfig.rulesetId, roomId: session.roomId }, RUNTIME)
        : buildRuntimeLocation({ page: 'offline', rulesetId: setupConfig.rulesetId, roomId: null }, RUNTIME)
      : buildRuntimeLocation(route, RUNTIME);
    window.history.replaceState(null, '', pathname);
  }, [hydrating, route, session, setupConfig.rulesetId]);

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
          rulesetId: nextConfig.rulesetId,
          mode: nextConfig.mode,
          playerCount: nextConfig.playerCount,
          factionIds: nextConfig.factionIds,
          seed: nextConfig.seed,
        }),
      });
      if (!response.ok) {
        throw new Error(`Room create failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        roomId: string;
        state: EngineState;
        seatTokens: Array<{ seat: number; seatToken: string }>;
      };

      const creatorCredential = payload.seatTokens[0];
      setRoomCredential(payload.roomId, creatorCredential);

      setSession({
        surface: 'room',
        roomId: payload.roomId,
        roomUrl: nextConfig.roomUrl,
        seatToken: creatorCredential.seatToken,
        authorizedSeat: creatorCredential.seat,
        content: compileContent(payload.state.rulesetId),
        state: payload.state,
      });
      setRoute({ page: 'room', rulesetId: payload.state.rulesetId, roomId: payload.roomId });
    } catch {
      setRoomServiceReachable(false);
      startLocalSession(nextConfig, {
        tone: 'warning',
        title: t('ui.app.roomUnavailable', 'Room unavailable'),
        message: t('ui.app.roomFallbackLocal', 'Could not reach the room service. The game started offline instead.'),
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
          ? { ...current, state: dispatchCommand(current.state, command, current.content) }
          : current,
      );
      return;
    }

    if (!session.roomId || !session.seatToken) {
      return;
    }

    const response = await fetch(`${session.roomUrl}/api/rooms/${session.roomId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatToken: session.seatToken, commands: [command] }),
    });
    if (!response.ok) {
      pushToast({
        tone: 'error',
        title: t('ui.app.commandFailed', 'Command failed'),
        message: t('ui.app.commandFailedBody', 'The room rejected the command. The table stayed unchanged.'),
        dismissAfterMs: 4200,
      });
      return;
    }
    const payload = (await response.json()) as { state: EngineState; seat: number };
    setSession((current) =>
      current && current.surface === 'room'
        ? { ...current, state: payload.state, authorizedSeat: payload.seat }
        : current,
    );
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
        seatToken: null,
        authorizedSeat: null,
        content: compileContent(payload.rulesetId),
        state: payload.snapshot,
      });
      setRoute({ page: 'offline', rulesetId: nextConfig.rulesetId, roomId: null });
      pushToast({
        tone: 'success',
        title: t('ui.app.saveRestored', 'Save restored'),
        message: t('ui.app.saveRestoredBody', 'Serialized state loaded into a local table.'),
        dismissAfterMs: 2600,
      });
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('ui.app.saveInvalid', 'Save invalid'),
        message: error instanceof Error ? error.message : 'Save payload could not be parsed.',
        dismissAfterMs: 4200,
      });
    }
  };

  const loadAutosave = () => {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) {
      pushToast({
        tone: 'warning',
        title: t('ui.app.autosaveMissing', 'Autosave missing'),
        message: t('ui.app.autosaveMissingBody', 'No autosave was found for this browser.'),
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
        title: t('ui.app.saveCopied', 'Save copied'),
        message: t('ui.app.saveCopiedBody', 'Serialized save copied to the clipboard.'),
        dismissAfterMs: 2600,
      });
    } catch {
      pushToast({
        tone: 'warning',
        title: t('ui.app.clipboardUnavailable', 'Clipboard unavailable'),
        message: t('ui.app.clipboardUnavailableBody', 'Copy the serialized save from the app state if needed.'),
        dismissAfterMs: 4200,
      });
    }
  };

  return (
    <div className="app-root" dir={getLocaleDirection(locale)} lang={locale}>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      {hydrating ? (
        <div className="loading-shell">
          <div className="loading-card">
            <span className="eyebrow">{t('ui.app.restoringSession', 'Restoring Session')}</span>
            <h1>{t('ui.app.rebuildingState', 'Rebuilding the table state')}</h1>
            <p>{t('ui.app.rebuildingStateBody', 'The app is resolving the room permalink and seat credential.')}</p>
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
            setRoute({ page: 'home', rulesetId: setupConfig.rulesetId, roomId: null });
          }}
          onExportSave={exportSave}
          authorizedSeat={session.authorizedSeat}
        />
      ) : route.page === 'guidelines' ? (
        <GuidelinesScreen
          locale={locale}
          onLocaleChange={setSelectedLocale}
          onBackHome={() => setRoute({ page: 'home', rulesetId: setupConfig.rulesetId, roomId: null })}
          onOpenOffline={() => setRoute({ page: 'offline', rulesetId: setupConfig.rulesetId, roomId: null })}
        />
      ) : route.page === 'player-guide' ? (
        <PlayerGuideScreen
          locale={locale}
          onLocaleChange={setSelectedLocale}
          onBackHome={() => setRoute({ page: 'home', rulesetId: setupConfig.rulesetId, roomId: null })}
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
          onOpenGuidelines={() => setRoute({ page: 'guidelines', rulesetId: setupConfig.rulesetId, roomId: null })}
          onOpenPlayerGuide={() => setRoute({ page: 'player-guide', rulesetId: setupConfig.rulesetId, roomId: null })}
          mode={route.page === 'offline' ? 'offline' : 'home'}
        />
      )}
    </div>
  );
}
