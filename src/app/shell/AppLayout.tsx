import type { ReactNode } from 'react';

export function AppLayout({
  locale,
  dir,
  children,
}: {
  locale: string;
  dir: 'ltr' | 'rtl';
  children: ReactNode;
}) {
  return (
    <div className="app-root" dir={dir} lang={locale}>
      {children}
    </div>
  );
}
