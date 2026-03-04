export type BaseThemeId = 'revolutionary-ink-paper';

export type ScenarioOverlayId =
  | 'burnt-earth-resistance'
  | 'rainforest-sovereignty'
  | 'dossier-of-the-disappeared'
  | 'desert-horizon'
  | 'night-map-escalation';

export type ThemeId = BaseThemeId | ScenarioOverlayId;

export interface ThemeColors {
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundPanel: string;
  backgroundElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverted: string;
  borderSubtle: string;
  borderStrong: string;
  borderDanger: string;
  stateMovement: string;
  stateDanger: string;
  stateWarning: string;
  stateNeutral: string;
  stateInfo: string;
  domainWarMachine: string;
  domainClimate: string;
  domainFossil: string;
  domainJustice: string;
  domainVoice: string;
  domainHunger: string;
  domainPatriarchy: string;
  domainRevolution: string;
  heroTone: string;
  backgroundWash: string;
  selectionHighlight: string;
  tokenGlow: string;
  surfaceTint: string;
}

export interface ThemeShadows {
  subtle: string;
  medium: string;
  strong: string;
  focus: string;
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeSpacing {
  xxs: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  headline: string;
  body: string;
  mono: string;
  sizeXs: string;
  sizeSm: string;
  sizeMd: string;
  sizeLg: string;
  sizeXl: string;
  sizeXxl: string;
  sizeHero: string;
  weightRegular: string;
  weightMedium: string;
  weightBold: string;
  lineHeightTight: string;
  lineHeightNormal: string;
  lineHeightRelaxed: string;
}

export interface ThemeMotion {
  fast: string;
  normal: string;
  slow: string;
  easing: string;
}

export interface ThemeZIndex {
  base: number;
  panel: number;
  dropdown: number;
  modal: number;
  overlay: number;
  toast: number;
}

export interface ThemeLayout {
  iconXs: number;
  iconSm: number;
  iconMd: number;
  iconLg: number;
  buttonPaddingY: string;
  buttonPaddingX: string;
  panelPadding: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colors: ThemeColors;
  shadows: ThemeShadows;
  radius: ThemeRadius;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  motion: ThemeMotion;
  zIndex: ThemeZIndex;
  layout: ThemeLayout;
}

export interface ThemeOverlayDefinition {
  id: ScenarioOverlayId;
  label: string;
  overrides: {
    colors: DeepPartial<ThemeColors>;
  };
}

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer Item>
    ? Array<DeepPartial<Item>>
    : {
        [K in keyof T]?: DeepPartial<T[K]>;
      };
