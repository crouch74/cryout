import type {
  ActionDefinition,
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

const numberFormatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat('en'),
  'ar-EG': new Intl.NumberFormat('ar-EG-u-nu-arab'),
};

function getCatalog() {
  return catalogs[activeLocale];
}

function getNumberFormatter(locale: Locale = activeLocale) {
  return numberFormatters[locale];
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

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (typeof value === 'number') {
      return formatNumber(value);
    }

    return String(value ?? '');
  });
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

export function formatNumber(value: number, locale: Locale = activeLocale): string {
  return getNumberFormatter(locale).format(value);
}

export function formatTemperature(value: number, locale: Locale = activeLocale): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value, locale)}°C`;
}

export function formatEffectPreview(action: ActionDefinition, content: CompiledContent): string {
  return action.effects
    .slice(0, 3)
    .map((effect) => {
      switch (effect.type) {
        case 'modify_front_stat':
          return t('ui.effectPreview.modifyFrontStat', '{{front}} {{stat}} {{delta}}', {
            front:
              effect.front === 'target_front'
                ? t('ui.effectPreview.targetFront', 'target front')
                : content.fronts[effect.front].name,
            stat: t(`ui.game.${effect.stat}`, effect.stat),
            delta: effect.delta,
          });
        case 'modify_track':
          if (effect.target.type === 'temperature') {
            return t('ui.effectPreview.temperature', 'Temperature {{delta}}', { delta: effect.delta });
          }
          if (effect.target.type === 'player_burnout') {
            return t('ui.effectPreview.burnout', 'Burnout {{delta}}', { delta: effect.delta });
          }
          return t('ui.effectPreview.trackChange', 'Track change');
        case 'add_token':
          return t('ui.effectPreview.addToken', '+{{count}} {{token}}', {
            count: effect.count,
            token: t(`ui.effectTokens.${effect.token}`, effect.token),
          });
        case 'remove_token':
          return t('ui.effectPreview.removeToken', '-{{count}} {{token}}', {
            count: effect.count,
            token: t(`ui.effectTokens.${effect.token}`, effect.token),
          });
        case 'add_lock':
          return t('ui.effectPreview.addLock', 'Add {{lock}}', {
            lock: t(`ui.effectLocks.${effect.lock}`, effect.lock),
          });
        case 'remove_lock':
          return t('ui.effectPreview.removeLock', 'Remove {{lock}}', {
            lock: t(`ui.effectLocks.${effect.lock}`, effect.lock),
          });
        case 'gain_resource':
          return t('ui.effectPreview.gainResource', '+{{count}} {{resource}}', {
            count: effect.amount,
            resource: t(`ui.game.${effect.resource}`, effect.resource),
          });
        case 'spend_resource':
          return t('ui.effectPreview.spendResource', '-{{count}} {{resource}}', {
            count: effect.amount,
            resource: t(`ui.game.${effect.resource}`, effect.resource),
          });
        case 'draw_from_deck':
          return t('ui.effectPreview.drawFromDeck', 'Draw {{count}} {{deck}}', {
            count: effect.count,
            deck: t(`ui.decks.${effect.deck}`, effect.deck),
          });
        case 'ensure_institution':
          return t('ui.effectPreview.buildInstitution', 'Build {{institution}}', {
            institution: content.institutions[effect.institution].name,
          });
        case 'add_charter_progress':
          return t('ui.effectPreview.charterProgress', '+{{count}} charter progress', { count: effect.amount });
        case 'ratify_first_available_charter':
          return t('ui.effectPreview.ratifyClause', 'Ratify a clause');
        case 'choice':
          return t('ui.effectPreview.offerCompromise', 'Offer compromise');
        case 'delayed_effect':
          return t('ui.effectPreview.delayedEffect', 'Delayed {{rounds}}r', { rounds: effect.afterRounds });
        case 'set_flag':
          return effect.key.startsWith('truth_window')
            ? t('ui.effectPreview.openTruthWindow', 'Open truth window')
            : t('ui.effectPreview.setFlag', 'Set flag');
        case 'conditional':
          return t('ui.effectPreview.conditionalEffect', 'Conditional effect');
        case 'log':
          return effect.message;
        case 'repair_institution':
          return t('ui.effectPreview.repairInstitution', 'Repair {{institution}}', {
            institution: content.institutions[effect.institution].name,
          });
        case 'damage_institution':
          return t('ui.effectPreview.damageInstitution', 'Damage institution');
      }
    })
    .join(' • ');
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
