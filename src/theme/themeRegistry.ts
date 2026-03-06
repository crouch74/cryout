import { uiTokens } from '../ui/tokens/index.ts';
import type {
  ScenarioOverlayId,
  ThemeColors,
  ThemeDefinition,
  ThemeOverlayDefinition,
  UiSkinDefinition,
  UiSkinId,
  UiSkinStyleTokens,
} from './types.ts';

const { motion, radius, shadows, spacing, typography, zIndex, layout } = uiTokens;

const BASE_STYLE_TOKENS: UiSkinStyleTokens = {
  borderWidth: {
    hairline: '0.8px',
    thin: '1px',
    regular: '1.5px',
    strong: '2px',
  },
  size: {
    iconXs: '14px',
    iconSm: '16px',
    iconMd: '18px',
    iconLg: '20px',
    chipHeight: '24px',
    controlHeight: '34px',
    drawerWidthNarrow: '320px',
    drawerWidth: '360px',
    drawerWidthWide: '460px',
    cardWidth: '320px',
  },
  motion: {
    instant: '80ms',
    quick: '140ms',
    fast: '180ms',
    normal: '260ms',
    slow: '360ms',
    deliberate: '500ms',
    reveal: '760ms',
    pulse: '2400ms',
  },
  opacity: {
    faint: '0.08',
    soft: '0.16',
    medium: '0.28',
    strong: '0.44',
    intense: '0.62',
  },
  shadow: {
    raised: '0 8px 18px rgba(0, 0, 0, 0.2)',
    floating: '0 14px 30px rgba(0, 0, 0, 0.28)',
    glow: '0 0 18px rgba(0, 0, 0, 0.24)',
  },
};

const SKIN_STYLE_TOKENS: Record<UiSkinId, UiSkinStyleTokens> = {
  'documentary-ink': BASE_STYLE_TOKENS,
  'nocturnal-dossier': {
    ...BASE_STYLE_TOKENS,
    borderWidth: { hairline: '1px', thin: '1px', regular: '1.5px', strong: '2px' },
    motion: { ...BASE_STYLE_TOKENS.motion, quick: '120ms', fast: '160ms', normal: '240ms', reveal: '720ms' },
    opacity: { faint: '0.1', soft: '0.2', medium: '0.34', strong: '0.52', intense: '0.72' },
    shadow: {
      raised: '0 10px 22px rgba(3, 7, 12, 0.34)',
      floating: '0 18px 34px rgba(2, 5, 10, 0.44)',
      glow: '0 0 22px rgba(215, 154, 71, 0.22)',
    },
  },
  'civic-signal': {
    ...BASE_STYLE_TOKENS,
    borderWidth: { hairline: '0.8px', thin: '1px', regular: '1.5px', strong: '2px' },
    motion: { ...BASE_STYLE_TOKENS.motion, quick: '130ms', fast: '170ms', normal: '240ms' },
    opacity: { faint: '0.06', soft: '0.12', medium: '0.22', strong: '0.36', intense: '0.52' },
    shadow: {
      raised: '0 7px 16px rgba(20, 54, 62, 0.16)',
      floating: '0 12px 26px rgba(18, 47, 54, 0.22)',
      glow: '0 0 18px rgba(30, 95, 114, 0.2)',
    },
  },
  'olive-tree': {
    ...BASE_STYLE_TOKENS,
    borderWidth: { hairline: '0.8px', thin: '1px', regular: '1.5px', strong: '2px' },
    motion: { ...BASE_STYLE_TOKENS.motion, normal: '280ms', slow: '380ms' },
    opacity: { faint: '0.07', soft: '0.14', medium: '0.24', strong: '0.38', intense: '0.56' },
    shadow: {
      raised: '0 8px 18px rgba(42, 52, 30, 0.22)',
      floating: '0 14px 30px rgba(36, 44, 26, 0.3)',
      glow: '0 0 20px rgba(164, 115, 47, 0.24)',
    },
  },
  'guerrilla-camouflage': {
    ...BASE_STYLE_TOKENS,
    borderWidth: { hairline: '1px', thin: '1px', regular: '1.5px', strong: '2px' },
    motion: { ...BASE_STYLE_TOKENS.motion, quick: '120ms', fast: '160ms', normal: '230ms', reveal: '700ms' },
    opacity: { faint: '0.11', soft: '0.2', medium: '0.34', strong: '0.5', intense: '0.72' },
    shadow: {
      raised: '0 10px 20px rgba(7, 12, 8, 0.34)',
      floating: '0 18px 34px rgba(6, 10, 7, 0.44)',
      glow: '0 0 20px rgba(180, 136, 60, 0.24)',
    },
  },
};

export const DEFAULT_UI_SKIN_ID: UiSkinId = 'documentary-ink';

export const UI_SKINS: Record<UiSkinId, UiSkinDefinition> = {
  'documentary-ink': {
    id: 'documentary-ink',
    label: 'Documentary Ink',
    layer: {
      canvas: '#E9E2D6',
      surface: '#F3ECE1',
      elevated: '#FFFFFF',
      overlay: '#F6EFE6',
      scrim: 'rgba(25, 18, 12, 0.58)',
    },
    text: {
      primary: '#2E251C',
      muted: '#5C5042',
      inverse: '#F3ECE1',
    },
    border: {
      subtle: '#D8CFC3',
      strong: '#B9AA96',
      danger: '#A03B2E',
    },
    focus: {
      ring: '0 0 0 3px rgba(160, 59, 46, 0.35)',
    },
    action: {
      primary: '#3A271B',
      secondary: '#B46A3D',
      utility: '#E5DACC',
    },
    state: {
      success: '#3E6B48',
      warning: '#C07A2C',
      danger: '#A03B2E',
      info: '#2F5D73',
      neutral: '#6A5D4F',
    },
    map: {
      safe: '#3E6B48',
      strained: '#B88437',
      critical: '#A03B2E',
    },
    domain: {
      warMachine: '#6B3A3A',
      climate: '#3E6B48',
      fossil: '#4C3A2F',
      justice: '#6A5D4F',
      voice: '#2F5D73',
      hunger: '#7A5A2A',
      patriarchy: '#6B3F5A',
      revolution: '#A03B2E',
    },
    effects: {
      heroTone: 'radial-gradient(120% 90% at 12% 8%, rgba(160, 59, 46, 0.2), transparent 58%), linear-gradient(140deg, rgba(46, 37, 28, 0.88), rgba(92, 80, 66, 0.76))',
      backgroundWash: 'rgba(46, 37, 28, 0.2)',
      selectionHighlight: 'rgba(160, 59, 46, 0.28)',
      tokenGlow: 'rgba(160, 59, 46, 0.28)',
      surfaceTint: 'rgba(160, 59, 46, 0.06)',
    },
    style: SKIN_STYLE_TOKENS['documentary-ink'],
  },
  'nocturnal-dossier': {
    id: 'nocturnal-dossier',
    label: 'Nocturnal Dossier',
    layer: {
      canvas: '#0F1722',
      surface: '#1A2534',
      elevated: '#243246',
      overlay: '#192332',
      scrim: 'rgba(4, 8, 14, 0.74)',
    },
    text: {
      primary: '#E8EEF8',
      muted: '#B9C7DA',
      inverse: '#101A27',
    },
    border: {
      subtle: '#3C4D66',
      strong: '#5A7290',
      danger: '#C97258',
    },
    focus: {
      ring: '0 0 0 3px rgba(216, 158, 80, 0.38)',
    },
    action: {
      primary: '#D79A47',
      secondary: '#7FA0CC',
      utility: '#31455E',
    },
    state: {
      success: '#56A37A',
      warning: '#D7A34D',
      danger: '#D17660',
      info: '#7FA8D8',
      neutral: '#9CAFC6',
    },
    map: {
      safe: '#5AAE84',
      strained: '#D6A85B',
      critical: '#D27A64',
    },
    domain: {
      warMachine: '#C97258',
      climate: '#56A37A',
      fossil: '#6F84A2',
      justice: '#C8A466',
      voice: '#7FA8D8',
      hunger: '#D59A53',
      patriarchy: '#A884B8',
      revolution: '#D79A47',
    },
    effects: {
      heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(215, 154, 71, 0.22), transparent 58%), linear-gradient(140deg, rgba(12, 20, 34, 0.92), rgba(26, 37, 53, 0.84))',
      backgroundWash: 'rgba(7, 16, 28, 0.3)',
      selectionHighlight: 'rgba(127, 160, 204, 0.34)',
      tokenGlow: 'rgba(215, 154, 71, 0.28)',
      surfaceTint: 'rgba(121, 150, 187, 0.14)',
    },
    style: SKIN_STYLE_TOKENS['nocturnal-dossier'],
  },
  'civic-signal': {
    id: 'civic-signal',
    label: 'Civic Signal',
    layer: {
      canvas: '#EAF0EE',
      surface: '#F4F8F6',
      elevated: '#FFFFFF',
      overlay: '#E7F0EE',
      scrim: 'rgba(16, 33, 38, 0.5)',
    },
    text: {
      primary: '#163039',
      muted: '#45626C',
      inverse: '#F3FAF8',
    },
    border: {
      subtle: '#C6D7D8',
      strong: '#8FA9AE',
      danger: '#B24A3B',
    },
    focus: {
      ring: '0 0 0 3px rgba(41, 119, 134, 0.34)',
    },
    action: {
      primary: '#1E5F72',
      secondary: '#D18E3D',
      utility: '#DDE8E8',
    },
    state: {
      success: '#2D7E5E',
      warning: '#CC8D34',
      danger: '#B24A3B',
      info: '#2F6E90',
      neutral: '#5A727A',
    },
    map: {
      safe: '#3C8A66',
      strained: '#CF9540',
      critical: '#BE5345',
    },
    domain: {
      warMachine: '#B24A3B',
      climate: '#2D7E5E',
      fossil: '#3B5D68',
      justice: '#B0843F',
      voice: '#2F6E90',
      hunger: '#CF9540',
      patriarchy: '#8D5F8E',
      revolution: '#D18E3D',
    },
    effects: {
      heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(30, 95, 114, 0.2), transparent 58%), linear-gradient(140deg, rgba(20, 57, 66, 0.88), rgba(47, 89, 99, 0.78))',
      backgroundWash: 'rgba(24, 69, 80, 0.18)',
      selectionHighlight: 'rgba(30, 95, 114, 0.24)',
      tokenGlow: 'rgba(209, 142, 61, 0.26)',
      surfaceTint: 'rgba(47, 110, 144, 0.08)',
    },
    style: SKIN_STYLE_TOKENS['civic-signal'],
  },
  'olive-tree': {
    id: 'olive-tree',
    label: 'Olive Tree',
    layer: {
      canvas: '#E2DDC5',
      surface: '#EFE8CC',
      elevated: '#F8F2DE',
      overlay: '#DCD4B6',
      scrim: 'rgba(20, 24, 14, 0.6)',
    },
    text: {
      primary: '#2B311F',
      muted: '#4E5B40',
      inverse: '#F6F2E6',
    },
    border: {
      subtle: '#C8C0A2',
      strong: '#8E936A',
      danger: '#8A2E2A',
    },
    focus: {
      ring: '0 0 0 3px rgba(94, 123, 58, 0.34)',
    },
    action: {
      primary: '#425A2D',
      secondary: '#A4732F',
      utility: '#D6D0B2',
    },
    state: {
      success: '#476639',
      warning: '#B07A2C',
      danger: '#9E302E',
      info: '#3F6658',
      neutral: '#65694D',
    },
    map: {
      safe: '#476639',
      strained: '#B07A2C',
      critical: '#9E302E',
    },
    domain: {
      warMachine: '#8F4639',
      climate: '#4E6C3E',
      fossil: '#5C513E',
      justice: '#7F7349',
      voice: '#4D6E5C',
      hunger: '#AB7C33',
      patriarchy: '#7A5A6E',
      revolution: '#7E332E',
    },
    effects: {
      heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(122, 146, 74, 0.26), transparent 58%), linear-gradient(140deg, rgba(46, 58, 33, 0.88), rgba(98, 104, 70, 0.78))',
      backgroundWash: 'rgba(58, 78, 40, 0.22)',
      selectionHighlight: 'rgba(94, 120, 56, 0.3)',
      tokenGlow: 'rgba(176, 124, 44, 0.3)',
      surfaceTint: 'rgba(84, 112, 58, 0.1)',
    },
    style: SKIN_STYLE_TOKENS['olive-tree'],
  },
  'guerrilla-camouflage': {
    id: 'guerrilla-camouflage',
    label: 'Guerrilla Camouflage',
    layer: {
      canvas: '#151C15',
      surface: '#1F2A1F',
      elevated: '#2A3527',
      overlay: '#1A251B',
      scrim: 'rgba(4, 8, 4, 0.8)',
    },
    text: {
      primary: '#E2E8D4',
      muted: '#AEB99A',
      inverse: '#10140F',
    },
    border: {
      subtle: '#41543F',
      strong: '#63775E',
      danger: '#B34B3F',
    },
    focus: {
      ring: '0 0 0 3px rgba(176, 137, 72, 0.34)',
    },
    action: {
      primary: '#6B7A3D',
      secondary: '#B4873C',
      utility: '#324334',
    },
    state: {
      success: '#739858',
      warning: '#C58E34',
      danger: '#C75245',
      info: '#879C74',
      neutral: '#93A084',
    },
    map: {
      safe: '#739858',
      strained: '#C58E34',
      critical: '#C75245',
    },
    domain: {
      warMachine: '#B55D47',
      climate: '#6F9155',
      fossil: '#7A6A4C',
      justice: '#AA8E55',
      voice: '#839273',
      hunger: '#B4863E',
      patriarchy: '#8A6F87',
      revolution: '#C57639',
    },
    effects: {
      heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(107, 126, 61, 0.3), transparent 58%), linear-gradient(140deg, rgba(12, 18, 12, 0.92), rgba(34, 48, 30, 0.84))',
      backgroundWash: 'rgba(17, 26, 17, 0.34)',
      selectionHighlight: 'rgba(180, 136, 60, 0.32)',
      tokenGlow: 'rgba(197, 142, 52, 0.3)',
      surfaceTint: 'rgba(111, 151, 82, 0.12)',
    },
    style: SKIN_STYLE_TOKENS['guerrilla-camouflage'],
  },
};

export function getUiSkinDefinition(skinId: UiSkinId): UiSkinDefinition {
  return UI_SKINS[skinId];
}

export function mapSkinToThemeColors(skin: UiSkinDefinition): ThemeColors {
  return {
    backgroundPrimary: skin.layer.canvas,
    backgroundSecondary: skin.layer.surface,
    backgroundPanel: skin.layer.overlay,
    backgroundElevated: skin.layer.elevated,
    textPrimary: skin.text.primary,
    textSecondary: skin.text.muted,
    textMuted: `color-mix(in srgb, ${skin.text.muted} 84%, ${skin.layer.elevated} 16%)`,
    textInverted: skin.text.inverse,
    borderSubtle: skin.border.subtle,
    borderStrong: skin.border.strong,
    borderDanger: skin.border.danger,
    stateMovement: skin.state.success,
    stateDanger: skin.state.danger,
    stateWarning: skin.state.warning,
    stateNeutral: skin.state.neutral,
    stateInfo: skin.state.info,
    domainWarMachine: skin.domain.warMachine,
    domainClimate: skin.domain.climate,
    domainFossil: skin.domain.fossil,
    domainJustice: skin.domain.justice,
    domainVoice: skin.domain.voice,
    domainHunger: skin.domain.hunger,
    domainPatriarchy: skin.domain.patriarchy,
    domainRevolution: skin.domain.revolution,
    heroTone: skin.effects.heroTone,
    backgroundWash: skin.effects.backgroundWash,
    selectionHighlight: skin.effects.selectionHighlight,
    tokenGlow: skin.effects.tokenGlow,
    surfaceTint: skin.effects.surfaceTint,
  };
}

const defaultSkin = UI_SKINS[DEFAULT_UI_SKIN_ID];

export const BASE_THEME: ThemeDefinition = {
  id: defaultSkin.id,
  label: defaultSkin.label,
  skinId: defaultSkin.id,
  skinLabel: defaultSkin.label,
  contrastMode: 'default',
  overlayId: null,
  skin: defaultSkin,
  colors: mapSkinToThemeColors(defaultSkin),
  shadows: {
    subtle: shadows.subtle,
    medium: shadows.medium,
    strong: shadows.strong,
    focus: defaultSkin.focus.ring,
  },
  radius: {
    sm: radius.sm,
    md: radius.md,
    lg: radius.lg,
  },
  spacing: {
    xxs: spacing.xxs,
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    xxl: spacing.xxl,
  },
  typography: {
    headline: typography.fontFamily.headline,
    body: typography.fontFamily.body,
    mono: typography.fontFamily.mono,
    sizeXs: typography.fontSize.xs,
    sizeSm: typography.fontSize.sm,
    sizeMd: typography.fontSize.md,
    sizeLg: typography.fontSize.lg,
    sizeXl: typography.fontSize.xl,
    sizeXxl: typography.fontSize.xxl,
    sizeHero: typography.fontSize.hero,
    weightRegular: String(typography.fontWeight.regular),
    weightMedium: String(typography.fontWeight.medium),
    weightBold: String(typography.fontWeight.bold),
    lineHeightTight: String(typography.lineHeight.tight),
    lineHeightNormal: String(typography.lineHeight.normal),
    lineHeightRelaxed: String(typography.lineHeight.relaxed),
  },
  motion: {
    fast: motion.fast,
    normal: motion.normal,
    slow: motion.slow,
    easing: motion.easing,
  },
  zIndex: {
    base: zIndex.base,
    panel: zIndex.panel,
    dropdown: zIndex.dropdown,
    modal: zIndex.modal,
    overlay: zIndex.overlay,
    toast: zIndex.toast,
  },
  layout: {
    iconXs: layout.icon.xs,
    iconSm: layout.icon.sm,
    iconMd: layout.icon.md,
    iconLg: layout.icon.lg,
    buttonPaddingY: layout.button.paddingY,
    buttonPaddingX: layout.button.paddingX,
    panelPadding: layout.panel.padding,
  },
};

export const SCENARIO_THEME_OVERLAYS: Record<ScenarioOverlayId, ThemeOverlayDefinition> = {
  'burnt-earth-resistance': {
    id: 'burnt-earth-resistance',
    label: 'Burnt Earth Resistance',
    overrides: {
      colors: {
        stateDanger: '#B46A3D',
        domainRevolution: '#B46A3D',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(180, 106, 61, 0.24), transparent 56%), linear-gradient(140deg, rgba(54, 35, 23, 0.9), rgba(82, 58, 39, 0.8))',
        backgroundWash: 'rgba(72, 48, 31, 0.22)',
        selectionHighlight: 'rgba(180, 106, 61, 0.3)',
        tokenGlow: 'rgba(180, 106, 61, 0.3)',
        surfaceTint: 'rgba(180, 106, 61, 0.08)',
      },
    },
  },
  'rainforest-sovereignty': {
    id: 'rainforest-sovereignty',
    label: 'Rainforest Sovereignty',
    overrides: {
      colors: {
        stateMovement: '#2F704A',
        domainClimate: '#2F704A',
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
        stateDanger: '#7F3231',
        domainRevolution: '#7F3231',
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
        stateWarning: '#B46B3D',
        domainHunger: '#B46B3D',
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
        stateWarning: '#D09138',
        domainJustice: '#D09138',
        heroTone: 'radial-gradient(120% 90% at 14% 8%, rgba(208, 145, 56, 0.22), transparent 58%), linear-gradient(140deg, rgba(16, 25, 44, 0.92), rgba(20, 31, 54, 0.85))',
        backgroundWash: 'rgba(14, 27, 48, 0.25)',
        selectionHighlight: 'rgba(208, 145, 56, 0.34)',
        tokenGlow: 'rgba(208, 145, 56, 0.36)',
        surfaceTint: 'rgba(27, 46, 74, 0.1)',
      },
    },
  },
};
