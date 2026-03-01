import { useEffect, useState } from 'react';
import {
  compileContent,
  deserializeGame,
  dispatchCommand,
  initializeGame,
  serializeGame,
  type CompiledContent,
  type EngineCommand,
  type EngineState,
} from '../engine/index.ts';
import { GameScreen } from './mvp/GameScreen.tsx';
import { HomeScreen, type SetupConfig } from './mvp/HomeScreen.tsx';
import './index.css';

interface ActiveSession {
  surface: 'local' | 'room';
  roomId: string | null;
  roomUrl: string;
  content: CompiledContent;
  state: EngineState;
}

const AUTOSAVE_KEY = 'dignity-rising-autosave';

const DEFAULT_CONFIG: SetupConfig = {
  surface: 'local',
  scenarioId: 'witness_dignity',
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

export default function App() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.surface !== 'local') {
      return;
    }

    localStorage.setItem(AUTOSAVE_KEY, serializeGame(session.state));
  }, [session]);

  useEffect(() => {
    if (!session || session.surface !== 'room' || !session.roomId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`${session.roomUrl}/api/rooms/${session.roomId}`);
        const payload = (await response.json()) as { state: EngineState };
        setSession((current) => (current ? { ...current, state: payload.state } : current));
      } catch (roomError) {
        console.error(roomError);
      }
    }, 750);

    return () => window.clearInterval(interval);
  }, [session]);

  const startSession = async (config: SetupConfig) => {
    setError(null);
    setNotice(null);

    if (config.surface === 'local') {
      const content = compileContent(config.scenarioId, config.expansionIds);
      const state = initializeGame({
        type: 'StartGame',
        scenarioId: config.scenarioId,
        mode: config.mode,
        playerCount: config.playerCount,
        roleIds: config.roleIds,
        seed: config.seed,
        expansionIds: config.expansionIds,
      });
      setSession({
        surface: 'local',
        roomId: null,
        roomUrl: config.roomUrl,
        content,
        state,
      });
      return;
    }

    try {
      const response = await fetch(`${config.roomUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: config.scenarioId,
          mode: config.mode,
          playerCount: config.playerCount,
          roleIds: config.roleIds,
          seed: config.seed,
          expansionIds: config.expansionIds,
        }),
      });

      const payload = (await response.json()) as { roomId: string; state: EngineState };
      const content = compileContent(config.scenarioId, config.expansionIds);
      setSession({
        surface: 'room',
        roomId: payload.roomId,
        roomUrl: config.roomUrl,
        content,
        state: payload.state,
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
      setSession({
        surface: 'local',
        roomId: null,
        roomUrl: DEFAULT_CONFIG.roomUrl,
        content: compileContent(payload.scenarioId),
        state: payload.snapshot,
      });
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
      {session ? (
        <GameScreen
          surface={session.surface}
          roomId={session.roomId}
          state={session.state}
          content={session.content}
          onCommand={sendCommand}
          onBack={() => setSession(null)}
          onExportSave={exportSave}
        />
      ) : (
        <HomeScreen
          defaultConfig={DEFAULT_CONFIG}
          hasAutosave={Boolean(localStorage.getItem(AUTOSAVE_KEY))}
          onStart={startSession}
          onLoadSave={loadSerialized}
          onLoadAutosave={loadAutosave}
        />
      )}
    </div>
  );
}
