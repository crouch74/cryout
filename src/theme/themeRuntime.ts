import {
  BASE_THEME,
  DEFAULT_UI_SKIN_ID,
  getUiSkinDefinition,
  mapSkinToThemeColors,
  SCENARIO_THEME_OVERLAYS,
} from './themeRegistry.ts';
import type {
  DeepPartial,
  ScenarioOverlayId,
  ThemeColors,
  ThemeContrastMode,
  ThemeDefinition,
  UiSkinId,
} from './types.ts';

interface ResolveThemeOptions {
  skinId?: UiSkinId;
  scenarioOverlayId?: ScenarioOverlayId | null;
  contrastMode?: ThemeContrastMode;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep<T extends object>(base: T, patch: DeepPartial<T>): T {
  const next = { ...base } as Record<string, unknown>;
  const patchEntries = Object.entries(patch as Record<string, unknown>);

  patchEntries.forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const currentValue = next[key];
    next[key] = isPlainObject(currentValue) && isPlainObject(value)
      ? mergeDeep(currentValue, value as DeepPartial<typeof currentValue>)
      : value;
  });

  return next as T;
}

function applyContrastMode(colors: ThemeColors, contrastMode: ThemeContrastMode): ThemeColors {
  if (contrastMode !== 'high') {
    return colors;
  }

  return {
    ...colors,
    textSecondary: `color-mix(in srgb, ${colors.textPrimary} 84%, ${colors.backgroundElevated} 16%)`,
    textMuted: `color-mix(in srgb, ${colors.textPrimary} 72%, ${colors.backgroundElevated} 28%)`,
    borderSubtle: `color-mix(in srgb, ${colors.borderStrong} 66%, ${colors.backgroundElevated} 34%)`,
    borderStrong: `color-mix(in srgb, ${colors.textPrimary} 48%, ${colors.backgroundElevated} 52%)`,
    selectionHighlight: `color-mix(in srgb, ${colors.selectionHighlight} 78%, ${colors.backgroundElevated} 22%)`,
    tokenGlow: `color-mix(in srgb, ${colors.tokenGlow} 88%, ${colors.backgroundElevated} 12%)`,
  };
}

function resolveColors(
  skinId: UiSkinId,
  scenarioOverlayId: ScenarioOverlayId | null,
  contrastMode: ThemeContrastMode,
): ThemeColors {
  const skin = getUiSkinDefinition(skinId);
  const baseSkinColors = mapSkinToThemeColors(skin);
  const overlay = scenarioOverlayId ? SCENARIO_THEME_OVERLAYS[scenarioOverlayId] : null;
  const merged = overlay
    ? mergeDeep<ThemeColors>(baseSkinColors, overlay.overrides.colors)
    : baseSkinColors;
  return applyContrastMode(merged, contrastMode);
}

export function resolveTheme({
  skinId = DEFAULT_UI_SKIN_ID,
  scenarioOverlayId = null,
  contrastMode = 'default',
}: ResolveThemeOptions = {}): ThemeDefinition {
  const skin = getUiSkinDefinition(skinId);
  const overlay = scenarioOverlayId ? SCENARIO_THEME_OVERLAYS[scenarioOverlayId] : null;
  const colors = resolveColors(skinId, scenarioOverlayId, contrastMode);

  return {
    ...BASE_THEME,
    id: overlay?.id ?? skin.id,
    label: overlay ? `${skin.label} · ${overlay.label}` : skin.label,
    skinId: skin.id,
    skinLabel: skin.label,
    contrastMode,
    overlayId: overlay?.id ?? null,
    skin,
    colors,
    shadows: {
      ...BASE_THEME.shadows,
      focus: skin.focus.ring,
    },
  };
}

export function toThemeCssVariables(theme: ThemeDefinition) {
  const neutralBlack = 'rgba(0, 0, 0, 1)';
  const neutralWhite = 'rgba(255, 255, 255, 1)';

  return {
    '--skin-layer-canvas': theme.skin.layer.canvas,
    '--skin-layer-surface': theme.skin.layer.surface,
    '--skin-layer-elevated': theme.skin.layer.elevated,
    '--skin-layer-overlay': theme.skin.layer.overlay,
    '--skin-layer-scrim': theme.skin.layer.scrim,
    '--skin-text-primary': theme.colors.textPrimary,
    '--skin-text-muted': theme.colors.textSecondary,
    '--skin-text-inverse': theme.colors.textInverted,
    '--skin-border-subtle': theme.colors.borderSubtle,
    '--skin-border-strong': theme.colors.borderStrong,
    '--skin-focus-ring': theme.shadows.focus,
    '--skin-focus-ring-color': `color-mix(in srgb, ${theme.skin.action.secondary} 74%, ${theme.colors.backgroundElevated} 26%)`,
    '--skin-action-primary': theme.skin.action.primary,
    '--skin-action-secondary': theme.skin.action.secondary,
    '--skin-action-utility': theme.skin.action.utility,
    '--skin-state-success': theme.colors.stateMovement,
    '--skin-state-warning': theme.colors.stateWarning,
    '--skin-state-danger': theme.colors.stateDanger,
    '--skin-state-info': theme.colors.stateInfo,
    '--skin-map-safe': theme.skin.map.safe,
    '--skin-map-strained': theme.skin.map.strained,
    '--skin-map-critical': theme.skin.map.critical,
    '--skin-border-width-hairline': theme.skin.style.borderWidth.hairline,
    '--skin-border-width-thin': theme.skin.style.borderWidth.thin,
    '--skin-border-width-regular': theme.skin.style.borderWidth.regular,
    '--skin-border-width-strong': theme.skin.style.borderWidth.strong,
    '--skin-size-icon-xs': theme.skin.style.size.iconXs,
    '--skin-size-icon-sm': theme.skin.style.size.iconSm,
    '--skin-size-icon-md': theme.skin.style.size.iconMd,
    '--skin-size-icon-lg': theme.skin.style.size.iconLg,
    '--skin-size-chip-height': theme.skin.style.size.chipHeight,
    '--skin-size-control-height': theme.skin.style.size.controlHeight,
    '--skin-size-drawer-narrow': theme.skin.style.size.drawerWidthNarrow,
    '--skin-size-drawer': theme.skin.style.size.drawerWidth,
    '--skin-size-drawer-wide': theme.skin.style.size.drawerWidthWide,
    '--skin-size-card-width': theme.skin.style.size.cardWidth,
    '--skin-motion-instant': theme.skin.style.motion.instant,
    '--skin-motion-quick': theme.skin.style.motion.quick,
    '--skin-motion-fast': theme.skin.style.motion.fast,
    '--skin-motion-normal': theme.skin.style.motion.normal,
    '--skin-motion-slow': theme.skin.style.motion.slow,
    '--skin-motion-deliberate': theme.skin.style.motion.deliberate,
    '--skin-motion-reveal': theme.skin.style.motion.reveal,
    '--skin-motion-pulse': theme.skin.style.motion.pulse,
    '--skin-opacity-faint': theme.skin.style.opacity.faint,
    '--skin-opacity-soft': theme.skin.style.opacity.soft,
    '--skin-opacity-medium': theme.skin.style.opacity.medium,
    '--skin-opacity-strong': theme.skin.style.opacity.strong,
    '--skin-opacity-intense': theme.skin.style.opacity.intense,
    '--skin-shadow-raised': theme.skin.style.shadow.raised,
    '--skin-shadow-floating': theme.skin.style.shadow.floating,
    '--skin-shadow-glow': theme.skin.style.shadow.glow,

    '--color-background': theme.colors.backgroundPrimary,
    '--color-surface': theme.colors.backgroundSecondary,
    '--color-surface-elevated': theme.colors.backgroundElevated,
    '--color-focus-surface': theme.skin.action.primary,
    '--color-border': theme.colors.borderSubtle,
    '--color-text-primary': theme.colors.textPrimary,
    '--color-text-muted': theme.colors.textSecondary,
    '--color-accent': theme.colors.stateDanger,
    '--color-accent-strong': theme.colors.domainRevolution,
    '--color-danger': theme.colors.stateDanger,
    '--color-success': theme.colors.stateMovement,
    '--color-action-primary': theme.skin.action.primary,
    '--color-action-secondary': theme.skin.action.secondary,
    '--color-action-utility': theme.skin.action.utility,
    '--color-hero-tone': theme.colors.heroTone,
    '--color-background-wash': theme.colors.backgroundWash,
    '--color-selection-highlight': theme.colors.selectionHighlight,
    '--color-token-glow': theme.colors.tokenGlow,
    '--color-surface-tint': theme.colors.surfaceTint,

    '--color-bg-primary': theme.colors.backgroundPrimary,
    '--color-bg-secondary': theme.colors.backgroundSecondary,
    '--color-bg-panel': theme.colors.backgroundPanel,
    '--color-bg-elevated': theme.colors.backgroundElevated,
    '--color-text-secondary': theme.colors.textSecondary,
    '--color-text-inverted': theme.colors.textInverted,
    '--color-border-subtle': theme.colors.borderSubtle,
    '--color-border-strong': theme.colors.borderStrong,
    '--color-border-danger': theme.colors.borderDanger,
    '--color-state-movement': theme.colors.stateMovement,
    '--color-state-danger': theme.colors.stateDanger,
    '--color-state-warning': theme.colors.stateWarning,
    '--color-state-neutral': theme.colors.stateNeutral,
    '--color-state-info': theme.colors.stateInfo,
    '--color-domain-war-machine': theme.colors.domainWarMachine,
    '--color-domain-climate': theme.colors.domainClimate,
    '--color-domain-fossil': theme.colors.domainFossil,
    '--color-domain-justice': theme.colors.domainJustice,
    '--color-domain-voice': theme.colors.domainVoice,
    '--color-domain-hunger': theme.colors.domainHunger,
    '--color-domain-patriarchy': theme.colors.domainPatriarchy,
    '--color-domain-revolution': theme.colors.domainRevolution,

    '--shadow-level-1': theme.shadows.subtle,
    '--shadow-level-2': theme.shadows.medium,
    '--shadow-level-3': theme.shadows.strong,
    '--shadow-focus': theme.shadows.focus,

    '--radius-sm': theme.radius.sm,
    '--radius-md': theme.radius.md,
    '--radius-lg': theme.radius.lg,

    '--space-0': theme.spacing.xxs,
    '--space-1': theme.spacing.xs,
    '--space-2': theme.spacing.sm,
    '--space-3': theme.spacing.md,
    '--space-4': theme.spacing.lg,
    '--space-5': theme.spacing.xl,
    '--space-6': theme.spacing.xxl,

    '--font-display': theme.typography.headline,
    '--font-body': theme.typography.body,
    '--font-narrative': theme.typography.headline,
    '--font-data': theme.typography.mono,
    '--type-0': theme.typography.sizeXs,
    '--type-1': theme.typography.sizeSm,
    '--type-2': theme.typography.sizeMd,
    '--type-3': theme.typography.sizeLg,
    '--type-4': theme.typography.sizeXl,
    '--type-5': theme.typography.sizeHero,
    '--type-6': theme.typography.sizeXxl,
    '--line-height-tight': theme.typography.lineHeightTight,
    '--line-height-copy': theme.typography.lineHeightNormal,
    '--line-height-relaxed': theme.typography.lineHeightRelaxed,
    '--font-weight-regular': theme.typography.weightRegular,
    '--font-weight-medium': theme.typography.weightMedium,
    '--font-weight-bold': theme.typography.weightBold,

    '--motion-duration-fast': theme.motion.fast,
    '--motion-duration-med': theme.motion.normal,
    '--motion-duration-slow': theme.motion.slow,
    '--motion-ease-standard': theme.motion.easing,
    '--motion-ease-emphasized': theme.motion.easing,
    '--motion-ease-entrance': theme.motion.easing,
    '--motion-fast': `${theme.motion.fast} ${theme.motion.easing}`,
    '--motion-mid': `${theme.motion.normal} ${theme.motion.easing}`,
    '--motion-slow': `${theme.motion.slow} ${theme.motion.easing}`,

    '--z-base': String(theme.zIndex.base),
    '--z-panel': String(theme.zIndex.panel),
    '--z-dropdown': String(theme.zIndex.dropdown),
    '--z-modal': String(theme.zIndex.modal),
    '--z-overlay': String(theme.zIndex.overlay),
    '--z-toast': String(theme.zIndex.toast),

    '--icon-size-xs': `${theme.layout.iconXs}px`,
    '--icon-size-sm': `${theme.layout.iconSm}px`,
    '--icon-size-md': `${theme.layout.iconMd}px`,
    '--icon-size-lg': `${theme.layout.iconLg}px`,
    '--size-icon-xs': theme.skin.style.size.iconXs,
    '--size-icon-sm': theme.skin.style.size.iconSm,
    '--size-icon-md': theme.skin.style.size.iconMd,
    '--size-icon-lg': theme.skin.style.size.iconLg,
    '--size-chip-height': theme.skin.style.size.chipHeight,
    '--size-control-height': theme.skin.style.size.controlHeight,
    '--size-drawer-narrow': theme.skin.style.size.drawerWidthNarrow,
    '--size-drawer': theme.skin.style.size.drawerWidth,
    '--size-drawer-wide': theme.skin.style.size.drawerWidthWide,
    '--size-card-width': theme.skin.style.size.cardWidth,
    '--border-width-hairline': theme.skin.style.borderWidth.hairline,
    '--border-width-thin': theme.skin.style.borderWidth.thin,
    '--border-width-regular': theme.skin.style.borderWidth.regular,
    '--border-width-strong': theme.skin.style.borderWidth.strong,
    '--duration-instant': theme.skin.style.motion.instant,
    '--duration-quick': theme.skin.style.motion.quick,
    '--duration-fast': theme.skin.style.motion.fast,
    '--duration-normal': theme.skin.style.motion.normal,
    '--duration-slow': theme.skin.style.motion.slow,
    '--duration-deliberate': theme.skin.style.motion.deliberate,
    '--duration-reveal': theme.skin.style.motion.reveal,
    '--duration-pulse': theme.skin.style.motion.pulse,
    '--opacity-faint': theme.skin.style.opacity.faint,
    '--opacity-soft': theme.skin.style.opacity.soft,
    '--opacity-medium': theme.skin.style.opacity.medium,
    '--opacity-strong': theme.skin.style.opacity.strong,
    '--opacity-intense': theme.skin.style.opacity.intense,
    '--shadow-raised': theme.skin.style.shadow.raised,
    '--shadow-floating': theme.skin.style.shadow.floating,
    '--shadow-glow': theme.skin.style.shadow.glow,

    '--button-padding-y': theme.layout.buttonPaddingY,
    '--button-padding-x': theme.layout.buttonPaddingX,
    '--panel-padding': theme.layout.panelPadding,

    '--text-1': theme.colors.textPrimary,
    '--text-2': theme.colors.textSecondary,
    '--text-3': theme.colors.textMuted,
    '--surface-0': theme.colors.backgroundPrimary,
    '--surface-1': theme.colors.backgroundSecondary,
    '--surface-2': theme.colors.backgroundElevated,
    '--surface-3': theme.colors.backgroundPanel,
    '--line-soft': theme.colors.borderSubtle,
    '--line-strong': theme.colors.borderStrong,
    '--accent-primary': theme.colors.stateDanger,
    '--accent-primary-strong': theme.colors.domainRevolution,
    '--accent-secondary': theme.colors.stateInfo,
    '--accent-danger': theme.colors.stateDanger,
    '--accent-warning': theme.colors.stateWarning,
    '--accent-success': theme.colors.stateMovement,

    '--theme-ink': theme.colors.textPrimary,
    '--theme-parchment': theme.colors.backgroundSecondary,
    '--theme-paper': theme.colors.backgroundElevated,
    '--theme-aged-paper': `color-mix(in srgb, ${theme.colors.backgroundSecondary} 82%, ${theme.colors.borderStrong} 18%)`,
    '--theme-oxide-red': theme.colors.stateDanger,
    '--theme-evidence-blue': theme.colors.stateInfo,
    '--theme-fossil-core': theme.colors.domainFossil,
    '--theme-brass': theme.colors.stateWarning,
    '--theme-planet-green': theme.colors.stateMovement,
    '--theme-gaze-gold': theme.colors.stateWarning,

    '--board-sand': theme.colors.backgroundSecondary,
    '--board-ivory': theme.colors.backgroundElevated,
    '--board-ink': theme.colors.textPrimary,
    '--board-grain-opacity': '0.045',
    '--board-topography-opacity': '0.08',
    '--board-war-vignette': `color-mix(in srgb, ${theme.colors.stateDanger} 22%, transparent)`,
    '--board-gaze-halo': `color-mix(in srgb, ${theme.colors.stateWarning} 30%, transparent)`,

    '--status-liberation': theme.colors.domainRevolution,
    '--status-gaze': theme.colors.stateWarning,
    '--status-war': theme.colors.stateDanger,
    '--status-pool': `color-mix(in srgb, ${theme.colors.textPrimary} 68%, ${theme.colors.backgroundSecondary} 32%)`,
    '--status-round': theme.colors.stateMovement,
    '--map-safe': theme.skin.map.safe,
    '--map-strained': theme.skin.map.strained,
    '--map-critical': theme.skin.map.critical,

    '--context-surface': `color-mix(in srgb, ${theme.colors.backgroundElevated} 92%, ${neutralWhite} 8%)`,
    '--dock-surface': `color-mix(in srgb, ${theme.colors.backgroundSecondary} 92%, ${neutralWhite} 8%)`,
    '--panel-rim': `color-mix(in srgb, ${theme.colors.borderSubtle} 72%, transparent)`,
    '--panel-rim-strong': `color-mix(in srgb, ${theme.colors.borderStrong} 92%, transparent)`,
    '--tile-rim-dark': `color-mix(in srgb, ${theme.colors.borderStrong} 84%, transparent)`,
    '--panel-shadow': theme.shadows.medium,
    '--tile-shadow': theme.shadows.subtle,
    '--tile-shadow-pressed': '0 6px 14px rgba(0, 0, 0, 0.14)',
    '--tile-emboss': `inset 0 1px 0 color-mix(in srgb, ${neutralWhite} 72%, transparent), inset 0 -2px 0 color-mix(in srgb, ${neutralBlack} 8%, transparent)`,
    '--token-shadow': '0 8px 18px rgba(0, 0, 0, 0.2)',

    '--front-war': theme.colors.domainWarMachine,
    '--front-climate': theme.colors.domainClimate,
    '--front-rights': theme.colors.domainFossil,
    '--front-speech-info': theme.colors.domainVoice,
    '--front-poverty': theme.colors.domainHunger,
    '--front-energy': theme.colors.domainFossil,
    '--front-culture': theme.colors.domainPatriarchy,
    '--front-wave': theme.colors.domainRevolution,

    '--seat-1': theme.colors.stateInfo,
    '--seat-2': theme.colors.domainVoice,
    '--seat-3': theme.colors.stateWarning,
    '--seat-4': theme.colors.stateDanger,
  } satisfies Record<string, string>;
}

export function applyThemeVariables(theme: ThemeDefinition, overlayId: ScenarioOverlayId | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const variables = toThemeCssVariables(theme);

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.dataset.themeId = theme.id;
  root.dataset.uiSkin = theme.skinId;
  root.dataset.themeContrast = theme.contrastMode;
  if (overlayId) {
    root.dataset.scenarioTheme = overlayId;
  } else {
    delete root.dataset.scenarioTheme;
  }
}
