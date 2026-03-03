import { BrowserRouter, HashRouter } from 'react-router-dom';
import { getRuntimeOptions } from './runtime.ts';
import { AppRoutes } from './routes.tsx';

export function AppRouter() {
  const runtime = getRuntimeOptions();
  const Router = runtime.useHashRouting ? HashRouter : BrowserRouter;

  return (
    <Router>
      <AppRoutes runtime={runtime} />
    </Router>
  );
}
