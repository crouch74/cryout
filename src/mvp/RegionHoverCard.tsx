import { Icon } from './icons/Icon.tsx';

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
        <span><Icon type="extraction" size={14} title="Extraction Tokens" /> {extraction}</span>
        <span><Icon type="defense" size={14} title="Defense" /> {defense}</span>
        <span><Icon type="bodies" size={14} title="Bodies" /> {bodies}</span>
      </div>
      <span>{strainLabel}</span>
    </article>
  );
}
