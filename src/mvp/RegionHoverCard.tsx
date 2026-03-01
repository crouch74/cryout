import { Icon } from './icons/Icon.tsx';
import { formatNumber, t } from '../i18n/index.ts';

export function RegionHoverCard({
  regionName,
  extraction,
  defense,
  bodies,
  strainLabel,
}: {
  regionName: string;
  extraction: number;
  defense: number;
  bodies: number;
  strainLabel: string;
}) {
  return (
    <article className="region-hover-card">
      <strong>{regionName}</strong>
      <div className="region-hover-row">
        <span><Icon type="extraction" size={14} title={t('ui.game.extractionTokens', 'Extraction Tokens')} /> {formatNumber(extraction)}</span>
        <span><Icon type="defense" size={14} title={t('ui.game.defense', 'Defense')} /> {formatNumber(defense)}</span>
        <span><Icon type="bodies" size={14} title={t('ui.game.bodies', 'Comrades')} /> {formatNumber(bodies)}</span>
      </div>
      <span>{strainLabel}</span>
    </article>
  );
}
