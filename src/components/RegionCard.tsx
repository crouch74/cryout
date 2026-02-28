// ============================================================
// RegionCard — Individual Region Display
// ============================================================

import type { Region, RegionName } from '../game/types';
import { RULES } from '../game/constants';

interface RegionCardProps {
    region: Region;
    isSelected: boolean;
    onClick: (name: RegionName) => void;
    animateClass?: string;
}

export function RegionCard({ region, isSelected, onClick, animateClass }: RegionCardProps) {
    const tokenPercentage = region.extractionTokens / RULES.maxExtractionTokens;
    const isDanger = region.extractionTokens >= 5;

    return (
        <div
            className={`region-card ${isSelected ? 'selected' : ''} ${isDanger ? 'danger' : ''} ${animateClass || ''}`}
            onClick={() => onClick(region.name)}
            id={`region-${region.name.replace(/\s+/g, '-').toLowerCase()}`}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div className="region-name">{region.name}</div>
                    <div className="region-icons">{region.icons.join(' ')}</div>
                </div>
                <div style={{
                    fontFamily: 'var(--font-header)',
                    fontSize: '1.8rem',
                    color: isDanger ? 'var(--earth-red)' : tokenPercentage > 0.5 ? 'var(--ochre)' : 'var(--text-muted)',
                    lineHeight: 1,
                }}>
                    {region.extractionTokens}
                </div>
            </div>

            <div className="extraction-tokens">
                {Array.from({ length: RULES.maxExtractionTokens }).map((_, i) => (
                    <div
                        key={i}
                        className={`extraction-token ${i < region.extractionTokens ? 'filled stamp-appear' : 'empty'}`}
                    />
                ))}
            </div>

            <div className="region-description">{region.description}</div>

            <div className="region-stats">
                {region.defenseRating > 0 && (
                    <span className="stat-badge defense">🛡️ {region.defenseRating}</span>
                )}
                {Object.values(region.bodiesPresent).reduce((a, b) => a + b, 0) > 0 && (
                    <span className="stat-badge bodies">
                        ✊ {Object.values(region.bodiesPresent).reduce((a, b) => a + b, 0)} present
                    </span>
                )}
            </div>
        </div>
    );
}
