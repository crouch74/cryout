// ============================================================
// GlobalTracks — Global Gaze, War Machine, Domain Tracks
// ============================================================

import type { GameState } from '../game/types';
import { DOMAINS, DOMAIN_NAMES, RULES } from '../game/constants';

interface GlobalTracksProps {
    gameState: GameState;
}

export function GlobalTracks({ gameState }: GlobalTracksProps) {
    const gazePercent = (gameState.globalGaze / RULES.maxGlobalGaze) * 100;
    const warPercent = (gameState.northernWarMachine / RULES.maxWarMachine) * 100;

    return (
        <>
            {/* Main tracks */}
            <div className="top-bar">
                <div className="round-badge">Round {gameState.round}</div>

                <div className="track-container">
                    <span className="track-label">👁️ Global Gaze</span>
                    <div className="track-bar">
                        <div className="track-fill gaze" style={{ width: `${gazePercent}%` }} />
                    </div>
                    <span className="track-value">{gameState.globalGaze}/{RULES.maxGlobalGaze}</span>
                </div>

                <div className="track-container">
                    <span className="track-label">⚙️ War Machine</span>
                    <div className="track-bar">
                        <div className="track-fill war-machine" style={{ width: `${warPercent}%` }} />
                    </div>
                    <span className="track-value">{gameState.northernWarMachine}/{RULES.maxWarMachine}</span>
                </div>
            </div>

            {/* Domain tracks */}
            <div className="domain-tracks" style={{
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                padding: '6px var(--space-lg)',
            }}>
                {DOMAIN_NAMES.map(domain => {
                    const value = gameState.domainTracks[domain];
                    const percent = (value / RULES.maxDomainTrack) * 100;
                    const info = DOMAINS[domain];

                    return (
                        <div className="domain-pip" key={domain} title={`${domain}: ${info.description}`}>
                            <div className="domain-pip-label">{info.icon} {domain}</div>
                            <div className="domain-pip-bar">
                                <div
                                    className="domain-pip-fill"
                                    style={{ width: `${percent}%`, background: info.color === '#1E1E1E' ? '#666' : info.color }}
                                />
                            </div>
                            <div className="domain-pip-value">{value}/{RULES.maxDomainTrack}</div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
