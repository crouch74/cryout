import { t, useAppLocale } from '../i18n/index.ts';

export function LanguageSwitcher() {
  const { changeLocale, locale, localeOptions } = useAppLocale();

  return (
    <label className="locale-switcher">
      <span className="eyebrow">{t('ui.language.label', 'Language')}</span>
      <select
        value={locale}
        onChange={(event) => {
          void changeLocale(event.target.value as typeof locale);
        }}
        aria-label={t('ui.language.label', 'Language')}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
