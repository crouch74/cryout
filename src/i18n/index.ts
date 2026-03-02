import enCatalog from './en.json' with { type: 'json' };
import arEGCatalog from './ar-EG.json' with { type: 'json' };
import { buildEffectPreview, type ActionDefinition } from '../../engine/index.ts';

type Catalog = typeof enCatalog;
type InterpolationValue = string | number;
export type Locale = 'en' | 'ar-EG';

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
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (typeof value === 'number') {
      return formatNumber(value);
    }
    return String(value ?? '');
  });
}

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'ar-EG';
}

export function setLocale(locale: Locale) {
  activeLocale = locale;
  console.log(`🌍 [i18n] Locale changed to: ${locale}`);
}

export function getLocaleDirection(locale: Locale = activeLocale): 'ltr' | 'rtl' {
  return locale === 'ar-EG' ? 'rtl' : 'ltr';
}

export function isRtlLocale(locale: Locale = activeLocale) {
  return getLocaleDirection(locale) === 'rtl';
}

export function formatTrackFraction(current: number, max: number, locale: Locale = activeLocale) {
  const currentText = formatNumber(current, locale);
  const maxText = formatNumber(max, locale);
  return getLocaleDirection(locale) === 'rtl'
    ? `${maxText}/${currentText}`
    : `${currentText}/${maxText}`;
}

export function t(path: string, fallback: string, values?: Record<string, InterpolationValue>) {
  const value = lookup(path);
  return interpolate(typeof value === 'string' ? value : fallback, values);
}

export function formatNumber(value: number, locale: Locale = activeLocale) {
  return new Intl.NumberFormat(locale === 'ar-EG' ? 'ar-EG-u-nu-arab' : 'en').format(value);
}

export function formatChapterNumber(value: number, locale: Locale = activeLocale) {
  const zero = locale === 'ar-EG' ? '٠' : '0';
  const digits = formatNumber(value, locale);
  return value < 10 ? `${zero}${digits}` : digits;
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

export function localizeFrontField(frontId: string, field: 'name' | 'description', fallback: string) {
  return localizeContent('fronts', frontId, field, fallback);
}

export function localizeInstitutionField(institutionId: string, field: 'name', fallback: string) {
  return localizeContent('institutions', institutionId, field, fallback);
}

export function localizeScenarioField(
  scenarioId: string,
  field: 'name' | 'description' | 'introduction' | 'story' | 'dramatization' | 'gameplay' | 'mechanics' | 'moralCenter',
  fallback: string,
) {
  return localizeContent('scenarios', scenarioId, field, fallback);
}

export function localizeScenarioRuleField(
  scenarioId: string,
  ruleId: string,
  field: 'label' | 'description',
  fallback: string,
) {
  return t(`content.scenarios.${scenarioId}.specialRules.${ruleId}.${field}`, fallback);
}

const FRONT_FALLBACKS: Record<string, string> = {
  WAR: 'War & Conflict',
  CLIMATE: 'Climate Crisis',
  RIGHTS: 'Human Rights',
  SPEECH_INFO: 'Speech & Information',
  POVERTY: 'Economic Poverty',
  ENERGY: 'Energy Access',
  CULTURE: 'Art & Culture',
  WarMachine: 'War Machine',
  DyingPlanet: 'Dying Planet',
  GildedCage: 'Gilded Cage',
  SilencedTruth: 'Silenced Truth',
  EmptyStomach: 'Empty Stomach',
  FossilGrip: 'Fossil Grip',
  StolenVoice: 'Stolen Voice',
};

const CIVIC_SPACE_FALLBACKS: Record<string, string> = {
  OPEN: 'Open',
  NARROWED: 'Narrowed',
  REPRESSED: 'Repressed',
  CLOSED: 'Closed',
};

export function getFrontLabel(frontId: string) {
  if (frontId in FRONT_FALLBACKS) {
    return localizeFrontField(frontId, 'name', FRONT_FALLBACKS[frontId]);
  }
  return frontId;
}

export function getRegionLabel(regionId: string) {
  const direct = lookup(`content.regions.${regionId}.name`);
  if (typeof direct === 'string') {
    return direct;
  }

  return t(`content.regionLabels.${regionId}.name`, regionId);
}

export function getCivicSpaceLabel(civicSpace: string) {
  return t(`ui.scenarioBooklet.civicSpaceValues.${civicSpace}`, CIVIC_SPACE_FALLBACKS[civicSpace] ?? civicSpace);
}

export function formatEffectPreview(action: ActionDefinition) {
  return localizeActionField(action.id, 'description', buildEffectPreview(action));
}

export function getLocaleOptions(): Array<{ value: Locale; label: string }> {
  return [
    { value: 'en', label: t('ui.language.locales.en', 'English') },
    { value: 'ar-EG', label: t('ui.language.locales.ar-EG', 'العربية المصرية') },
  ];
}
