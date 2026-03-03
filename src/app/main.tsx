import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './providers/AppProviders.tsx';
import { AppRouter } from './router/createRouter.tsx';
import { ErrorBoundary } from './shell/ErrorBoundary.tsx';

export function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProviders>
          <AppRouter />
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  );
}
