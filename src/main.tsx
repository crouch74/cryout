import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import './index.css';
import App from './App';
import { i18n } from './i18n/index.ts';
import { TabletopThemeProvider } from './mvp/tabletop';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <TabletopThemeProvider>
        <App />
      </TabletopThemeProvider>
    </I18nextProvider>
  </StrictMode>,
);
