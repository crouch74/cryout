import { Icon } from '../../ui/icon/Icon.tsx';
import { formatNumber, t } from '../../i18n/index.ts';

export function RegionHoverCard({
  regionName,
  extraction,
  defense,
  comrades,
  strainLabel,
}: {
  regionName: string;
  extraction: number;
  defense: number;
  comrades: number;
  strainLabel: string;
}) {
  return (
    <article className="region-hover-card">
      <strong>{regionName}</strong>
      <div className="region-hover-row">
        <span><Icon type="extraction" size="xs" title={t('ui.game.extractionTokens', 'Extraction Tokens')} /> {formatNumber(extraction)}</span>
        <span><Icon type="defense" size="xs" title={t('ui.game.defense', 'Defense')} /> {formatNumber(defense)}</span>
        <span><Icon type="comrades" size="xs" title={t('ui.game.comrades', 'Comrades')} /> {formatNumber(comrades)}</span>
      </div>
      <span>{strainLabel}</span>
    </article>
  );
}
