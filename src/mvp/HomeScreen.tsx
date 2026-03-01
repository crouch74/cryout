import { useState } from 'react';
import type { GameMode, RoleId } from '../../engine/index.ts';

export interface SetupConfig {
  surface: 'local' | 'room';
  scenarioId: 'witness_dignity';
  mode: GameMode;
  playerCount: 2 | 3 | 4;
  roleIds: RoleId[];
  seed: number;
  roomUrl: string;
  expansionIds: string[];
}

interface HomeScreenProps {
  defaultConfig: SetupConfig;
  hasAutosave: boolean;
  onStart: (config: SetupConfig) => void;
  onLoadSave: (serialized: string) => void;
  onLoadAutosave: () => void;
}

const ROLE_OPTIONS: Array<{ id: RoleId; name: string }> = [
  { id: 'organizer', name: 'Community Organizer' },
  { id: 'investigative_journalist', name: 'Investigative Journalist' },
  { id: 'human_rights_lawyer', name: 'Human Rights Lawyer' },
  { id: 'climate_energy_planner', name: 'Climate & Energy Planner' },
];

export function HomeScreen({ defaultConfig, hasAutosave, onStart, onLoadSave, onLoadAutosave }: HomeScreenProps) {
  const [config, setConfig] = useState<SetupConfig>(defaultConfig);
  const [saveText, setSaveText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedRoles = config.roleIds.slice(0, config.playerCount);
  const hasDuplicateRoles = new Set(selectedRoles).size !== selectedRoles.length;

  const updateRole = (seat: number, roleId: RoleId) => {
    const nextRoles = config.roleIds.slice();
    nextRoles[seat] = roleId;
    setConfig({ ...config, roleIds: nextRoles });
  };

  return (
    <div className="home-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Playable MVP</span>
          <h1>Dignity Rising</h1>
          <p>
            A cooperative strategy game about protecting civilians, defending truth, and building institutions under the pressure of a systemic antagonist.
          </p>
          <div className="hero-tags">
            <span>Hopeful long-term building</span>
            <span>Tragic resilience</span>
            <span>Bitter satire aimed upward</span>
          </div>
        </div>
        <div className="hero-brief">
          <h2>Witness &amp; Dignity</h2>
          <p>
            MENA sits under stacked war and rights pressure while climate accelerates spillover across the map. The coalition must hold open care, remedy, testimony, and culture long enough to ratify durable protections.
          </p>
          <ul>
            <li>2 to 4 players</li>
            <li>Core and Full modes</li>
            <li>Single-browser table play or localhost room play</li>
          </ul>
        </div>
      </section>

      <section className="setup-grid">
        <div className="panel">
          <h3>Launch</h3>
          <div className="segmented">
            <button
              className={config.surface === 'local' ? 'active' : ''}
              onClick={() => setConfig({ ...config, surface: 'local' })}
            >
              Local Table
            </button>
            <button
              className={config.surface === 'room' ? 'active' : ''}
              onClick={() => setConfig({ ...config, surface: 'room' })}
            >
              Room Play
            </button>
          </div>

          <label>
            Mode
            <select value={config.mode} onChange={(event) => setConfig({ ...config, mode: event.target.value as GameMode })}>
              <option value="CORE">Core</option>
              <option value="FULL">Full</option>
            </select>
          </label>

          <label>
            Player Count
            <select
              value={config.playerCount}
              onChange={(event) => setConfig({ ...config, playerCount: Number(event.target.value) as 2 | 3 | 4 })}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label>
            Seed
            <input
              type="number"
              value={config.seed}
              onChange={(event) => setConfig({ ...config, seed: Number(event.target.value) || 0 })}
            />
          </label>

          {config.surface === 'room' && (
            <label>
              Room Service URL
              <input
                type="text"
                value={config.roomUrl}
                onChange={(event) => setConfig({ ...config, roomUrl: event.target.value })}
                placeholder="http://localhost:3010"
              />
            </label>
          )}

          <button
            className="primary-button"
            disabled={hasDuplicateRoles}
            onClick={() => {
              if (hasDuplicateRoles) {
                setError('Roles must be unique.');
                return;
              }
              setError(null);
              onStart({ ...config, roleIds: selectedRoles });
            }}
          >
            {config.surface === 'local' ? 'Start Local Table' : 'Create Room'}
          </button>

          {error && <p className="inline-error">{error}</p>}
          {hasAutosave && (
            <button className="secondary-button" onClick={onLoadAutosave}>
              Load Autosave
            </button>
          )}
        </div>

        <div className="panel">
          <h3>Coalition Seats</h3>
          <div className="seat-grid">
            {Array.from({ length: config.playerCount }).map((_, seat) => (
              <label key={seat}>
                Seat {seat + 1}
                <select value={selectedRoles[seat]} onChange={(event) => updateRole(seat, event.target.value as RoleId)}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="panel save-panel">
          <h3>Load Save</h3>
          <textarea
            value={saveText}
            onChange={(event) => setSaveText(event.target.value)}
            placeholder="Paste a serialized save payload here."
          />
          <button
            className="secondary-button"
            onClick={() => {
              if (!saveText.trim()) {
                setError('Paste a save payload first.');
                return;
              }
              setError(null);
              onLoadSave(saveText);
            }}
          >
            Load Save Into Local Table
          </button>
        </div>
      </section>
    </div>
  );
}
