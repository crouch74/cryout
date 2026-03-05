import i18n, { type Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next, useTranslation } from 'react-i18next';
import enCatalog from './en.json' with { type: 'json' };
import frCatalog from './fr.json' with { type: 'json' };
import arCatalog from './ar.json' with { type: 'json' };
import arEGCatalog from './ar-EG.json' with { type: 'json' };
import type { ActionDefinition } from '../engine/index.ts';

type InterpolationValue = string | number;
export type Locale = 'en' | 'fr' | 'ar' | 'ar-EG';

export const LOCALE_STORAGE_KEY = 'stones-cutover-locale';

const resources = {
  en: { translation: enCatalog },
  fr: { translation: frCatalog },
  ar: { translation: arCatalog },
  'ar-EG': { translation: arEGCatalog },
} satisfies Resource;

const LOCALE_META: Record<Locale, { dir: 'ltr' | 'rtl'; intlLocale: string; zero: string }> = {
  en: { dir: 'ltr', intlLocale: 'en', zero: '0' },
  fr: { dir: 'ltr', intlLocale: 'fr', zero: '0' },
  ar: { dir: 'rtl', intlLocale: 'ar-u-nu-arab', zero: '٠' },
  'ar-EG': { dir: 'rtl', intlLocale: 'ar-EG-u-nu-arab', zero: '٠' },
};

const LOCALE_AUTONYMS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية الفصحى',
  'ar-EG': 'العربية المصرية',
};

const numberFormatters = new Map<Locale, Intl.NumberFormat>();

function getNumberFormatter(locale: Locale) {
  const cached = numberFormatters.get(locale);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(LOCALE_META[locale].intlLocale);
  numberFormatters.set(locale, formatter);
  return formatter;
}

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'fr' || value === 'ar' || value === 'ar-EG';
}

function normalizeLocale(value?: string | null): Locale {
  if (!value) {
    return 'en';
  }
  const normalized = value.toLowerCase();
  if (isLocale(value)) {
    return value;
  }
  if (normalized.startsWith('fr')) {
    return 'fr';
  }
  if (normalized.startsWith('ar-eg')) {
    return 'ar-EG';
  }
  if (normalized.startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

function getActiveLocale() {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
}

function normalizeInterpolationValues(values: Record<string, InterpolationValue> | undefined, locale: Locale) {
  if (!values) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'number' ? formatNumber(value, locale) : value,
    ]),
  );
}

await i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'ar', 'ar-EG'],
    defaultNS: 'translation',
    ns: ['translation'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
    // Keep simulation and CLI output focused on game diagnostics.
    showSupportNotice: false,
  });

if (process.env.SIMULATION_WORKER !== '1') {
  console.log(`🌍 [i18n] Runtime initialized for locale: ${getActiveLocale()}`);
}

export async function changeLocale(locale: Locale) {
  if (process.env.SIMULATION_WORKER !== '1') {
    console.log(`🌍 [i18n] Changing locale to: ${locale}`);
  }
  await i18n.changeLanguage(locale);
}

export function getLocaleDirection(locale: Locale = getActiveLocale()): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir;
}

export function isRtlLocale(locale: Locale = getActiveLocale()) {
  return getLocaleDirection(locale) === 'rtl';
}

export function t(path: string, fallback: string, values?: Record<string, InterpolationValue>) {
  const locale = getActiveLocale();
  return String(i18n.t(path, {
    defaultValue: fallback,
    ...normalizeInterpolationValues(values, locale),
  }));
}

export function formatNumber(value: number, locale: Locale = getActiveLocale()) {
  return getNumberFormatter(locale).format(value);
}

export function formatTrackFraction(current: number, max: number, locale: Locale = getActiveLocale()) {
  const currentText = formatNumber(current, locale);
  const maxText = formatNumber(max, locale);
  return getLocaleDirection(locale) === 'rtl'
    ? `${maxText}/${currentText}`
    : `${currentText}/${maxText}`;
}

export function formatChapterNumber(value: number, locale: Locale = getActiveLocale()) {
  const digits = formatNumber(value, locale);
  return value < 10 ? `${LOCALE_META[locale].zero}${digits}` : digits;
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
  FossilGrip: 'Fossil Grip',
  StolenVoice: 'Stolen Voice',
  RevolutionaryWave: 'Revolutionary Wave',
  PatriarchalGrip: 'Patriarchal Grip',
  UnfinishedJustice: 'Unfinished Justice',
  WarMachine: 'War Machine',
  DyingPlanet: 'Dying Planet',
  GildedCage: 'Gilded Cage',
  SilencedTruth: 'Silenced Truth',
  EmptyStomach: 'Empty Stomach',
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
  const key = `content.regions.${regionId}.name`;
  return i18n.exists(key) ? t(key, regionId) : t(`content.regionLabels.${regionId}.name`, regionId);
}

export function getCivicSpaceLabel(civicSpace: string) {
  return t(`ui.scenarioBooklet.civicSpaceValues.${civicSpace}`, CIVIC_SPACE_FALLBACKS[civicSpace] ?? civicSpace);
}

export function formatEffectPreview(action: ActionDefinition) {
  return localizeActionField(action.id, 'description', action.description);
}

export function getLocaleOptions(): Array<{ value: Locale; label: string }> {
  return [
    { value: 'en', label: LOCALE_AUTONYMS.en },
    { value: 'fr', label: LOCALE_AUTONYMS.fr },
    { value: 'ar', label: LOCALE_AUTONYMS.ar },
    { value: 'ar-EG', label: LOCALE_AUTONYMS['ar-EG'] },
  ];
}

export function useAppLocale() {
  const { i18n: runtime } = useTranslation();
  const locale = normalizeLocale(runtime.resolvedLanguage ?? runtime.language);
  const dir = getLocaleDirection(locale);

  return {
    locale,
    dir,
    changeLocale,
    formatNumber: (value: number) => formatNumber(value, locale),
    formatTrackFraction: (current: number, max: number) => formatTrackFraction(current, max, locale),
    formatChapterNumber: (value: number) => formatChapterNumber(value, locale),
    localeOptions: getLocaleOptions(),
  };
}

export { i18n };
