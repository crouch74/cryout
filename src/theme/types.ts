export type UiSkinId =
  | 'documentary-ink'
  | 'nocturnal-dossier'
  | 'civic-signal'
  | 'olive-tree'
  | 'guerrilla-camouflage'
  | 'papyrus-insurgency';

export type ThemeContrastMode = 'default' | 'high';

export type ScenarioOverlayId =
  | 'burnt-earth-resistance'
  | 'rainforest-sovereignty'
  | 'dossier-of-the-disappeared'
  | 'desert-horizon'
  | 'night-map-escalation'
  | 'papyrus-insurgency';

export type ThemeId = UiSkinId | ScenarioOverlayId;

export interface UiSkinLayerTokens {
  canvas: string;
  surface: string;
  elevated: string;
  overlay: string;
  scrim: string;
}

export interface UiSkinTextTokens {
  primary: string;
  muted: string;
  inverse: string;
}

export interface UiSkinBorderTokens {
  subtle: string;
  strong: string;
  danger: string;
}

export interface UiSkinFocusTokens {
  ring: string;
}

export interface UiSkinActionTokens {
  primary: string;
  secondary: string;
  utility: string;
}

export interface UiSkinStateTokens {
  success: string;
  warning: string;
  danger: string;
  info: string;
  neutral: string;
}

export interface UiSkinMapTokens {
  safe: string;
  strained: string;
  critical: string;
}

export interface UiSkinDomainTokens {
  warMachine: string;
  climate: string;
  fossil: string;
  justice: string;
  voice: string;
  hunger: string;
  patriarchy: string;
  revolution: string;
}

export interface UiSkinEffectTokens {
  heroTone: string;
  backgroundWash: string;
  selectionHighlight: string;
  tokenGlow: string;
  surfaceTint: string;
}

export interface UiSkinBorderWidthTokens {
  hairline: string;
  thin: string;
  regular: string;
  strong: string;
}

export interface UiSkinSizeTokens {
  iconXs: string;
  iconSm: string;
  iconMd: string;
  iconLg: string;
  chipHeight: string;
  controlHeight: string;
  drawerWidthNarrow: string;
  drawerWidth: string;
  drawerWidthWide: string;
  cardWidth: string;
}

export interface UiSkinMotionTokens {
  instant: string;
  quick: string;
  fast: string;
  normal: string;
  slow: string;
  deliberate: string;
  reveal: string;
  pulse: string;
}

export interface UiSkinOpacityTokens {
  faint: string;
  soft: string;
  medium: string;
  strong: string;
  intense: string;
}

export interface UiSkinShadowTokens {
  raised: string;
  floating: string;
  glow: string;
}

export interface UiSkinStyleTokens {
  borderWidth: UiSkinBorderWidthTokens;
  size: UiSkinSizeTokens;
  motion: UiSkinMotionTokens;
  opacity: UiSkinOpacityTokens;
  shadow: UiSkinShadowTokens;
}

export interface UiSkinDefinition {
  id: UiSkinId;
  label: string;
  layer: UiSkinLayerTokens;
  text: UiSkinTextTokens;
  border: UiSkinBorderTokens;
  focus: UiSkinFocusTokens;
  action: UiSkinActionTokens;
  state: UiSkinStateTokens;
  map: UiSkinMapTokens;
  domain: UiSkinDomainTokens;
  effects: UiSkinEffectTokens;
  style: UiSkinStyleTokens;
}

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
  skinId: UiSkinId;
  skinLabel: string;
  contrastMode: ThemeContrastMode;
  overlayId: ScenarioOverlayId | null;
  skin: UiSkinDefinition;
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
