import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { TabletopThemeProvider } from './mvp/tabletop'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TabletopThemeProvider>
      <App />
    </TabletopThemeProvider>
  </StrictMode>,
)
