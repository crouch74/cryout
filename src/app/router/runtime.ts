import { buildAppPath, parseAppRoute, type AppRoute } from './pathState.ts';

export interface AppRuntimeOptions {
  defaultPage: 'home' | 'offline';
  forceOfflineOnly: boolean;
  useHashRouting: boolean;
  devtoolsEnabled: boolean;
}

export function getRuntimeOptions(): AppRuntimeOptions {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const offlinePagesBuild = env?.MODE === 'pages' || env?.VITE_PAGES_OFFLINE === 'true';

  return {
    defaultPage: offlinePagesBuild ? 'offline' : 'home',
    forceOfflineOnly: offlinePagesBuild,
    useHashRouting: offlinePagesBuild,
    devtoolsEnabled: env?.DEV === true || env?.VITE_ENABLE_DEVTOOLS === 'true',
  };
}

function normalizeHashRoute(hash: string) {
  if (!hash) {
    return '/';
  }

  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function coerceRoute(route: AppRoute, runtime: AppRuntimeOptions): AppRoute {
  if (!runtime.forceOfflineOnly) {
    return route;
  }

  if (route.page === 'guidelines' || route.page === 'player-guide' || route.page === 'offline') {
    return route;
  }

  return { page: 'offline', rulesetId: route.rulesetId, roomId: null };
}

export function parseRuntimeRoute(
  pathname: string,
  hash: string,
  defaultRulesetId: string,
  runtime: AppRuntimeOptions,
) {
  const source = runtime.useHashRouting ? normalizeHashRoute(hash) : pathname;
  const parsed = parseAppRoute(source, defaultRulesetId);
  if (runtime.defaultPage === 'offline' && parsed.page === 'home') {
    return { page: 'offline', rulesetId: parsed.rulesetId, roomId: null } satisfies AppRoute;
  }
  return coerceRoute(parsed, runtime);
}

export function buildRuntimeLocation(route: AppRoute, runtime: AppRuntimeOptions) {
  const safeRoute = coerceRoute(route, runtime);
  const path = buildAppPath(safeRoute);
  return runtime.useHashRouting ? `#${path}` : path;
}
