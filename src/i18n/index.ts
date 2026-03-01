import type {
  CivicSpace,
  CompiledContent,
  FrontDefinition,
  FrontId,
  RegionDefinition,
  RegionId,
  RoleDefinition,
  ScenarioDefinition,
} from '../../engine/index.ts';
import enCatalog from './en.json';
import arEGCatalog from './ar-EG.json';

type Catalog = typeof enCatalog;
type InterpolationValue = string | number;
export type Locale = 'en' | 'ar-EG';

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ar-EG', label: 'العربية (مصر)' },
];

const catalogs: Record<Locale, Catalog> = {
  en: enCatalog,
  'ar-EG': arEGCatalog,
};

let activeLocale: Locale = 'en';

function getCatalog() {
  return catalogs[activeLocale];
}

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'ar-EG';
}

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function getLocaleDirection(locale: Locale = activeLocale): 'ltr' | 'rtl' {
  return locale === 'ar-EG' ? 'rtl' : 'ltr';
}

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }

    return undefined;
  }, getCatalog());
}

function interpolate(template: string, values?: Record<string, InterpolationValue>): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

function translateObject(path: string): Record<string, string> | undefined {
  const value = lookup(path);
  return value && typeof value === 'object' ? (value as Record<string, string>) : undefined;
}

function localizeNamedMap<T extends { id: string }>(
  items: Record<string, T>,
  path: string,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(items).map(([id, item]) => {
      const override = translateObject(`${path}.${id}`);
      return [id, override ? { ...item, ...override } : item];
    }),
  );
}

function localizeScenarioDefinitionInternal(scenario: ScenarioDefinition): ScenarioDefinition {
  const scenarioPath = `content.scenarios.${scenario.id}`;
  const override = translateObject(scenarioPath);
  const specialRuleChips = scenario.specialRuleChips.map((chip) => {
    const chipOverride = translateObject(`${scenarioPath}.specialRuleChips.${chip.id}`);
    return chipOverride ? { ...chip, ...chipOverride } : chip;
  });

  return {
    ...scenario,
    ...(override ?? {}),
    specialRuleChips,
  };
}

export function t(path: string, fallback: string, values?: Record<string, InterpolationValue>): string {
  const value = lookup(path);
  if (typeof value === 'string') {
    return interpolate(value, values);
  }

  return interpolate(fallback, values);
}

export function localizeContent(content: CompiledContent): CompiledContent {
  return {
    ...content,
    fronts: localizeNamedMap(content.fronts, 'content.fronts') as Record<FrontId, FrontDefinition>,
    regions: localizeNamedMap(content.regions, 'content.regions') as Record<RegionId, RegionDefinition>,
    roles: localizeNamedMap(content.roles, 'content.roles') as Record<keyof CompiledContent['roles'], RoleDefinition>,
    institutions: localizeNamedMap(content.institutions, 'content.institutions') as CompiledContent['institutions'],
    actions: localizeNamedMap(content.actions, 'content.actions'),
    charter: localizeNamedMap(content.charter, 'content.charter'),
    scenario: localizeScenarioDefinitionInternal(content.scenario),
  };
}

export function localizeScenarioDefinition(scenario: ScenarioDefinition): ScenarioDefinition {
  return localizeScenarioDefinitionInternal(scenario);
}

export function getRegionLabel(regionId: RegionId): string {
  return t(`content.regions.${regionId}.name`, regionId);
}

export function getFrontLabel(frontId: FrontId): string {
  return t(`content.fronts.${frontId}.name`, frontId);
}

export function getRoleName(roleId: keyof Catalog['content']['roles']): string {
  return t(`content.roles.${roleId}.name`, roleId);
}

export function getRegionStrapline(regionId: RegionId, fallback: string): string {
  return t(`worldMap.straplines.${regionId}`, fallback);
}

export function getCivicSpaceLabel(civicSpace: CivicSpace): string {
  return t(`ui.civicSpace.${civicSpace}`, civicSpace);
}

export function getEndingTierLabel(tier: string): string {
  return t(`ui.endingTier.${tier}`, tier);
}
