import { buildAppPath, parseAppRoute, type AppRoute } from './urlState.ts';

export interface RuntimeOptions {
  defaultPage: 'home' | 'offline';
  forceOfflineOnly: boolean;
  useHashRouting: boolean;
  devMode: boolean;
}

export function getRuntimeOptions(): RuntimeOptions {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const offlinePagesBuild = env?.MODE === 'pages' || env?.VITE_PAGES_OFFLINE === 'true';
  const releaseBuild = env?.VITE_RELEASE === 'true' || offlinePagesBuild;
  return {
    defaultPage: offlinePagesBuild ? 'offline' : 'home',
    forceOfflineOnly: offlinePagesBuild,
    useHashRouting: offlinePagesBuild,
    devMode: !releaseBuild,
  };
}

function normalizeHashRoute(hash: string) {
  if (!hash) {
    return '/';
  }
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function coerceRoute(route: AppRoute, runtime: RuntimeOptions): AppRoute {
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
  runtime: RuntimeOptions,
) {
  const source = runtime.useHashRouting ? normalizeHashRoute(hash) : pathname;
  const parsed = parseAppRoute(source, defaultRulesetId);
  if (runtime.defaultPage === 'offline' && parsed.page === 'home') {
    return { page: 'offline', rulesetId: parsed.rulesetId, roomId: null } satisfies AppRoute;
  }
  return coerceRoute(parsed, runtime);
}

export function buildRuntimeLocation(route: AppRoute, runtime: RuntimeOptions) {
  const safeRoute = coerceRoute(route, runtime);
  const path = buildAppPath(safeRoute);
  return runtime.useHashRouting ? `#${path}` : path;
}
