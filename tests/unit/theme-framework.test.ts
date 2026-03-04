import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASE_THEME,
  getScenarioOverlayForRuleset,
  listScenarioThemeMappings,
  resolveTheme,
  SCENARIO_THEME_OVERLAYS,
  toThemeCssVariables,
} from '../../src/theme/index.ts';

const REQUIRED_COLOR_KEYS = [
  'backgroundPrimary',
  'backgroundSecondary',
  'backgroundPanel',
  'backgroundElevated',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'borderSubtle',
  'borderStrong',
  'borderDanger',
  'stateMovement',
  'stateDanger',
  'stateWarning',
  'stateNeutral',
  'stateInfo',
  'domainWarMachine',
  'domainClimate',
  'domainFossil',
  'domainJustice',
  'domainVoice',
  'domainHunger',
  'domainPatriarchy',
  'domainRevolution',
  'heroTone',
  'backgroundWash',
  'selectionHighlight',
  'tokenGlow',
  'surfaceTint',
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

test('theme framework exposes required base tokens and overlays', () => {
  assert.equal(Object.keys(SCENARIO_THEME_OVERLAYS).length, 5);
  for (const key of REQUIRED_COLOR_KEYS) {
    assert.equal(typeof BASE_THEME.colors[key], 'string', `Missing base color token: ${key}`);
  }
});

test('scenario mapping resolves overlays and unknown rulesets fall back to base theme', () => {
  assert.equal(getScenarioOverlayForRuleset('base_design'), 'burnt-earth-resistance');
  assert.equal(getScenarioOverlayForRuleset('tahrir_square'), 'night-map-escalation');
  assert.equal(getScenarioOverlayForRuleset('woman_life_freedom'), 'dossier-of-the-disappeared');
  assert.equal(getScenarioOverlayForRuleset('algerian_war_of_independence'), 'desert-horizon');
  assert.equal(getScenarioOverlayForRuleset('unknown_ruleset_id'), null);

  const overlayTheme = resolveTheme(getScenarioOverlayForRuleset('base_design'));
  assert.equal(overlayTheme.id, 'burnt-earth-resistance');
  assert.notEqual(overlayTheme.colors.stateDanger, BASE_THEME.colors.stateDanger);

  const fallbackTheme = resolveTheme(getScenarioOverlayForRuleset('unknown_ruleset_id'));
  assert.equal(fallbackTheme.id, BASE_THEME.id);
  assert.equal(fallbackTheme.colors.stateDanger, BASE_THEME.colors.stateDanger);

  const mapping = listScenarioThemeMappings();
  assert.equal(mapping.some((entry) => entry.rulesetId === 'base_design' && entry.overlayId === 'burnt-earth-resistance'), true);
});

test('resolved themes export canonical CSS variables for runtime application', () => {
  const variables = toThemeCssVariables(resolveTheme('night-map-escalation'));

  for (const key of REQUIRED_CSS_VARIABLES) {
    assert.equal(typeof variables[key], 'string', `Missing CSS variable output: ${key}`);
  }

  assert.equal(variables['--color-accent'], resolveTheme('night-map-escalation').colors.stateDanger);
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
