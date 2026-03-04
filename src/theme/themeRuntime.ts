import { BASE_THEME, SCENARIO_THEME_OVERLAYS } from './themeRegistry.ts';
import type { DeepPartial, ScenarioOverlayId, ThemeDefinition } from './types.ts';

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

export function resolveTheme(overlayId: ScenarioOverlayId | null): ThemeDefinition {
  const overlay = overlayId ? SCENARIO_THEME_OVERLAYS[overlayId] : null;
  if (!overlay) {
    return BASE_THEME;
  }

  return {
    ...BASE_THEME,
    id: overlay.id,
    label: overlay.label,
    colors: mergeDeep<typeof BASE_THEME.colors>(BASE_THEME.colors, overlay.overrides.colors ?? {}),
    shadows: mergeDeep<typeof BASE_THEME.shadows>(BASE_THEME.shadows, overlay.overrides.shadows ?? {}),
    radius: mergeDeep<typeof BASE_THEME.radius>(BASE_THEME.radius, overlay.overrides.radius ?? {}),
    spacing: mergeDeep<typeof BASE_THEME.spacing>(BASE_THEME.spacing, overlay.overrides.spacing ?? {}),
    typography: mergeDeep<typeof BASE_THEME.typography>(BASE_THEME.typography, overlay.overrides.typography ?? {}),
    motion: mergeDeep<typeof BASE_THEME.motion>(BASE_THEME.motion, overlay.overrides.motion ?? {}),
  };
}

export function toThemeCssVariables(theme: ThemeDefinition) {
  return {
    '--color-background': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-surface-elevated': theme.colors.surfaceElevated,
    '--color-focus-surface': theme.colors.focusSurface,
    '--color-border': theme.colors.border,
    '--color-text-primary': theme.colors.textPrimary,
    '--color-text-muted': theme.colors.textMuted,
    '--color-accent': theme.colors.accent,
    '--color-accent-strong': theme.colors.accentStrong,
    '--color-danger': theme.colors.danger,
    '--color-success': theme.colors.success,
    '--color-hero-tone': theme.colors.heroTone,
    '--color-background-wash': theme.colors.backgroundWash,
    '--color-selection-highlight': theme.colors.selectionHighlight,
    '--color-token-glow': theme.colors.tokenGlow,
    '--color-surface-tint': theme.colors.surfaceTint,
    '--shadow-level-1': theme.shadows.level1,
    '--shadow-level-2': theme.shadows.level2,
    '--shadow-focus': theme.shadows.focus,
    '--radius-sm': theme.radius.sm,
    '--radius-md': theme.radius.md,
    '--radius-lg': theme.radius.lg,
    '--space-1': theme.spacing.xs,
    '--space-2': theme.spacing.sm,
    '--space-3': theme.spacing.md,
    '--space-4': theme.spacing.lg,
    '--space-5': theme.spacing.xl,
    '--space-6': theme.spacing.xxl,
    '--font-display': theme.typography.display,
    '--font-body': theme.typography.body,
    '--font-narrative': theme.typography.narrative,
    '--font-data': theme.typography.data,
    '--type-0': theme.typography.scale0,
    '--type-1': theme.typography.scale1,
    '--type-2': theme.typography.scale2,
    '--type-3': theme.typography.scale3,
    '--type-4': theme.typography.scale4,
    '--type-5': theme.typography.scale5,
    '--line-height-tight': theme.typography.lineHeightTight,
    '--line-height-copy': theme.typography.lineHeightCopy,
    '--motion-duration-fast': theme.motion.durationFast,
    '--motion-duration-med': theme.motion.durationMed,
    '--motion-duration-slow': theme.motion.durationSlow,
    '--motion-ease-standard': theme.motion.easingStandard,
    '--motion-ease-emphasized': theme.motion.easingEmphasized,
    '--motion-ease-entrance': theme.motion.easingEntrance,
    '--motion-fast': `${theme.motion.durationFast} ${theme.motion.easingStandard}`,
    '--motion-mid': `${theme.motion.durationMed} ${theme.motion.easingStandard}`,
    '--motion-slow': `${theme.motion.durationSlow} ${theme.motion.easingEmphasized}`,
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
  if (overlayId) {
    root.dataset.scenarioTheme = overlayId;
  } else {
    delete root.dataset.scenarioTheme;
  }
}
