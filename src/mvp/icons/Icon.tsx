import type { CSSProperties } from 'react';
import { ICON_BASE_SHAPES, ICON_COLORS } from './iconTheme.ts';
import type { IconBaseShape, IconState, IconType } from './iconTypes.ts';

interface IconProps {
  type: IconType;
  size?: number;
  state?: IconState;
  baseShape?: IconBaseShape;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

function renderGlyph(type: IconType) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'bodies':
      return (
        <>
          <circle cx="9" cy="9" r="2.5" {...common} />
          <circle cx="15" cy="10" r="2.5" {...common} />
          <path d="M5.5 18c.9-2.9 2.7-4.3 5.5-4.3 2.7 0 4.5 1.4 5.5 4.3" {...common} />
          <path d="M11.5 18c.7-2.1 2.1-3.2 4.2-3.2 1.6 0 2.9.7 3.8 2.2" {...common} />
        </>
      );
    case 'evidence':
    case 'globalGaze':
      return (
        <>
          <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" {...common} />
          <circle cx="12" cy="12" r="2.5" {...common} />
        </>
      );
    case 'defense':
    case 'defend':
      return <path d="M12 4 18 6.5v5.2c0 4.1-2.3 6.9-6 8.3-3.7-1.4-6-4.2-6-8.3V6.5L12 4Z" {...common} />;
    case 'extraction':
      return (
        <>
          <path d="M8 18h8" {...common} />
          <path d="M12 6v12" {...common} />
          <path d="M9 7h6l2 3H7l2-3Z" {...common} />
          <path d="M10 12h4" {...common} />
        </>
      );
    case 'warMachine':
      return (
        <>
          <circle cx="12" cy="12" r="3" {...common} />
          <path d="m12 4 1.2 2.2L16 5.7l.5 2.8L19 9l-2 1.8.5 2.8-2.8-.5L13.2 16 12 19l-1.2-3-2.5-2.4-2.8.5.5-2.8L4 9l2.5-.5.5-2.8 2.8.5L12 4Z" {...common} />
        </>
      );
    case 'round':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" {...common} />
          <path d="M12 5.5v6.7l3.8 2.1" {...common} />
        </>
      );
    case 'modeLiberation':
      return (
        <>
          <path d="M5 14c1.6 3.3 4 5 7 5s5.4-1.7 7-5c-1.7.8-3.3 1.1-5 1.1-1 0-1.9-.1-2.9-.4A12.5 12.5 0 0 1 5 14Z" {...common} />
          <path d="M12 6c1.4 0 2.7.6 3.6 1.7" {...common} />
          <path d="M8.4 7.7A5 5 0 0 1 12 6" {...common} />
        </>
      );
    case 'objective':
    case 'launchCampaign':
      return (
        <>
          <circle cx="12" cy="12" r="6" {...common} />
          <circle cx="12" cy="12" r="2" {...common} />
          <path d="M12 4v2" {...common} />
          <path d="M20 12h-2" {...common} />
          <path d="M12 20v-2" {...common} />
          <path d="M4 12h2" {...common} />
        </>
      );
    case 'organize':
      return (
        <>
          <path d="M7 17v-6" {...common} />
          <path d="M12 17V8" {...common} />
          <path d="M17 17v-4" {...common} />
          <path d="M5 17h14" {...common} />
        </>
      );
    case 'investigate':
      return (
        <>
          <circle cx="10.5" cy="10.5" r="4.5" {...common} />
          <path d="m14 14 4 4" {...common} />
        </>
      );
    case 'buildSolidarity':
      return (
        <>
          <path d="M7 13.5 10 11l2 2 3-3 2 2" {...common} />
          <path d="M5 17h14" {...common} />
        </>
      );
    case 'smuggleEvidence':
      return (
        <>
          <path d="M6 8h5v8H6z" {...common} />
          <path d="M13 10h5v6h-5z" {...common} />
          <path d="M11 12h2" {...common} />
        </>
      );
    case 'internationalOutreach':
      return (
        <>
          <circle cx="12" cy="12" r="7" {...common} />
          <path d="M5 12h14" {...common} />
          <path d="M12 5a11 11 0 0 1 0 14" {...common} />
          <path d="M12 5a11 11 0 0 0 0 14" {...common} />
        </>
      );
    case 'playCard':
      return (
        <>
          <rect x="7" y="5" width="10" height="14" rx="1.5" {...common} />
          <path d="M10 9h4" {...common} />
          <path d="M10 13h4" {...common} />
        </>
      );
    case 'frontWar':
      return <path d="M5 15h10l2 2h2v-3h-2l-1-3H9l-1 1H5v3Z" {...common} />;
    case 'frontPlanet':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" {...common} />
          <path d="M9 9.5c1.6-.9 3.2-1 5-.2" {...common} />
          <path d="M8.5 15.5c2.4-1 4.7-.9 7 .2" {...common} />
        </>
      );
    case 'frontCage':
      return (
        <>
          <path d="M8 9V7a2 2 0 1 1 4 0v2" {...common} />
          <path d="M12 9V7a2 2 0 1 1 4 0v2" {...common} />
          <path d="M7 9v8" {...common} />
          <path d="M12 9v8" {...common} />
          <path d="M17 9v8" {...common} />
        </>
      );
    case 'frontTruth':
      return (
        <>
          <path d="M6 16V8" {...common} />
          <path d="M12 16V6" {...common} />
          <path d="M18 16v-4" {...common} />
          <path d="m10 10 2-2 2 2" {...common} />
        </>
      );
    case 'frontHunger':
      return (
        <>
          <path d="M7 15c0-2.7 2.2-4.5 5-4.5s5 1.8 5 4.5H7Z" {...common} />
          <path d="M9 10.5c.6-1.7 1.6-2.5 3-2.5 1.5 0 2.5.8 3 2.5" {...common} />
        </>
      );
    case 'frontFossil':
      return (
        <>
          <path d="M6 12h12" {...common} />
          <path d="M9 9v6" {...common} />
          <path d="M15 9v6" {...common} />
        </>
      );
    case 'frontVoice':
      return (
        <>
          <path d="M6 8h12v7h-5l-3 3v-3H6V8Z" {...common} />
          <path d="m13 10 2 2-2 2" {...common} />
        </>
      );
    case 'ledger':
      return (
        <>
          <path d="M8 6h9v12H8z" {...common} />
          <path d="M8 9H6v9h9v-2" {...common} />
          <path d="M10 10h5" {...common} />
          <path d="M10 13h5" {...common} />
        </>
      );
    case 'seat':
      return (
        <>
          <circle cx="12" cy="9" r="2.5" {...common} />
          <path d="M7 18c.9-3 2.6-4.5 5-4.5s4.1 1.5 5 4.5" {...common} />
        </>
      );
  }
}

function renderBaseShape(baseShape: IconBaseShape) {
  const common = {
    fill: 'currentColor',
    opacity: 0.18,
    stroke: 'currentColor',
    strokeWidth: 1.2,
  };

  switch (baseShape) {
    case 'circle':
      return <circle cx="12" cy="12" r="10" {...common} />;
    case 'hex':
      return <path d="M8 3.8h8L20.2 12 16 20.2H8L3.8 12 8 3.8Z" {...common} />;
    case 'diamond':
      return <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" {...common} />;
    case 'rounded-rect':
      return <rect x="3.5" y="5" width="17" height="14" rx="3" {...common} />;
    default:
      return null;
  }
}

export function Icon({
  type,
  size = 20,
  state = 'default',
  baseShape,
  title,
  ariaLabel,
  className = '',
}: IconProps) {
  const resolvedBaseShape = baseShape ?? ICON_BASE_SHAPES[type] ?? 'none';
  const style = {
    ['--icon-color' as string]: ICON_COLORS[type],
  } as CSSProperties;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel ?? title ?? type}
      className={`ui-icon ui-icon-${type} is-${state} ${className}`.trim()}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      {renderBaseShape(resolvedBaseShape)}
      {renderGlyph(type)}
    </svg>
  );
}
