import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildBalancedSeatOwners,
  compileContent,
  dispatchCommand,
  initializeGame,
  listRulesets,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
  type StartGameCommand,
} from '../engine/index.ts';
import { LOCALE_STORAGE_KEY, t, useAppLocale } from '../i18n/index.ts';
import { LoadingScreen } from './shell/LoadingScreen.tsx';
import { AppLayout } from './shell/AppLayout.tsx';
import { ToastStack, type ToastMessage } from '../ui/feedback/ToastStack.tsx';
import { GameSessionScreen } from '../game/screens/GameSessionScreen.tsx';
import { GuidelinesScreen } from '../features/rules-brief/ui/RulesBriefScreen.tsx';
import { SessionSetupScreen } from '../features/session-setup/ui/SessionSetupScreen.tsx';
import { PlayerGuideScreen } from '../features/player-guide/ui/PlayerGuideScreen.tsx';
import { RoomLobbyScreen } from '../features/room-session/ui/RoomLobbyScreen.tsx';
import { buildAppPath, type AppRoute } from './router/pathState.ts';
import { parseRuntimeRoute, type AppRuntimeOptions } from './router/runtime.ts';
import {
  parseCreateRoomResponse,
  parseJoinRoomResponse,
  parseRoomSnapshot,
  type RoomActiveSnapshot,
  type RoomLobbySnapshot,
} from '../features/room-session/api/schemas.ts';
import { readRoomCredential, writeRoomCredential } from '../features/room-session/storage/browserRoomCredentials.ts';
import {
  DEFAULT_SESSION_VIEWPORT,
  type SessionSetupDraft,
  type SessionViewport,
} from '../features/session-setup/model/sessionTypes.ts';

const DevGameSessionShell = lazy(() => import('../devtools/DevGameSessionShell.tsx'));

const ROOM_SERVICE_BASE = '';

interface LocalSessionHandle {
  surface: 'local';
  roomPhase: 'ACTIVE';
  roomId: null;
  ownerToken: null;
  authorizedOwnerId: null;
  content: CompiledContent;
  state: EngineState;
}

interface RoomLobbySessionHandle {
  surface: 'room';
  roomPhase: 'LOBBY';
  roomId: string;
  ownerToken: string | null;
  lobby: RoomLobbySnapshot;
}

interface RoomActiveSessionHandle {
  surface: 'room';
  roomPhase: 'ACTIVE';
  roomId: string;
  ownerToken: string;
  authorizedOwnerId: number;
  content: CompiledContent;
  state: EngineState;
}

type SessionHandle = LocalSessionHandle | RoomLobbySessionHandle | RoomActiveSessionHandle;

const AUTOSAVE_KEY = 'stones-cutover-autosave';
const DEFAULT_RULESET_ID = listRulesets()[0]?.id ?? 'base_design';
const ROOM_HEALTH_TIMEOUT_MS = 1_500;

const DEFAULT_SETUP_DRAFT: SessionSetupDraft = {
  surface: 'local',
  rulesetId: DEFAULT_RULESET_ID,
  mode: 'LIBERATION',
  humanPlayerCount: 4,
  factionIds: [],
  seatOwnerIds: [],
  seed: Math.floor(Date.now() % 1_000_000),
};

function generateSessionSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] >>> 0;
}

function clampHumanPlayerCount(humanPlayerCount: number, factionCount: number): 2 | 3 | 4 {
  const clamped = Math.max(2, Math.min(4, Math.min(humanPlayerCount, factionCount)));
  if (clamped === 3 || clamped === 4) {
    return clamped;
  }
  return 2;
}

function deriveScenarioSeats(rulesetId: string) {
  const ruleset = listRulesets().find((entry) => entry.id === rulesetId) ?? listRulesets()[0];
  const factionIds = ruleset.factions.map((faction) => faction.id);
  const humanPlayerCount = clampHumanPlayerCount(factionIds.length, factionIds.length);
  return {
    ruleset,
    factionIds,
    humanPlayerCount,
    seatOwnerIds: buildBalancedSeatOwners(humanPlayerCount, factionIds),
  };
}

function applyScenarioDefaults(config: SessionSetupDraft): SessionSetupDraft {
  const { ruleset, factionIds } = deriveScenarioSeats(config.rulesetId);
  const humanPlayerCount = clampHumanPlayerCount(config.humanPlayerCount, factionIds.length);
  const currentSeatOwnerIds = config.seatOwnerIds ?? [];
  const hasValidSeatOwners = currentSeatOwnerIds.length === factionIds.length
    && currentSeatOwnerIds.every((ownerId) => ownerId >= 0 && ownerId < humanPlayerCount)
    && Array.from({ length: humanPlayerCount }, (_, ownerId) => ownerId).every((ownerId) => currentSeatOwnerIds.includes(ownerId));

  return {
    ...config,
    rulesetId: ruleset.id,
    factionIds,
    humanPlayerCount,
    seatOwnerIds: hasValidSeatOwners ? currentSeatOwnerIds : buildBalancedSeatOwners(humanPlayerCount, factionIds),
  };
}

function createDraftFromState(
  state: EngineState,
  previous: SessionSetupDraft,
  surface: SessionSetupDraft['surface'],
): SessionSetupDraft {
  const factionIds = state.players.map((player) => player.factionId);
  const ownerIds = Array.from(new Set(state.players.map((player) => player.ownerId)));

  return applyScenarioDefaults({
    ...previous,
    surface,
    rulesetId: state.rulesetId,
    mode: state.mode,
    humanPlayerCount: clampHumanPlayerCount(ownerIds.length, factionIds.length),
    factionIds,
    seatOwnerIds: state.players.map((player) => player.ownerId),
    seed: state.seed,
  });
}

function createDraftFromRoomConfig(
  config: StartGameCommand,
  previous: SessionSetupDraft,
  surface: SessionSetupDraft['surface'],
): SessionSetupDraft {
  return applyScenarioDefaults({
    ...previous,
    surface,
    rulesetId: config.rulesetId,
    mode: config.mode,
    humanPlayerCount: config.humanPlayerCount ?? config.playerCount ?? previous.humanPlayerCount,
    factionIds: [...(config.seatFactionIds ?? config.factionIds ?? previous.factionIds)],
    seatOwnerIds: [...(config.seatOwnerIds ?? previous.seatOwnerIds)],
    seed: config.seed,
  });
}

function buildApiUrl(path: string) {
  return `${ROOM_SERVICE_BASE}${path}`;
}

function buildActiveRoomSession(snapshot: RoomActiveSnapshot, ownerToken: string): RoomActiveSessionHandle {
  return {
    surface: 'room',
    roomPhase: 'ACTIVE',
    roomId: snapshot.roomId,
    ownerToken,
    authorizedOwnerId: snapshot.ownerId,
    content: compileContent(snapshot.state.rulesetId),
    state: snapshot.state,
  };
}

export default function AppRoot({ runtime }: { runtime: AppRuntimeOptions }) {
  const { locale, dir } = useAppLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(
    () => parseRuntimeRoute(location.pathname, location.hash, DEFAULT_RULESET_ID, runtime),
    [location.hash, location.pathname, runtime],
  );

  const [setupDraft, setSetupDraft] = useState<SessionSetupDraft>(() => {
    const { ruleset, factionIds, humanPlayerCount, seatOwnerIds } = deriveScenarioSeats(DEFAULT_RULESET_ID);
    return applyScenarioDefaults({
      ...DEFAULT_SETUP_DRAFT,
      rulesetId: ruleset.id,
      factionIds,
      humanPlayerCount,
      seatOwnerIds,
      surface: route.page === 'room' && !runtime.forceOfflineOnly ? 'room' : 'local',
    });
  });
  const [viewport, setViewport] = useState<SessionViewport>(DEFAULT_SESSION_VIEWPORT);
  const [session, setSession] = useState<SessionHandle | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrating, setHydrating] = useState(route.page === 'room' && Boolean(route.roomId));
  const [roomServiceReachable, setRoomServiceReachable] = useState<boolean>(runtime.forceOfflineOnly ? false : true);
  const [roomServiceChecking, setRoomServiceChecking] = useState(false);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  const replaceRoute = useCallback((nextRoute: AppRoute) => {
    const nextPath = buildAppPath(nextRoute);
    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  const goToPage = useCallback((page: AppRoute['page'], roomId: string | null = null) => {
    replaceRoute({ page, roomId, rulesetId: route.rulesetId });
  }, [replaceRoute, route.rulesetId]);

  const startLocalSession = useCallback((draft: SessionSetupDraft, reason?: Omit<ToastMessage, 'id'>) => {
    const nextDraft = applyScenarioDefaults(draft);
    const content = compileContent(nextDraft.rulesetId);
    const state = initializeGame({
      type: 'StartGame',
      rulesetId: nextDraft.rulesetId,
      mode: nextDraft.mode,
      secretMandates: 'disabled',
      humanPlayerCount: nextDraft.humanPlayerCount,
      seatFactionIds: nextDraft.factionIds,
      seatOwnerIds: nextDraft.seatOwnerIds,
      seed: nextDraft.seed,
    });

    setSetupDraft((current) => applyScenarioDefaults({ ...current, ...nextDraft, surface: 'local' }));
    setSession({
      surface: 'local',
      roomPhase: 'ACTIVE',
      roomId: null,
      ownerToken: null,
      authorizedOwnerId: null,
      content,
      state,
    });
    goToPage('offline');

    if (reason) {
      pushToast(reason);
    }
  }, [goToPage, pushToast]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [dir, locale]);

  useEffect(() => {
    if (!session || session.surface !== 'local') {
      return;
    }

    localStorage.setItem(AUTOSAVE_KEY, serializeGame(session.state));
  }, [session]);

  useEffect(() => {
    if (runtime.forceOfflineOnly && route.page === 'room') {
      goToPage('offline');
    }
  }, [goToPage, route.page, runtime.forceOfflineOnly]);

  useEffect(() => {
    if (runtime.forceOfflineOnly) {
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
        const response = await fetch(buildApiUrl('/api/health'), { signal: controller.signal });
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
  }, [runtime.forceOfflineOnly]);

  useEffect(() => {
    if (!session && route.page === 'room' && route.roomId) {
      setHydrating(true);
    }
  }, [route.page, route.roomId, session]);

  useEffect(() => {
    if (!hydrating || !route.roomId) {
      setHydrating(false);
      return;
    }

    const credential = readRoomCredential(route.roomId);
    let cancelled = false;

    const restoreRoom = async () => {
      try {
        const query = credential ? `?ownerToken=${encodeURIComponent(credential.ownerToken)}` : '';
        const response = await fetch(buildApiUrl(`/api/rooms/${route.roomId}${query}`));
        if (response.status === 401) {
          pushToast({
            tone: 'warning',
            title: t('ui.app.roomCredentialMissing', 'Room credential missing'),
            message: t('ui.app.roomCredentialMissingBody', 'No seat credential was found for this room on this browser. Start from the home screen or recreate the room.'),
            dismissAfterMs: 5200,
          });
          goToPage(runtime.defaultPage);
          return;
        }
        if (!response.ok) {
          throw new Error(`Room restore failed with ${response.status}`);
        }

        const payload = parseRoomSnapshot(await response.json());
        if (cancelled) {
          return;
        }

        if (payload.phase === 'LOBBY') {
          const nextDraft = createDraftFromRoomConfig(payload.config, setupDraft, 'room');
          setSetupDraft(nextDraft);
          setSession({
            surface: 'room',
            roomPhase: 'LOBBY',
            roomId: route.roomId ?? payload.roomId,
            ownerToken: credential?.ownerToken ?? null,
            lobby: payload,
          });
          return;
        }

        if (!credential) {
          pushToast({
            tone: 'warning',
            title: t('ui.app.roomCredentialMissing', 'Room credential missing'),
            message: t('ui.app.roomCredentialMissingBody', 'No seat credential was found for this room on this browser. Start from the home screen or recreate the room.'),
            dismissAfterMs: 5200,
          });
          goToPage(runtime.defaultPage);
          return;
        }

        const nextDraft = createDraftFromState(payload.state, setupDraft, 'room');
        setSetupDraft(nextDraft);
        setSession(buildActiveRoomSession(payload, credential.ownerToken));
      } catch {
        if (!cancelled) {
          pushToast({
            tone: 'error',
            title: t('ui.app.roomUnavailable', 'Room unavailable'),
            message: t('ui.app.roomRestoreFailed', 'The room could not be restored. The app returned to the home screen.'),
            dismissAfterMs: 5200,
          });
          goToPage(runtime.defaultPage);
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
  }, [goToPage, hydrating, pushToast, route.roomId, runtime.defaultPage, setupDraft]);

  useEffect(() => {
    if (!session || session.surface !== 'room') {
      return;
    }

    if (session.roomPhase === 'LOBBY') {
      const interval = window.setInterval(async () => {
        try {
          const query = session.ownerToken ? `?ownerToken=${encodeURIComponent(session.ownerToken)}` : '';
          const response = await fetch(buildApiUrl(`/api/rooms/${session.roomId}${query}`));
          if (response.status === 401) {
            pushToast({
              tone: 'warning',
              title: t('ui.app.roomCredentialMissing', 'Room credential missing'),
              message: t('ui.app.roomCredentialMissingBody', 'No seat credential was found for this room on this browser. Start from the home screen or recreate the room.'),
              dismissAfterMs: 5200,
            });
            setSession(null);
            goToPage(runtime.defaultPage);
            return;
          }
          if (!response.ok) {
            throw new Error(`Room lobby poll failed with ${response.status}`);
          }

          const payload = parseRoomSnapshot(await response.json());
          if (payload.phase === 'LOBBY') {
            setSession((current) =>
              current && current.surface === 'room' && current.roomPhase === 'LOBBY'
                ? {
                    ...current,
                    lobby: payload,
                  }
                : current,
            );
            return;
          }

          if (!session.ownerToken) {
            pushToast({
              tone: 'warning',
              title: t('ui.app.roomCredentialMissing', 'Room credential missing'),
              message: t('ui.app.roomCredentialMissingBody', 'No seat credential was found for this room on this browser. Start from the home screen or recreate the room.'),
              dismissAfterMs: 5200,
            });
            setSession(null);
            goToPage(runtime.defaultPage);
            return;
          }

          setSetupDraft((current) => createDraftFromState(payload.state, current, 'room'));
          setSession(buildActiveRoomSession(payload, session.ownerToken));
        } catch {
          pushToast({
            tone: 'warning',
            title: t('ui.app.roomUnavailable', 'Room unavailable'),
            message: t('ui.app.roomRestoreFailed', 'The room could not be restored. The app returned to the home screen.'),
            dismissAfterMs: 5200,
          });
          setSession(null);
          goToPage(runtime.defaultPage);
        }
      }, 900);

      return () => window.clearInterval(interval);
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/rooms/${session.roomId}?ownerToken=${encodeURIComponent(session.ownerToken)}`));
        if (!response.ok) {
          throw new Error(`Room poll failed with ${response.status}`);
        }
        const payload = parseRoomSnapshot(await response.json());
        if (payload.phase !== 'ACTIVE') {
          throw new Error('Room returned lobby snapshot while active session expected.');
        }
        setSession((current) =>
          current && current.surface === 'room' && current.roomPhase === 'ACTIVE'
            ? {
                ...current,
                authorizedOwnerId: payload.ownerId,
                state: payload.state,
              }
            : current,
        );
      } catch {
        startLocalSession(createDraftFromState(session.state, setupDraft, 'local'), {
          tone: 'warning',
          title: t('ui.app.roomSyncLost', 'Room sync lost'),
          message: t('ui.app.roomSyncLostBody', 'The room service stopped responding. The table was kept alive offline.'),
          dismissAfterMs: 5200,
        });
      }
    }, 900);

    return () => window.clearInterval(interval);
  }, [goToPage, pushToast, runtime.defaultPage, session, setupDraft, startLocalSession]);

  const startSession = async (draft: SessionSetupDraft) => {
    const nextDraft = applyScenarioDefaults({
      ...draft,
      surface: runtime.forceOfflineOnly ? 'local' : draft.surface,
      seed: generateSessionSeed(),
    });

    setSetupDraft(nextDraft);
    setViewport(DEFAULT_SESSION_VIEWPORT);

    if (nextDraft.surface === 'local') {
      startLocalSession(nextDraft);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rulesetId: nextDraft.rulesetId,
          mode: nextDraft.mode,
          humanPlayerCount: nextDraft.humanPlayerCount,
          seatFactionIds: nextDraft.factionIds,
          seatOwnerIds: nextDraft.seatOwnerIds,
          seed: nextDraft.seed,
        }),
      });
      if (!response.ok) {
        throw new Error(`Room create failed with ${response.status}`);
      }

      const payload = parseCreateRoomResponse(await response.json());
      writeRoomCredential(payload.roomId, payload.hostCredential);

      setSession({
        surface: 'room',
        roomPhase: 'LOBBY',
        roomId: payload.roomId,
        ownerToken: payload.hostCredential.ownerToken,
        lobby: payload,
      });
      goToPage('room', payload.roomId);
    } catch {
      setRoomServiceReachable(false);
      startLocalSession(nextDraft, {
        tone: 'warning',
        title: t('ui.app.roomUnavailable', 'Room unavailable'),
        message: t('ui.app.roomFallbackLocal', 'Could not reach the room service. The game started offline instead.'),
        dismissAfterMs: 5200,
      });
    }
  };

  const claimLobbySeat = useCallback(async (ownerId: number) => {
    if (!session || session.surface !== 'room' || session.roomPhase !== 'LOBBY') {
      return;
    }

    const response = await fetch(buildApiUrl(`/api/rooms/${session.roomId}/join`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });
    if (!response.ok) {
      pushToast({
        tone: 'error',
        title: t('ui.room.claimFailed', 'Seat claim failed'),
        message: t('ui.room.claimFailedBody', 'That player slot could not be claimed. Refresh the lobby and try again.'),
        dismissAfterMs: 4200,
      });
      return;
    }

    const payload = parseJoinRoomResponse(await response.json());
    writeRoomCredential(payload.roomId, payload.ownerCredential);
    setSession({
      surface: 'room',
      roomPhase: 'LOBBY',
      roomId: payload.roomId,
      ownerToken: payload.ownerCredential.ownerToken,
      lobby: payload,
    });
  }, [pushToast, session]);

  const startRoomLobby = useCallback(async () => {
    if (!session || session.surface !== 'room' || session.roomPhase !== 'LOBBY' || !session.ownerToken) {
      return;
    }

    const response = await fetch(buildApiUrl(`/api/rooms/${session.roomId}/start`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerToken: session.ownerToken }),
    });
    if (!response.ok) {
      pushToast({
        tone: 'error',
        title: t('ui.room.startFailed', 'Room start failed'),
        message: t('ui.room.startFailedBody', 'The lobby could not launch the match yet. Make sure every player slot is claimed.'),
        dismissAfterMs: 4200,
      });
      return;
    }

    const payload = parseRoomSnapshot(await response.json());
    if (payload.phase !== 'ACTIVE') {
      return;
    }

    setSetupDraft((current) => createDraftFromState(payload.state, current, 'room'));
    setSession(buildActiveRoomSession(payload, session.ownerToken));
  }, [pushToast, session]);

  const copyRoomLink = useCallback(async (roomLink: string) => {
    try {
      await navigator.clipboard.writeText(roomLink);
      pushToast({
        tone: 'success',
        title: t('ui.room.roomLinkCopied', 'Room link copied'),
        message: t('ui.room.roomLinkCopiedBody', 'The room link was copied to the clipboard.'),
        dismissAfterMs: 3200,
      });
    } catch {
      pushToast({
        tone: 'warning',
        title: t('ui.app.clipboardUnavailable', 'Clipboard unavailable'),
        message: t('ui.room.roomLinkCopyFallback', 'Copy the room URL from the browser address bar and share it with the coalition.'),
        dismissAfterMs: 4200,
      });
    }
  }, [pushToast]);

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

    if (session.roomPhase !== 'ACTIVE') {
      return;
    }

    const response = await fetch(buildApiUrl(`/api/rooms/${session.roomId}/commands`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerToken: session.ownerToken, commands: [command] }),
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

    const payload = parseRoomSnapshot(await response.json());
    if (payload.phase !== 'ACTIVE') {
      return;
    }
    setSession((current) =>
      current && current.surface === 'room' && current.roomPhase === 'ACTIVE'
        ? { ...current, state: payload.state, authorizedOwnerId: payload.ownerId }
        : current,
    );
  };

  return (
    <AppLayout locale={locale} dir={dir}>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      {hydrating ? (
        <LoadingScreen />
      ) : session ? (
        session.surface === 'room' && session.roomPhase === 'LOBBY' ? (
          <RoomLobbyScreen
            roomId={session.roomId}
            snapshot={session.lobby}
            onClaimOwner={claimLobbySeat}
            onStartRoom={startRoomLobby}
            onCopyRoomLink={copyRoomLink}
            onBack={() => {
              setSession(null);
              setViewport(DEFAULT_SESSION_VIEWPORT);
              goToPage(runtime.defaultPage);
            }}
          />
        ) : runtime.devtoolsEnabled ? (
          <Suspense fallback={<LoadingScreen />}>
            <DevGameSessionShell
              surface={session.surface}
              roomId={session.roomId}
              state={session.state}
              content={session.content}
              viewState={viewport}
              onViewStateChange={(patch) => setViewport((current) => ({ ...current, ...patch }))}
              onCommand={sendCommand}
              onToast={pushToast}
              onBack={() => {
                setSession(null);
                setViewport(DEFAULT_SESSION_VIEWPORT);
                goToPage(runtime.defaultPage);
              }}
              authorizedOwnerId={session.authorizedOwnerId}
            />
          </Suspense>
        ) : (
          <GameSessionScreen
            state={session.state}
            content={session.content}
            viewState={viewport}
            onViewStateChange={(patch) => setViewport((current) => ({ ...current, ...patch }))}
            onCommand={sendCommand}
            onToast={pushToast}
            onBack={() => {
              setSession(null);
              setViewport(DEFAULT_SESSION_VIEWPORT);
              goToPage(runtime.defaultPage);
            }}
            authorizedOwnerId={session.authorizedOwnerId}
          />
        )
      ) : route.page === 'guidelines' ? (
        <GuidelinesScreen
          onBackHome={() => goToPage(runtime.defaultPage)}
          onOpenOffline={() => goToPage('offline')}
        />
      ) : route.page === 'player-guide' ? (
        <PlayerGuideScreen onBackHome={() => goToPage(runtime.defaultPage)} />
      ) : (
        <SessionSetupScreen
          config={setupDraft}
          roomPlayAvailable={roomServiceReachable}
          roomPlayChecking={roomServiceChecking}
          roomPlayDisabledByBuild={runtime.forceOfflineOnly}
          onConfigChange={(patch) => setSetupDraft((current) => applyScenarioDefaults({ ...current, ...patch }))}
          onStart={startSession}
          onOpenGuidelines={() => goToPage('guidelines')}
          onOpenPlayerGuide={() => goToPage('player-guide')}
          mode={route.page === 'offline' ? 'offline' : 'home'}
        />
      )}
    </AppLayout>
  );
}
