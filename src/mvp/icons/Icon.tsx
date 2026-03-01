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
    strokeWidth: 2.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (type) {
    case 'bodies':
      return (
        <>
          <circle cx="9" cy="9" r="2.1" {...common} />
          <circle cx="15.4" cy="10" r="2.1" {...common} />
          <path d="M5.8 18c1-2.5 2.9-3.8 5.6-3.8 2.5 0 4.4 1.3 5.4 3.8" {...common} />
          <path d="M12.8 17.5c.7-1.8 1.9-2.7 3.6-2.7 1.5 0 2.6.7 3.3 2.1" {...common} />
        </>
      );
    case 'evidence':
      return (
        <>
          <rect x="6.3" y="6.5" width="11.4" height="11" rx="1.8" {...common} />
          <path d="M9 10h6" {...common} />
          <path d="M9 13h6" {...common} />
          <path d="M9 16h3.2" {...common} />
        </>
      );
    case 'defense':
    case 'defend':
      return (
        <>
          <path d="M12 4.2 18 6.5v5.3c0 4.2-2.2 7-6 8.4-3.8-1.4-6-4.2-6-8.4V6.5l6-2.3Z" {...common} />
          <path d="M12 8.5v7.8" {...common} />
          <path d="M8.9 11.6h6.2" {...common} />
        </>
      );
    case 'extraction':
      return (
        <>
          <path d="M8 6.1h8l3.1 5.7-3.1 6.1H8l-3.1-6.1L8 6.1Z" {...common} />
          <path d="M12 8.5v6.8" {...common} />
          <path d="M9.7 11.7h4.6" {...common} />
        </>
      );
    case 'pool':
      return (
        <>
          <ellipse cx="12" cy="8.2" rx="4.8" ry="2.2" {...common} />
          <path d="M7.2 8.2v6.1c0 1.6 2.1 2.9 4.8 2.9s4.8-1.3 4.8-2.9V8.2" {...common} />
          <path d="M7.2 11.2c0 1.6 2.1 2.9 4.8 2.9s4.8-1.3 4.8-2.9" {...common} />
        </>
      );
    case 'globalGaze':
      return (
        <>
          <path d="M3.6 12s3.4-4.9 8.4-4.9 8.4 4.9 8.4 4.9-3.4 4.9-8.4 4.9S3.6 12 3.6 12Z" {...common} />
          <circle cx="12" cy="12" r="2.2" {...common} />
          <path d="M12 5.2V3.6" {...common} />
          <path d="m6.2 6.7-1.1-1.1" {...common} />
          <path d="M3.8 12H2.2" {...common} />
          <path d="m17.8 6.7 1.1-1.1" {...common} />
        </>
      );
    case 'warMachine':
      return (
        <>
          <circle cx="12" cy="12" r="2.5" {...common} />
          <path d="M12 3.6v3.2" {...common} />
          <path d="m19.2 8-2.8 1.5" {...common} />
          <path d="m19.2 16-2.8-1.5" {...common} />
          <path d="M12 20.4v-3.2" {...common} />
          <path d="m4.8 16 2.8-1.5" {...common} />
          <path d="m4.8 8 2.8 1.5" {...common} />
          <path d="m15.8 5.7-1.4 2.4" {...common} />
          <path d="m8.2 5.7 1.4 2.4" {...common} />
        </>
      );
    case 'round':
      return (
        <>
          <circle cx="12" cy="12" r="6.3" {...common} />
          <path d="M12 8.1v4.2l2.9 1.9" {...common} />
          <path d="M12 3.8v1.7" {...common} />
        </>
      );
    case 'modeLiberation':
      return (
        <>
          <path d="M6.2 18.2V5.4" {...common} />
          <path d="M7.1 6.1c3.5 0 4.5 1.1 7 1.1 1.3 0 2.4-.3 3.7-.9v6c-1.3.6-2.4.9-3.7.9-2.5 0-3.5-1.1-7-1.1" {...common} />
          <path d="M6.2 18.2h3.1" {...common} />
        </>
      );
    case 'objective':
      return (
        <>
          <path d="M12 4.8 18 8.2v7.6L12 19.2 6 15.8V8.2l6-3.4Z" {...common} />
          <path d="M12 8.3v7" {...common} />
          <path d="m6.4 8.6 5.6 3.1 5.6-3.1" {...common} />
        </>
      );
    case 'launchCampaign':
      return (
        <>
          <path d="M5.2 18.2h13.6" {...common} />
          <path d="m8.2 15.6 3.4-7.4 4.2 4.1 2.1-4.3" {...common} />
          <path d="M17.9 7.9h2.1V10" {...common} />
        </>
      );
    case 'organize':
      return (
        <>
          <circle cx="8" cy="9" r="1.8" {...common} />
          <circle cx="15.9" cy="8.1" r="1.8" {...common} />
          <circle cx="12" cy="15.6" r="1.8" {...common} />
          <path d="m9.6 10.2 1.8 3.3" {...common} />
          <path d="m14.4 9.5-1.2 4" {...common} />
          <path d="M10 9.2h4" {...common} />
        </>
      );
    case 'investigate':
      return (
        <>
          <circle cx="10.3" cy="10.3" r="4.4" {...common} />
          <path d="m13.8 13.8 4.1 4.1" {...common} />
          <path d="M10.3 8.2v4.2" {...common} />
          <path d="M10.3 10.3h2.9" {...common} />
        </>
      );
    case 'buildSolidarity':
      return (
        <>
          <path d="M6.4 15.8 9 11.9l2.9 2.5 3.1-4.4 2.6 5.8" {...common} />
          <path d="M5.1 18.1h13.8" {...common} />
        </>
      );
    case 'smuggleEvidence':
      return (
        <>
          <path d="M6.3 8h8.5v9H6.3z" {...common} />
          <path d="M14.8 10.2h2.9c1.1 0 1.9.8 1.9 1.9v2.9c0 1.1-.8 1.9-1.9 1.9h-2.9" {...common} />
          <path d="M9.2 11h2.8" {...common} />
          <path d="M9.2 14h2.8" {...common} />
        </>
      );
    case 'internationalOutreach':
      return (
        <>
          <circle cx="12" cy="12" r="6.7" {...common} />
          <path d="M5.4 12h13.2" {...common} />
          <path d="M12 5.3c2 1.8 3.1 4 3.1 6.7S14 16.9 12 18.7" {...common} />
          <path d="M12 5.3c-2 1.8-3.1 4-3.1 6.7s1.1 4.9 3.1 6.7" {...common} />
        </>
      );
    case 'playCard':
      return (
        <>
          <rect x="6.7" y="4.9" width="10.6" height="14.2" rx="1.8" {...common} />
          <path d="M9.7 8.8h4.6" {...common} />
          <path d="M9.7 12.1h4.6" {...common} />
          <path d="M9.7 15.4h3" {...common} />
        </>
      );
    case 'frontWar':
      return (
        <>
          <path d="M5.3 15.8h13.4" {...common} />
          <path d="M7.1 14.3V8.2" {...common} />
          <path d="M10.6 14.3V6.6" {...common} />
          <path d="M14.1 14.3v-4.7" {...common} />
          <path d="M17.2 14.3v-6.9" {...common} />
        </>
      );
    case 'frontPlanet':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" {...common} />
          <path d="M9.3 10c1.2-1.6 2.8-2.4 4.9-2.4" {...common} />
          <path d="M8.3 14.7c1.8-.3 3.2.1 4.3 1.2 1-1.3 2.1-2.2 3.4-2.6" {...common} />
        </>
      );
    case 'frontCage':
      return (
        <>
          <path d="M8 8.3V7a2 2 0 1 1 4 0v1.3" {...common} />
          <path d="M12 8.3V7a2 2 0 1 1 4 0v1.3" {...common} />
          <path d="M6.5 8.3h11v8.9h-11z" {...common} />
          <path d="M9.2 8.6v8.3" {...common} />
          <path d="M12 8.6v8.3" {...common} />
          <path d="M14.8 8.6v8.3" {...common} />
        </>
      );
    case 'frontTruth':
      return (
        <>
          <path d="M6.4 16.3V9.6" {...common} />
          <path d="M12 16.3V6.6" {...common} />
          <path d="M17.6 16.3v-4.2" {...common} />
          <path d="m9.6 9.6 2.4-2.4 2.4 2.4" {...common} />
        </>
      );
    case 'frontHunger':
      return (
        <>
          <path d="M7.1 16c0-3 2.2-5 4.9-5s4.9 2 4.9 5H7.1Z" {...common} />
          <path d="M9 10.2c.7-1.5 1.7-2.2 3-2.2 1.4 0 2.4.7 3 2.2" {...common} />
          <path d="M12 8v8" {...common} />
        </>
      );
    case 'frontFossil':
      return (
        <>
          <path d="M5.5 12.2h13" {...common} />
          <path d="M8.8 8.7v7" {...common} />
          <path d="M15.2 8.7v7" {...common} />
          <path d="M12 6.8v10.6" {...common} />
        </>
      );
    case 'frontVoice':
      return (
        <>
          <path d="M5.8 7.8h12.4v7H13l-3.2 3.3v-3.3H5.8V7.8Z" {...common} />
          <path d="M9.2 10.4h5.8" {...common} />
          <path d="M9.2 13h3.9" {...common} />
        </>
      );
    case 'ledger':
      return (
        <>
          <path d="M7.8 5.5h9.5v12.7H7.8z" {...common} />
          <path d="M7.8 8.7H6v9.8h9.5v-1.7" {...common} />
          <path d="M10 10h5" {...common} />
          <path d="M10 13.2h5" {...common} />
        </>
      );
    case 'seat':
      return (
        <>
          <circle cx="12" cy="8.8" r="2.3" {...common} />
          <path d="M7.2 18c.9-2.8 2.5-4.2 4.8-4.2s3.9 1.4 4.8 4.2" {...common} />
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
