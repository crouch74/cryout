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
  switch (type) {
    case 'bodies':
      return (
        <>
          <circle cx="8.4" cy="8.5" r="2.4" fill="currentColor" />
          <circle cx="15.9" cy="9.5" r="2.3" fill="currentColor" opacity="0.96" />
          <path d="M4.9 18.8c.4-3 2.8-5 6-5s5.5 2 5.9 5H4.9Z" fill="currentColor" />
          <path d="M12.2 18.8c.3-2.3 2.1-3.9 4.4-3.9 1.8 0 3.4 1 4 3.9h-8.4Z" fill="currentColor" opacity="0.88" />
        </>
      );
    case 'close':
      return (
        <>
          <path d="m7.7 7.7 8.6 8.6m0-8.6-8.6 8.6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </>
      );
    case 'evidence':
      return (
        <>
          <path d="M7 4.8h7.3l3 3v11.4a1.9 1.9 0 0 1-1.9 1.9H7a1.9 1.9 0 0 1-1.9-1.9V6.7A1.9 1.9 0 0 1 7 4.8Z" fill="currentColor" />
          <path d="M14.3 4.8v3h3" fill="#f4ead6" opacity="0.8" />
          <rect x="8.4" y="10" width="7.2" height="1.4" rx=".7" fill="#f4ead6" opacity="0.9" />
          <rect x="8.4" y="13" width="7.2" height="1.4" rx=".7" fill="#f4ead6" opacity="0.9" />
          <rect x="8.4" y="16" width="4.1" height="1.4" rx=".7" fill="#f4ead6" opacity="0.9" />
        </>
      );
    case 'defense':
    case 'defend':
      return (
        <>
          <path d="M12 3.8 18.9 6.5v5.7c0 4.2-2.6 7.4-6.9 8.9-4.3-1.5-6.9-4.7-6.9-8.9V6.5L12 3.8Z" fill="currentColor" />
          <path d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3V8Z" fill="#f4ead6" opacity="0.9" />
        </>
      );
    case 'extraction':
      return (
        <>
          <path d="M8 3.9h8L20.2 12 16 20.1H8L3.8 12 8 3.9Z" fill="currentColor" />
          <path d="M11 7.8h2v3.2h3.1v2H13V16h-2v-3h-3v-2H11V7.8Z" fill="#ede1cc" opacity="0.9" />
        </>
      );
    case 'pool':
      return (
        <>
          <ellipse cx="12" cy="7.6" rx="5.7" ry="2.7" fill="currentColor" />
          <path d="M6.3 7.8v6.5c0 2 2.5 3.7 5.7 3.7s5.7-1.7 5.7-3.7V7.8c0 2-2.5 3.7-5.7 3.7S6.3 9.8 6.3 7.8Z" fill="currentColor" opacity="0.92" />
          <ellipse cx="12" cy="14.2" rx="5.7" ry="2.2" fill="#f4ead6" opacity="0.32" />
        </>
      );
    case 'globalGaze':
      return (
        <>
          <path d="M2.8 12c2.4-3.8 5.8-5.7 9.2-5.7 3.4 0 6.8 1.9 9.2 5.7-2.4 3.8-5.8 5.7-9.2 5.7-3.4 0-6.8-1.9-9.2-5.7Z" fill="currentColor" />
          <circle cx="12" cy="12" r="3.1" fill="#f4ead6" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </>
      );
    case 'warMachine':
      return (
        <>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M11.1 2.8h1.8l.7 3-1.6.6-1.6-.6.7-3Zm0 18.4h1.8l.7-3-1.6-.6-1.6.6.7 3Zm8-14.8 1 1.5-2 2.4-1.5-.7-.2-1.7 2.7-1.5Zm-14.2 9.2 1 1.5 2.7-1.5-.2-1.7-1.5-.7-2 2.4Zm0-7.7 2-2.4 1.5.7.2 1.7-2.7 1.5-1-1.5Zm14.2 9.2-2-2.4-1.5.7-.2 1.7 2.7 1.5 1-1.5Z" fill="currentColor" opacity="0.94" />
        </>
      );
    case 'round':
      return (
        <>
          <circle cx="12" cy="12" r="7.6" fill="currentColor" />
          <path d="M11 7.5h2v5.1l3.5 2-.9 1.6-4.6-2.6V7.5Z" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'modeLiberation':
      return (
        <>
          <path d="M6.2 4.2h1.8v15.6H6.2z" fill="currentColor" />
          <path d="M8.1 5.3c3.4 0 4.7 1.3 7.1 1.3 1.2 0 2.3-.2 3.6-.8v7c-1.3.6-2.4.8-3.6.8-2.4 0-3.7-1.3-7.1-1.3V5.3Z" fill="currentColor" opacity="0.94" />
          <rect x="5.4" y="18.3" width="4.2" height="1.5" rx=".75" fill="currentColor" />
        </>
      );
    case 'mandate':
      return (
        <>
          <path d="M6.4 4.8h9.7l3.5 3.7v9.8a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" fill="currentColor" />
          <path d="M16.1 4.8v3.7h3.5" fill="#f4ead6" opacity="0.76" />
          <circle cx="12" cy="14" r="2.2" fill="#f4ead6" opacity="0.95" />
          <path d="m12 16.1 1.7 2.3 1-.9-.5-2.2H9.8l-.5 2.2 1 .9 1.7-2.3Z" fill="#f4ead6" opacity="0.9" />
          <path d="M8.7 9.2h5.3" stroke="#f4ead6" strokeWidth="1.3" strokeLinecap="round" opacity="0.82" />
        </>
      );
    case 'objective':
      return (
        <>
          <path d="M12 3.9 19 8v8L12 20.1 5 16V8l7-4.1Z" fill="currentColor" />
          <path d="m8.2 11.9 2.4 2.4 5.1-5.1 1.4 1.4-6.5 6.5-3.8-3.8 1.4-1.4Z" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'launchCampaign':
      return (
        <>
          <path d="M4.4 17.8h15.2v1.8H4.4z" fill="currentColor" />
          <path d="m7 15.4 4-8.8 4.2 4 2.5-5 1.8.9-3.6 7.2-4.1-4-3.1 6.6Z" fill="currentColor" opacity="0.94" />
        </>
      );
    case 'organize':
      return (
        <>
          <circle cx="8" cy="8.4" r="2.1" fill="currentColor" />
          <circle cx="16" cy="8.4" r="2.1" fill="currentColor" />
          <circle cx="12" cy="15.8" r="2.1" fill="currentColor" />
          <path d="M9 9.4h6v1.9H9zm2.1 1.4 1.8 3.2 1.6-5.2 1.8.5-2.3 7.1h-2l-2.7-4.9 1.8-.7Z" fill="currentColor" opacity="0.92" />
        </>
      );
    case 'investigate':
      return (
        <>
          <circle cx="10.2" cy="10.2" r="4.8" fill="currentColor" />
          <rect x="14" y="13.5" width="6.4" height="2.3" rx="1.15" transform="rotate(45 14 13.5)" fill="currentColor" />
          <rect x="9.3" y="7.7" width="1.8" height="4.9" rx=".9" fill="#f4ead6" opacity="0.92" />
          <rect x="9.3" y="9.3" width="4.8" height="1.8" rx=".9" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'buildSolidarity':
      return (
        <>
          <path d="m5.1 17.6 3.6-6.1 3 2.8 3.3-5 4 8.3H5.1Z" fill="currentColor" />
          <rect x="4.6" y="18.1" width="14.8" height="1.5" rx=".75" fill="currentColor" opacity="0.95" />
        </>
      );
    case 'smuggleEvidence':
      return (
        <>
          <rect x="5.6" y="7.2" width="9.4" height="10.4" rx="1.8" fill="currentColor" />
          <path d="M15 9.7h2.6a1.9 1.9 0 0 1 1.9 1.9v2.7a1.9 1.9 0 0 1-1.9 1.9H15v-1.9h2.1a.6.6 0 0 0 .6-.6v-1.4a.6.6 0 0 0-.6-.6H15V9.7Z" fill="currentColor" opacity="0.94" />
          <rect x="8" y="10.2" width="4.4" height="1.5" rx=".75" fill="#f4ead6" opacity="0.92" />
          <rect x="8" y="13.3" width="4.4" height="1.5" rx=".75" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'internationalOutreach':
      return (
        <>
          <circle cx="12" cy="12" r="7.2" fill="currentColor" />
          <path d="M5.9 11.1h12.2v1.8H5.9zm5.2-5.3c-1.8 1.8-2.8 3.9-2.8 6.2 0 2.3 1 4.4 2.8 6.2H9.2c-1.6-1.8-2.5-3.9-2.5-6.2 0-2.3.9-4.4 2.5-6.2h1.9Zm3.7 0h1.9c1.6 1.8 2.5 3.9 2.5 6.2 0 2.3-.9 4.4-2.5 6.2h-1.9c1.8-1.8 2.8-3.9 2.8-6.2 0-2.3-1-4.4-2.8-6.2Z" fill="#f4ead6" opacity="0.88" />
        </>
      );
    case 'playCard':
      return (
        <>
          <rect x="6.2" y="4.4" width="11.6" height="15.2" rx="2" fill="currentColor" />
          <rect x="8.9" y="7.9" width="6.2" height="1.5" rx=".75" fill="#f4ead6" opacity="0.9" />
          <rect x="8.9" y="11.1" width="6.2" height="1.5" rx=".75" fill="#f4ead6" opacity="0.9" />
          <rect x="8.9" y="14.3" width="3.8" height="1.5" rx=".75" fill="#f4ead6" opacity="0.9" />
        </>
      );
    case 'advancePhase':
      return (
        <>
          <path d="M6.2 6.2 15.8 12 6.2 17.8V6.2Z" fill="currentColor" />
          <rect x="16.8" y="6.6" width="1.9" height="10.8" rx=".95" fill="currentColor" opacity="0.9" />
        </>
      );
    case 'frontWar':
      return (
        <>
          <rect x="5.1" y="14.8" width="13.8" height="1.9" rx=".95" fill="currentColor" />
          <rect x="6.3" y="9.2" width="2" height="5.6" rx="1" fill="currentColor" />
          <rect x="9.8" y="6.7" width="2" height="8.1" rx="1" fill="currentColor" />
          <rect x="13.3" y="10.1" width="2" height="4.7" rx="1" fill="currentColor" />
          <rect x="16.8" y="7.3" width="2" height="7.5" rx="1" fill="currentColor" />
        </>
      );
    case 'frontPlanet':
      return (
        <>
          <circle cx="12" cy="12" r="7.2" fill="currentColor" />
          <path d="M8.1 13.8c1.7-1.1 3.3-1.4 4.9-.8 1-1.8 2.3-3 4.1-3.6-.2 3.4-1.4 5.8-3.8 7.2-2.3 1.4-4.5 1.4-6.6.2.1-1.3.6-2.3 1.4-3Z" fill="#f4ead6" opacity="0.88" />
        </>
      );
    case 'frontCage':
      return (
        <>
          <path d="M7.1 8.6V7.2a2.6 2.6 0 0 1 5.2 0v1.4h-1.8V7.4a.8.8 0 0 0-1.7 0v1.2H7.1Zm4.6 0V7.2a2.6 2.6 0 0 1 5.2 0v1.4h-1.8V7.4a.8.8 0 0 0-1.7 0v1.2h-1.7Z" fill="currentColor" />
          <rect x="5.8" y="8.4" width="12.4" height="9.5" rx="1.6" fill="currentColor" />
          <rect x="8.6" y="9.6" width="1.2" height="7.1" rx=".6" fill="#f4ead6" opacity="0.78" />
          <rect x="11.4" y="9.6" width="1.2" height="7.1" rx=".6" fill="#f4ead6" opacity="0.78" />
          <rect x="14.2" y="9.6" width="1.2" height="7.1" rx=".6" fill="#f4ead6" opacity="0.78" />
        </>
      );
    case 'frontTruth':
      return (
        <>
          <rect x="5.6" y="10" width="2.2" height="6.7" rx="1.1" fill="currentColor" />
          <rect x="10.9" y="6.7" width="2.2" height="10" rx="1.1" fill="currentColor" />
          <rect x="16.2" y="11.7" width="2.2" height="5" rx="1.1" fill="currentColor" />
          <path d="m9.4 10 2.6-2.8 2.6 2.8H9.4Z" fill="currentColor" opacity="0.92" />
        </>
      );
    case 'frontHunger':
      return (
        <>
          <path d="M6.6 16.9c0-3.5 2.4-5.9 5.4-5.9s5.4 2.4 5.4 5.9H6.6Z" fill="currentColor" />
          <path d="M8.7 10.6c.9-1.9 2-2.8 3.3-2.8 1.4 0 2.5.9 3.3 2.8H8.7Z" fill="currentColor" opacity="0.9" />
          <rect x="11.1" y="8.2" width="1.8" height="8.5" rx=".9" fill="#f4ead6" opacity="0.82" />
        </>
      );
    case 'frontFossil':
      return (
        <>
          <rect x="5.1" y="11.3" width="13.8" height="1.9" rx=".95" fill="currentColor" />
          <rect x="8.1" y="8" width="2.1" height="8.6" rx="1.05" fill="currentColor" />
          <rect x="11" y="6.4" width="2.1" height="11.8" rx="1.05" fill="currentColor" />
          <rect x="13.9" y="8" width="2.1" height="8.6" rx="1.05" fill="currentColor" />
        </>
      );
    case 'frontVoice':
      return (
        <>
          <path d="M5 6.8h14v8.7h-5.6l-4.1 3.5v-3.5H5V6.8Z" fill="currentColor" />
          <rect x="8.4" y="10" width="7.1" height="1.4" rx=".7" fill="#f4ead6" opacity="0.92" />
          <rect x="8.4" y="12.9" width="4.8" height="1.4" rx=".7" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'frontWave':
      return (
        <>
          <circle cx="12" cy="12" r="7.2" fill="currentColor" />
          <path d="M6 12c1.5-2 3-2.5 4.5-1.5 1.5 1 3 .5 4.5-1.5M6 15c1.5-2 3-2.5 4.5-1.5 1.5 1 3 .5 4.5-1.5" fill="none" stroke="#f4ead6" strokeWidth="1.6" strokeLinecap="round" opacity="0.88" />
        </>
      );
    case 'frontPatriarchy':
      return (
        <>
          <path d="M12 4.2c-4.4 0-8 3.6-8 8v1.6c0 1.8 1.4 3.2 3.2 3.2h9.6c1.8 0 3.2-1.4 3.2-3.2v-1.6c0-4.4-3.6-8-8-8Z" fill="currentColor" />
          <path d="M11 8.5h2v6h-2z" fill="#f4ead6" opacity="0.8" />
          <circle cx="12" cy="16.5" r="1.4" fill="#f4ead6" opacity="0.9" />
        </>
      );
    case 'frontJustice':
      return (
        <>
          <rect x="11" y="4.2" width="2" height="15.6" fill="currentColor" />
          <path d="M5.8 11.2h12.4l-1.8-3.2c-1.4 0-2.3.8-3.5.8h-1.8c-1.2 0-2.1-.8-3.5-.8l-1.8 3.2Z" fill="currentColor" opacity="0.92" />
          <path d="M7.6 12.8a4.4 4.4 0 0 0 8.8 0" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </>
      );
    case 'ledger':
      return (
        <>
          <rect x="7.2" y="4.8" width="10.4" height="14.4" rx="1.8" fill="currentColor" />
          <path d="M6 7.6h2.1v9.8h8.2v1.8H6a1 1 0 0 1-1-1V8.6c0-.6.4-1 1-1Z" fill="currentColor" opacity="0.92" />
          <rect x="9.4" y="9.7" width="5.4" height="1.4" rx=".7" fill="#f4ead6" opacity="0.92" />
          <rect x="9.4" y="12.8" width="5.4" height="1.4" rx=".7" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'seat':
      return (
        <>
          <circle cx="12" cy="8.3" r="2.7" fill="currentColor" />
          <path d="M6.5 18.8c.6-3.3 2.8-5.3 5.5-5.3s4.9 2 5.5 5.3H6.5Z" fill="currentColor" />
        </>
      );
    case 'home':
      return (
        <>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" fill="currentColor" />
          <path d="M9 22V12h6v10" fill="#f4ead6" opacity="0.8" />
        </>
      );
    case 'save':
      return (
        <>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2Z" fill="currentColor" />
          <rect x="7" y="3" width="8" height="5" rx="1" fill="#f4ead6" opacity="0.8" />
          <rect x="7" y="12" width="10" height="9" rx="1" fill="#f4ead6" opacity="0.7" />
        </>
      );
    case 'language':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="currentColor" />
          <path d="M12 3v18M3 12h18M5 12a14 14 0 0 1 14 0M5 12a14 14 0 0 0 14 0" fill="none" stroke="#f4ead6" strokeWidth="1.2" opacity="0.8" />
        </>
      );
    case 'goViral':
      return (
        <>
          <circle cx="8.5" cy="12" r="2.2" fill="currentColor" />
          <circle cx="15.7" cy="8" r="1.9" fill="currentColor" opacity="0.92" />
          <circle cx="16.6" cy="16.2" r="1.9" fill="currentColor" opacity="0.92" />
          <path d="M10.5 11.2 13.8 9M10.7 12.8l4.1 2.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18.8 5.7c1 .6 1.8 1.5 2.3 2.5m-1.8 8c1-.6 1.8-1.5 2.3-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.86" />
        </>
      );
    case 'exposeLies':
      return (
        <>
          <path d="M4.1 6.2h11.6l4.2 4.3v7.4a2 2 0 0 1-2 2H6.1a2 2 0 0 1-2-2V6.2Z" fill="currentColor" />
          <path d="M15.7 6.2v4.2h4.2" fill="#f4ead6" opacity="0.75" />
          <path d="m8.1 15.8 2.1-2.3 1.8 1.7 3.8-4.3" fill="none" stroke="#f4ead6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
          <path d="M8.2 10.2h7.1" stroke="#f4ead6" strokeWidth="1.4" strokeLinecap="round" opacity="0.82" />
        </>
      );
    case 'laborStrike':
      return (
        <>
          <rect x="4.8" y="16.8" width="14.8" height="1.8" rx=".9" fill="currentColor" />
          <path d="M7.3 15.4V7.2h1.9v8.2H7.3Zm2.8-6.9h8.4a1.5 1.5 0 0 1 1.5 1.5v4.3H10.1V8.5Z" fill="currentColor" opacity="0.94" />
          <path d="M11.5 10.5h6.1M11.5 12.5h4.1" stroke="#f4ead6" strokeWidth="1.3" strokeLinecap="round" opacity="0.86" />
        </>
      );
    case 'coordinateDigital':
      return (
        <>
          <rect x="4.4" y="5" width="6.4" height="5.2" rx="1.2" fill="currentColor" />
          <rect x="13.2" y="5" width="6.4" height="5.2" rx="1.2" fill="currentColor" opacity="0.92" />
          <rect x="8.8" y="14" width="6.4" height="5.2" rx="1.2" fill="currentColor" opacity="0.96" />
          <path d="M10.7 10.1 12 14m1.3-3.9L12 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="7.6" cy="7.6" r=".8" fill="#f4ead6" opacity="0.92" />
          <circle cx="16.4" cy="7.6" r=".8" fill="#f4ead6" opacity="0.92" />
          <circle cx="12" cy="16.6" r=".8" fill="#f4ead6" opacity="0.92" />
        </>
      );
    case 'burnVeil':
      return (
        <>
          <path d="M12.8 3.9c1.7 2.1 2.6 3.9 2.6 5.5 0 1.2-.4 2.3-1.2 3.1 2.1.4 3.7 2.3 3.7 4.6 0 2.7-2.2 4.9-4.9 4.9h-2c-2.7 0-4.9-2.2-4.9-4.9 0-2.1 1.3-3.9 3.2-4.5-.5-.7-.8-1.6-.8-2.6 0-1.8 1.1-3.8 3.3-6.1Z" fill="currentColor" />
          <path d="M12.1 9.1c1.1 1.3 1.6 2.4 1.6 3.4 0 1.3-.8 2.1-2 3 1.8.1 3.1 1.2 3.1 2.8 0 1.2-.9 2.2-2.2 2.2h-1.2c-1.4 0-2.5-1-2.5-2.2 0-1.1.8-2 2-2.6-1-.8-1.5-1.7-1.5-2.8 0-1.2.9-2.5 2.7-3.8Z" fill="#f4ead6" opacity="0.84" />
        </>
      );
    case 'schoolgirlNetwork':
      return (
        <>
          <circle cx="8.4" cy="8.2" r="2.2" fill="currentColor" />
          <circle cx="15.8" cy="9" r="2.1" fill="currentColor" opacity="0.94" />
          <path d="M5.7 18.5c.4-2.5 2.1-4.3 4.1-4.3 1.8 0 3.3 1.2 3.9 3.2.7-1.7 2.1-2.8 3.8-2.8 1.5 0 2.9.9 3.7 3.9H5.7Z" fill="currentColor" />
          <path d="M10.4 11.1h3.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.86" />
        </>
      );
    case 'composeChant':
      return (
        <>
          <path d="M5.3 6.1h9.5a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H8.7l-3.4 2.3V8.1a2 2 0 0 1 2-2Z" fill="currentColor" />
          <path d="M9.4 9.7v5.4m2.4-6.6v5.4m2.4-4.2v5.4" stroke="#f4ead6" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <path d="M18.2 9.5c.8.3 1.6 1 2 1.9m-2 2.4c.8-.3 1.6-1 2-1.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.88" />
        </>
      );
    case 'fundraise':
      return (
        <>
          <ellipse cx="10" cy="7.5" rx="4.8" ry="2.3" fill="currentColor" />
          <path d="M5.2 7.7v5.3c0 1.7 2.1 3 4.8 3s4.8-1.3 4.8-3V7.7c0 1.7-2.1 3-4.8 3s-4.8-1.3-4.8-3Z" fill="currentColor" opacity="0.94" />
          <circle cx="16.8" cy="15.8" r="3.1" fill="currentColor" opacity="0.92" />
          <path d="M16.8 14v3.6M15 15.8h3.6" stroke="#f4ead6" strokeWidth="1.4" strokeLinecap="round" opacity="0.92" />
        </>
      );
    case 'mediaBlitz':
      return (
        <>
          <rect x="4.2" y="8.2" width="7.9" height="7.6" rx="1.6" fill="currentColor" />
          <path d="M12.1 10.3 17.7 7v10l-5.6-3.3v-3.4Z" fill="currentColor" opacity="0.95" />
          <path d="M18.8 9.2c1 .7 1.8 1.7 2.2 2.8m-2.2 2.6c1-.7 1.8-1.7 2.2-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.88" />
        </>
      );
    case 'sanctions':
      return (
        <>
          <rect x="4.6" y="6.8" width="10.5" height="8.3" rx="1.5" fill="currentColor" />
          <path d="M9.8 15.1v2.5c0 1 .8 1.8 1.8 1.8H17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17.5" cy="17.9" r="3.1" fill="currentColor" opacity="0.94" />
          <path d="m16.1 16.5 2.8 2.8m0-2.8-2.8 2.8" stroke="#f4ead6" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
  }
}

function renderBaseShape(baseShape: IconBaseShape) {
  const common = {
    fill: 'currentColor',
    opacity: 0.14,
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
