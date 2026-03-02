import { getLocaleOptions, type Locale, t } from '../i18n/index.ts';

interface LanguageSwitcherProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onChange }: LanguageSwitcherProps) {
  const localeOptions = getLocaleOptions();

  return (
    <label className="locale-switcher">
      <span className="eyebrow">{t('ui.language.label', 'Language')}</span>
      <select
        value={locale}
        onChange={(event) => onChange(event.target.value as Locale)}
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
