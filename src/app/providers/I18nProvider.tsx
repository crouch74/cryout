import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { i18n } from '../../i18n/index.ts';

export function AppI18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
