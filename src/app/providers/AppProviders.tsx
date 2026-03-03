import type { ReactNode } from 'react';
import { AppI18nProvider } from './I18nProvider.tsx';
import { ThemeProvider } from './ThemeProvider.tsx';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppI18nProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppI18nProvider>
  );
}
