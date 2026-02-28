// ============================================================
// ActionPanel — Action Selection UI
// ============================================================

import { useState } from 'react';
import type { GameState, RegionName, DomainName, ActionParams } from '../game/types';
import { REGION_NAMES, DOMAIN_NAMES, RULES } from '../game/constants';
import { getActivePlayer } from '../game/engine';

interface ActionPanelProps {
    gameState: GameState;
    selectedRegion: RegionName | null;
    selectedCards: string[];
    onPerformAction: (action: ActionParams) => void;
    onSelectRegion: (region: RegionName | null) => void;
}

const ACTIONS = [
    { type: 'organize', icon: '✊', name: 'Organize', cost: '—', desc: 'Gain 1d6 Bodies (+2 if region has 4+ tokens)' },
    { type: 'investigate', icon: '🔍', name: 'Investigate', cost: '—', desc: 'Draw 2 Evidence, keep 1' },
    { type: 'launch_campaign', icon: '⚔️', name: 'Launch Campaign', cost: '1+ Bodies', desc: 'Fight a domain — Roll 2d6 vs 8' },
    { type: 'build_solidarity', icon: '🤝', name: 'Build Solidarity', cost: '3 Bodies', desc: 'Advance 1 domain (no roll)' },
    { type: 'smuggle_evidence', icon: '📨', name: 'Smuggle Evidence', cost: '1 Body/2 cards', desc: 'Transfer Evidence to ally' },
    { type: 'international_outreach', icon: '📡', name: 'Intl Outreach', cost: '2 Evidence', desc: 'Raise Global Gaze by 1' },
    { type: 'defend', icon: '🛡️', name: 'Defend', cost: 'Bodies', desc: 'Set Defense Rating vs intervention' },
    { type: 'play_resistance_card', icon: '🃏', name: 'Play Card', cost: '—', desc: 'Play an Action resistance card' },
] as const;

export function ActionPanel({ gameState, selectedRegion, selectedCards, onPerformAction, onSelectRegion }: ActionPanelProps) {
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [campaignBodies, setCampaignBodies] = useState(1);
    const [campaignDomain, setCampaignDomain] = useState<DomainName>('War Machine');
    const [defendBodies, setDefendBodies] = useState(1);
    const [smuggleTarget, setSmuggleTarget] = useState(0);

    const player = getActivePlayer(gameState);
    const hasActionsLeft = player.actionsRemaining > 0;

    const canPerformAction = (actionType: string): boolean => {
        if (!hasActionsLeft) return false;
        switch (actionType) {
            case 'organize':
            case 'investigate':
                return selectedRegion !== null;
            case 'launch_campaign':
                return selectedRegion !== null && player.bodies >= 1;
            case 'build_solidarity':
                return selectedRegion !== null && player.bodies >= RULES.buildSolidarityCost;
            case 'smuggle_evidence':
                return player.evidenceHand.length > 0 && selectedCards.length > 0 && gameState.players.length > 1;
            case 'international_outreach':
                return player.evidenceHand.length >= RULES.internationalOutreachCost;
            case 'defend':
                return selectedRegion !== null && player.bodies >= 1;
            case 'play_resistance_card':
                return player.resistanceHand.some(c => c.type === 'action') && selectedCards.length > 0;
            default:
                return false;
        }
    };

    const executeAction = () => {
        if (!activeAction || !hasActionsLeft) return;

        let action: ActionParams | null = null;

        switch (activeAction) {
            case 'organize':
                if (selectedRegion) action = { type: 'organize', params: { region: selectedRegion } };
                break;
            case 'investigate':
                if (selectedRegion) action = { type: 'investigate', params: { region: selectedRegion } };
                break;
            case 'launch_campaign':
                if (selectedRegion) {
                    const evidenceIds = selectedCards.filter(id =>
                        player.evidenceHand.some(c => c.id === id)
                    );
                    action = {
                        type: 'launch_campaign',
                        params: {
                            region: selectedRegion,
                            domain: campaignDomain,
                            bodiesCommitted: campaignBodies,
                            evidenceCardIds: evidenceIds,
                        },
                    };
                }
                break;
            case 'build_solidarity':
                if (selectedRegion) {
                    action = { type: 'build_solidarity', params: { region: selectedRegion, domain: campaignDomain } };
                }
                break;
            case 'smuggle_evidence':
                action = {
                    type: 'smuggle_evidence',
                    params: {
                        targetPlayerId: smuggleTarget,
                        cardIds: selectedCards.filter(id => player.evidenceHand.some(c => c.id === id)),
                    },
                };
                break;
            case 'international_outreach':
                action = { type: 'international_outreach' };
                break;
            case 'defend':
                if (selectedRegion) {
                    action = { type: 'defend', params: { region: selectedRegion, bodiesSpent: defendBodies } };
                }
                break;
            case 'play_resistance_card':
                if (selectedCards.length > 0) {
                    const cardId = selectedCards.find(id => player.resistanceHand.some(c => c.id === id));
                    if (cardId) {
                        action = { type: 'play_resistance_card', params: { cardId, targetRegion: selectedRegion || undefined } };
                    }
                }
                break;
        }

        if (action) {
            onPerformAction(action);
            setActiveAction(null);
        }
    };

    return (
        <div className="action-panel">
            <div className="action-panel-title">
                Actions ({player.actionsRemaining} remaining)
            </div>

            {/* Region selector */}
            {activeAction && ['organize', 'investigate', 'launch_campaign', 'build_solidarity', 'defend'].includes(activeAction) && (
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-header)', letterSpacing: '0.1em' }}>
                        Select Region:
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {REGION_NAMES.map(r => (
                            <button
                                key={r}
                                className={`btn btn-sm ${selectedRegion === r ? 'btn-primary' : ''}`}
                                onClick={() => onSelectRegion(r)}
                                style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Domain selector for campaign/solidarity */}
            {activeAction && ['launch_campaign', 'build_solidarity'].includes(activeAction) && (
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-header)', letterSpacing: '0.1em' }}>
                        Select Domain:
                    </div>
                    <select
                        className="game-select"
                        value={campaignDomain}
                        onChange={e => setCampaignDomain(e.target.value as DomainName)}
                    >
                        {DOMAIN_NAMES.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Bodies selector for campaign/defend */}
            {activeAction === 'launch_campaign' && (
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-header)', letterSpacing: '0.1em' }}>
                        Commit Bodies: {campaignBodies}
                    </div>
                    <div className="number-selector">
                        <button onClick={() => setCampaignBodies(Math.max(1, campaignBodies - 1))}>−</button>
                        <span className="value">{campaignBodies}</span>
                        <button onClick={() => setCampaignBodies(Math.min(player.bodies, campaignBodies + 1))}>+</button>
                    </div>
                </div>
            )}

            {activeAction === 'defend' && (
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-header)', letterSpacing: '0.1em' }}>
                        Bodies for Defense: {defendBodies}
                    </div>
                    <div className="number-selector">
                        <button onClick={() => setDefendBodies(Math.max(1, defendBodies - 1))}>−</button>
                        <span className="value">{defendBodies}</span>
                        <button onClick={() => setDefendBodies(Math.min(player.bodies, defendBodies + 1))}>+</button>
                    </div>
                </div>
            )}

            {/* Smuggle target selector */}
            {activeAction === 'smuggle_evidence' && (
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-header)', letterSpacing: '0.1em' }}>
                        Transfer To:
                    </div>
                    <select
                        className="game-select"
                        value={smuggleTarget}
                        onChange={e => setSmuggleTarget(Number(e.target.value))}
                    >
                        {gameState.players
                            .filter(p => p.id !== player.id)
                            .map(p => (
                                <option key={p.id} value={p.id}>{p.faction.displayName}</option>
                            ))}
                    </select>
                </div>
            )}

            <div className="action-grid">
                {ACTIONS.map(a => (
                    <button
                        key={a.type}
                        className={`action-btn ${activeAction === a.type ? 'active' : ''}`}
                        disabled={!canPerformAction(a.type) && activeAction !== a.type}
                        onClick={() => setActiveAction(activeAction === a.type ? null : a.type)}
                        title={a.desc}
                    >
                        <span className="action-icon">{a.icon}</span>
                        <span>{a.name}</span>
                        <span className="action-cost">{a.cost}</span>
                    </button>
                ))}
            </div>

            {activeAction && (
                <button
                    className="btn btn-primary"
                    onClick={executeAction}
                    disabled={!canPerformAction(activeAction)}
                    style={{ marginTop: '8px', width: '100%' }}
                >
                    Execute {ACTIONS.find(a => a.type === activeAction)?.name}
                </button>
            )}
        </div>
    );
}
