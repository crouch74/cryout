import type { ScenarioOverlayId, ThemeDefinition, ThemeOverlayDefinition } from './types.ts';

export const BASE_THEME: ThemeDefinition = {
  id: 'revolutionary-ink-paper',
  label: 'Revolutionary Ink & Paper',
  colors: {
    background: '#e7dcc6',
    surface: '#f0e6d4',
    surfaceElevated: '#f8efdf',
    focusSurface: '#1f2734',
    border: 'rgba(62, 46, 30, 0.28)',
    textPrimary: '#20170f',
    textMuted: '#5e5142',
    accent: '#9d2f2a',
    accentStrong: '#7f221f',
    danger: '#8d2623',
    success: '#355b45',
    heroTone: 'radial-gradient(120% 90% at 12% 8%, rgba(157, 47, 42, 0.22), transparent 58%), linear-gradient(140deg, rgba(32, 23, 15, 0.88), rgba(26, 34, 48, 0.82))',
    backgroundWash: 'rgba(24, 18, 12, 0.22)',
    selectionHighlight: 'rgba(157, 47, 42, 0.32)',
    tokenGlow: 'rgba(157, 47, 42, 0.34)',
    surfaceTint: 'rgba(157, 47, 42, 0.05)',
  },
  shadows: {
    level1: '0 10px 24px rgba(49, 33, 18, 0.18)',
    level2: '0 18px 42px rgba(49, 33, 18, 0.24)',
    focus: '0 0 0 3px rgba(157, 47, 42, 0.36)',
  },
  radius: {
    sm: '10px',
    md: '16px',
    lg: '24px',
  },
  spacing: {
    xs: '8px',
    sm: '16px',
    md: '24px',
    lg: '32px',
    xl: '40px',
    xxl: '48px',
  },
  typography: {
    display: "'Space Grotesk', sans-serif",
    body: "'Manrope', sans-serif",
    narrative: "'Crimson Pro', Georgia, serif",
    data: "'JetBrains Mono', 'Courier New', monospace",
    scale0: '0.75rem',
    scale1: '0.875rem',
    scale2: '1rem',
    scale3: '1.25rem',
    scale4: '1.75rem',
    scale5: 'clamp(2rem, 4vw, 3rem)',
    lineHeightTight: '1.1',
    lineHeightCopy: '1.6',
  },
  motion: {
    durationFast: '160ms',
    durationMed: '220ms',
    durationSlow: '320ms',
    easingStandard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easingEntrance: 'cubic-bezier(0.18, 0.85, 0.24, 1)',
  },
};

export const SCENARIO_THEME_OVERLAYS: Record<ScenarioOverlayId, ThemeOverlayDefinition> = {
  'burnt-earth-resistance': {
    id: 'burnt-earth-resistance',
    label: 'Burnt Earth Resistance',
    overrides: {
      colors: {
        accent: '#ba4d2f',
        accentStrong: '#913724',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(186, 77, 47, 0.26), transparent 56%), linear-gradient(140deg, rgba(36, 23, 14, 0.9), rgba(45, 30, 18, 0.82))',
        backgroundWash: 'rgba(58, 31, 18, 0.24)',
        selectionHighlight: 'rgba(186, 77, 47, 0.34)',
        tokenGlow: 'rgba(186, 77, 47, 0.36)',
        surfaceTint: 'rgba(120, 62, 41, 0.08)',
      },
    },
  },
  'rainforest-sovereignty': {
    id: 'rainforest-sovereignty',
    label: 'Rainforest Sovereignty',
    overrides: {
      colors: {
        accent: '#2f704a',
        accentStrong: '#1f5335',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(47, 112, 74, 0.28), transparent 58%), linear-gradient(140deg, rgba(18, 35, 28, 0.9), rgba(28, 45, 40, 0.84))',
        backgroundWash: 'rgba(22, 48, 34, 0.22)',
        selectionHighlight: 'rgba(47, 112, 74, 0.32)',
        tokenGlow: 'rgba(47, 112, 74, 0.36)',
        surfaceTint: 'rgba(47, 112, 74, 0.08)',
      },
    },
  },
  'dossier-of-the-disappeared': {
    id: 'dossier-of-the-disappeared',
    label: 'Dossier of the Disappeared',
    overrides: {
      colors: {
        accent: '#7f3231',
        accentStrong: '#5d2423',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(127, 50, 49, 0.26), transparent 58%), linear-gradient(140deg, rgba(22, 24, 28, 0.92), rgba(38, 42, 35, 0.82))',
        backgroundWash: 'rgba(25, 27, 32, 0.24)',
        selectionHighlight: 'rgba(127, 50, 49, 0.34)',
        tokenGlow: 'rgba(127, 50, 49, 0.35)',
        surfaceTint: 'rgba(66, 72, 55, 0.08)',
      },
    },
  },
  'desert-horizon': {
    id: 'desert-horizon',
    label: 'Desert Horizon',
    overrides: {
      colors: {
        accent: '#b46b3d',
        accentStrong: '#8f502a',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(180, 107, 61, 0.3), transparent 60%), linear-gradient(140deg, rgba(48, 35, 23, 0.88), rgba(37, 47, 60, 0.8))',
        backgroundWash: 'rgba(72, 48, 31, 0.22)',
        selectionHighlight: 'rgba(180, 107, 61, 0.34)',
        tokenGlow: 'rgba(180, 107, 61, 0.36)',
        surfaceTint: 'rgba(180, 107, 61, 0.08)',
      },
    },
  },
  'night-map-escalation': {
    id: 'night-map-escalation',
    label: 'Night Map Escalation',
    overrides: {
      colors: {
        accent: '#d09138',
        accentStrong: '#a96d21',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(208, 145, 56, 0.22), transparent 58%), linear-gradient(140deg, rgba(16, 25, 44, 0.92), rgba(20, 31, 54, 0.85))',
        backgroundWash: 'rgba(14, 27, 48, 0.25)',
        selectionHighlight: 'rgba(208, 145, 56, 0.34)',
        tokenGlow: 'rgba(208, 145, 56, 0.36)',
        surfaceTint: 'rgba(27, 46, 74, 0.1)',
      },
    },
  },
};
