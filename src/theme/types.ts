export type BaseThemeId = 'revolutionary-ink-paper';

export type ScenarioOverlayId =
  | 'burnt-earth-resistance'
  | 'rainforest-sovereignty'
  | 'dossier-of-the-disappeared'
  | 'desert-horizon'
  | 'night-map-escalation';

export type ThemeId = BaseThemeId | ScenarioOverlayId;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  focusSurface: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  danger: string;
  success: string;
  heroTone: string;
  backgroundWash: string;
  selectionHighlight: string;
  tokenGlow: string;
  surfaceTint: string;
}

export interface ThemeShadows {
  level1: string;
  level2: string;
  focus: string;
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  display: string;
  body: string;
  narrative: string;
  data: string;
  scale0: string;
  scale1: string;
  scale2: string;
  scale3: string;
  scale4: string;
  scale5: string;
  lineHeightTight: string;
  lineHeightCopy: string;
}

export interface ThemeMotion {
  durationFast: string;
  durationMed: string;
  durationSlow: string;
  easingStandard: string;
  easingEmphasized: string;
  easingEntrance: string;
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
}

export interface ThemeOverlayDefinition {
  id: ScenarioOverlayId;
  label: string;
  overrides: DeepPartial<Omit<ThemeDefinition, 'id' | 'label'>>;
}

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer Item>
    ? Array<DeepPartial<Item>>
    : {
        [K in keyof T]?: DeepPartial<T[K]>;
      };
