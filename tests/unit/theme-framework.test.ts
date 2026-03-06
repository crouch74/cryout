import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASE_THEME,
  DEFAULT_UI_SKIN_ID,
  getScenarioOverlayForRuleset,
  listScenarioThemeMappings,
  resolveTheme,
  SCENARIO_THEME_OVERLAYS,
  toThemeCssVariables,
  UI_SKINS,
} from '../../src/theme/index.ts';

const REQUIRED_ROLE_GROUPS = [
  'layer',
  'text',
  'border',
  'focus',
  'action',
  'state',
  'map',
  'domain',
  'effects',
] as const;

const REQUIRED_CSS_VARIABLES = [
  '--color-background',
  '--color-surface',
  '--color-surface-elevated',
  '--color-focus-surface',
  '--color-border',
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-panel',
  '--color-bg-elevated',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-accent',
  '--color-border-subtle',
  '--color-border-strong',
  '--color-danger',
  '--color-success',
  '--color-domain-war-machine',
  '--color-domain-climate',
  '--shadow-level-1',
  '--shadow-level-2',
  '--shadow-level-3',
  '--shadow-focus',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
  '--z-base',
  '--z-panel',
  '--z-dropdown',
  '--z-modal',
  '--z-overlay',
  '--z-toast',
  '--icon-size-xs',
  '--icon-size-sm',
  '--icon-size-md',
  '--icon-size-lg',
  '--font-display',
  '--font-body',
  '--font-data',
  '--type-0',
  '--type-1',
  '--type-2',
  '--type-3',
  '--type-4',
  '--type-5',
  '--line-height-tight',
  '--line-height-copy',
  '--motion-duration-fast',
  '--motion-duration-med',
  '--motion-duration-slow',
  '--motion-ease-standard',
  '--motion-ease-emphasized',
  '--motion-ease-entrance',
  '--skin-layer-canvas',
  '--skin-layer-surface',
  '--skin-layer-elevated',
  '--skin-layer-overlay',
  '--skin-layer-scrim',
  '--skin-action-primary',
  '--skin-action-secondary',
  '--skin-action-utility',
  '--skin-map-safe',
  '--skin-map-strained',
  '--skin-map-critical',
] as const;

function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value).flatMap((item) => collectStringValues(item));
}

function extractDescriptionLiterals(source: string): string[] {
  const matches = source.matchAll(/description:\s*'([^']+)'/g);
  return Array.from(matches, (match) => match[1] ?? '');
}

function parseHexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const expanded = normalized.length === 3
    ? normalized.split('').map((chunk) => `${chunk}${chunk}`).join('')
    : normalized;

  assert.ok(expanded.length === 6, `Expected 6-digit hex color, received: ${hex}`);
  const int = Number.parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function srgbToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string) {
  const { r, g, b } = parseHexToRgb(hex);
  return (0.2126 * srgbToLinear(r)) + (0.7152 * srgbToLinear(g)) + (0.0722 * srgbToLinear(b));
}

function contrastRatio(foregroundHex: string, backgroundHex: string) {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

test('theme framework exposes three UI skins with required role groups and scenario overlays', () => {
  assert.equal(Object.keys(UI_SKINS).length, 3);
  assert.equal(DEFAULT_UI_SKIN_ID in UI_SKINS, true);
  assert.equal(Object.keys(SCENARIO_THEME_OVERLAYS).length, 5);

  for (const skin of Object.values(UI_SKINS)) {
    for (const roleGroup of REQUIRED_ROLE_GROUPS) {
      assert.equal(typeof skin[roleGroup], 'object', `Missing role group: ${skin.id}.${roleGroup}`);
    }
  }
});

test('scenario mapping resolves overlays and unknown rulesets fall back to skin-only theme', () => {
  assert.equal(getScenarioOverlayForRuleset('stones_cry_out'), 'burnt-earth-resistance');
  assert.equal(getScenarioOverlayForRuleset('tahrir_square'), 'night-map-escalation');
  assert.equal(getScenarioOverlayForRuleset('woman_life_freedom'), 'dossier-of-the-disappeared');
  assert.equal(getScenarioOverlayForRuleset('algerian_war_of_independence'), 'desert-horizon');
  assert.equal(getScenarioOverlayForRuleset('unknown_ruleset_id'), null);

  const overlayTheme = resolveTheme({
    skinId: DEFAULT_UI_SKIN_ID,
    scenarioOverlayId: getScenarioOverlayForRuleset('stones_cry_out'),
  });
  assert.equal(overlayTheme.id, 'burnt-earth-resistance');
  assert.equal(overlayTheme.skinId, DEFAULT_UI_SKIN_ID);
  assert.notEqual(overlayTheme.colors.stateDanger, BASE_THEME.colors.stateDanger);

  const fallbackTheme = resolveTheme({
    skinId: DEFAULT_UI_SKIN_ID,
    scenarioOverlayId: getScenarioOverlayForRuleset('unknown_ruleset_id'),
  });
  assert.equal(fallbackTheme.id, DEFAULT_UI_SKIN_ID);
  assert.equal(fallbackTheme.skinId, DEFAULT_UI_SKIN_ID);
  assert.equal(fallbackTheme.colors.stateDanger, BASE_THEME.colors.stateDanger);

  const mapping = listScenarioThemeMappings();
  assert.equal(mapping.some((entry) => entry.rulesetId === 'stones_cry_out' && entry.overlayId === 'burnt-earth-resistance'), true);
});

test('resolved themes export canonical and skin CSS variables for runtime application', () => {
  const variables = toThemeCssVariables(resolveTheme({
    skinId: 'nocturnal-dossier',
    scenarioOverlayId: 'night-map-escalation',
  }));

  for (const key of REQUIRED_CSS_VARIABLES) {
    assert.equal(typeof variables[key], 'string', `Missing CSS variable output: ${key}`);
  }

  assert.equal(
    variables['--color-accent'],
    resolveTheme({ skinId: 'nocturnal-dossier', scenarioOverlayId: 'night-map-escalation' }).colors.stateDanger,
  );
});

test('high-contrast mode preserves skin identity while increasing text contrast', () => {
  const standard = resolveTheme({ skinId: 'civic-signal', contrastMode: 'default' });
  const highContrast = resolveTheme({ skinId: 'civic-signal', contrastMode: 'high' });

  assert.equal(highContrast.skinId, standard.skinId);
  assert.notEqual(highContrast.colors.textSecondary, standard.colors.textSecondary);
  assert.notEqual(highContrast.colors.borderSubtle, standard.colors.borderSubtle);
});

test('default skin palettes satisfy AA contrast for primary readability pairs', () => {
  for (const skin of Object.values(UI_SKINS)) {
    const bodyContrast = contrastRatio(skin.text.primary, skin.layer.surface);
    const controlContrast = contrastRatio(skin.text.inverse, skin.action.primary);
    const dangerContrast = contrastRatio(skin.text.inverse, skin.state.danger);

    assert.ok(bodyContrast >= 4.5, `${skin.id} body text contrast fell below AA: ${bodyContrast.toFixed(2)}`);
    assert.ok(controlContrast >= 4.5, `${skin.id} primary control contrast fell below AA: ${controlContrast.toFixed(2)}`);
    assert.ok(dangerContrast >= 4.5, `${skin.id} critical state contrast fell below AA: ${dangerContrast.toFixed(2)}`);
  }
});

test('reduced-motion and RTL guardrails remain encoded in shared shell sources', () => {
  const tabletopCss = readFileSync(new URL('../../src/styles/tabletop/tabletop.css', import.meta.url), 'utf8');
  const homeCss = readFileSync(new URL('../../src/styles/shell/home.css', import.meta.url), 'utf8');
  const setupSource = readFileSync(new URL('../../src/features/session-setup/ui/SessionSetupScreen.tsx', import.meta.url), 'utf8');

  assert.match(tabletopCss, /html\[data-motion='reduced'\]/);
  assert.match(tabletopCss, /:focus-visible/);
  assert.match(homeCss, /html\[dir='rtl'\]\s+\.setup-utility-strip/);
  assert.match(homeCss, /html\[dir='rtl'\]\s+\.scenario-select-major/);
  assert.match(setupSource, /motionMode !== 'reduced'/);
});

test('theme provider persists skin id and prioritizes URL skin query over storage', () => {
  const providerSource = readFileSync(new URL('../../src/app/providers/ThemeProvider.tsx', import.meta.url), 'utf8');

  assert.match(providerSource, /const SKIN_KEY = 'stones\.ui\.skin'/);
  assert.match(providerSource, /new URLSearchParams\(window\.location\.search\)\.get\('skin'\)/);
  assert.match(providerSource, /const urlSkin = getSkinFromUrl\(\)/);
  assert.match(providerSource, /if \(urlSkin\)/);
  assert.match(providerSource, /window\.localStorage\.setItem\(SKIN_KEY, activeSkinId\)/);
  assert.match(providerSource, /document\.documentElement\.dataset\.uiSkin = activeSkinId/);
});

test('app root derives theme ruleset from setup, lobby, and active session state', () => {
  const appRootSource = readFileSync(new URL('../../src/app/AppRoot.tsx', import.meta.url), 'utf8');

  assert.match(appRootSource, /const activeRulesetId = useMemo/);
  assert.match(appRootSource, /return setupDraft\.rulesetId;/);
  assert.match(appRootSource, /return session\.lobby\.config\.rulesetId;/);
  assert.match(appRootSource, /return session\.state\.rulesetId;/);
  assert.match(appRootSource, /setActiveRulesetId\(activeRulesetId\)/);
});

test('player-facing catalogs and scenario fallback descriptions avoid dehumanizing terms', () => {
  const enCatalog = JSON.parse(readFileSync(new URL('../../src/i18n/en.json', import.meta.url), 'utf8'));
  const arCatalog = JSON.parse(readFileSync(new URL('../../src/i18n/ar-EG.json', import.meta.url), 'utf8'));
  const enValues = collectStringValues(enCatalog).join('\n');
  const arValues = collectStringValues(arCatalog).join('\n');

  assert.doesNotMatch(enValues, /\bBodies?\b/);
  assert.doesNotMatch(arValues, /\bBodies?\b/i);

  const tahrirSource = readFileSync(new URL('../../src/scenarios/tahrir_square/content.ts', import.meta.url), 'utf8');
  const wlfSource = readFileSync(new URL('../../src/scenarios/woman_life_freedom/content.ts', import.meta.url), 'utf8');
  const tahrirDescriptions = extractDescriptionLiterals(tahrirSource).join('\n');
  const wlfDescriptions = extractDescriptionLiterals(wlfSource).join('\n');

  assert.doesNotMatch(tahrirDescriptions, /\bBodies?\b/);
  assert.doesNotMatch(wlfDescriptions, /\bBodies?\b/);
});
