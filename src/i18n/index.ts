import enCatalog from './en.json';
import arEGCatalog from './ar-EG.json';

type Catalog = typeof enCatalog;
type InterpolationValue = string | number;
export type Locale = 'en' | 'ar-EG';

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ar-EG', label: 'العربية المصرية' },
];

const catalogs: Record<Locale, Catalog> = {
  en: enCatalog,
  'ar-EG': arEGCatalog,
};

let activeLocale: Locale = 'en';

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalogs[activeLocale]);
}

function interpolate(template: string, values?: Record<string, InterpolationValue>) {
  if (!values) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'ar-EG';
}

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function getLocaleDirection(locale: Locale = activeLocale): 'ltr' | 'rtl' {
  return locale === 'ar-EG' ? 'rtl' : 'ltr';
}

export function t(path: string, fallback: string, values?: Record<string, InterpolationValue>) {
  const value = lookup(path);
  return interpolate(typeof value === 'string' ? value : fallback, values);
}

export function formatNumber(value: number, locale: Locale = activeLocale) {
  return new Intl.NumberFormat(locale === 'ar-EG' ? 'ar-EG-u-nu-arab' : 'en').format(value);
}

function localizeContent(section: string, id: string, field: string, fallback: string) {
  return t(`content.${section}.${id}.${field}`, fallback);
}

export function localizeRulesetField(rulesetId: string, field: 'name' | 'description' | 'introduction', fallback: string) {
  return localizeContent('rulesets', rulesetId, field, fallback);
}

export function localizeDomainField(domainId: string, field: 'name' | 'description', fallback: string) {
  return localizeContent('domains', domainId, field, fallback);
}

export function localizeRegionField(regionId: string, field: 'name' | 'description' | 'strapline', fallback: string) {
  return localizeContent('regions', regionId, field, fallback);
}

export function localizeFactionField(
  factionId: string,
  field: 'name' | 'shortName' | 'passive' | 'weakness' | 'mandateTitle' | 'mandateDescription',
  fallback: string,
) {
  return localizeContent('factions', factionId, field, fallback);
}

export function localizeActionField(actionId: string, field: 'name' | 'description', fallback: string) {
  return localizeContent('actions', actionId, field, fallback);
}

export function localizeBeaconField(beaconId: string, field: 'title' | 'description', fallback: string) {
  return localizeContent('beacons', beaconId, field, fallback);
}

export function localizeCardField(cardId: string, field: 'name' | 'text', fallback: string) {
  return localizeContent('cards', cardId, field, fallback);
}
