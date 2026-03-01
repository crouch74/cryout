import { buildAppPath, parseAppRoute, type AppRoute } from './urlState.ts';

export interface RuntimeOptions {
  defaultPage: 'home' | 'offline';
  forceOfflineOnly: boolean;
  useHashRouting: boolean;
}

export function getRuntimeOptions(): RuntimeOptions {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const offlinePagesBuild = env?.MODE === 'pages' || env?.VITE_PAGES_OFFLINE === 'true';

  return {
    defaultPage: offlinePagesBuild ? 'offline' : 'home',
    forceOfflineOnly: offlinePagesBuild,
    useHashRouting: offlinePagesBuild,
  };
}

function normalizeHashRoute(hash: string) {
  if (!hash) {
    return '/';
  }

  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function coerceRoute(route: AppRoute, runtime: RuntimeOptions): AppRoute {
  if (!runtime.forceOfflineOnly) {
    return route;
  }

  if (route.page === 'guidelines' || route.page === 'player-guide' || route.page === 'offline') {
    return route;
  }

  return {
    page: 'offline',
    scenarioId: route.scenarioId,
    roomId: null,
  };
}

export function parseRuntimeRoute(
  pathname: string,
  hash: string,
  defaultScenarioId: string,
  runtime: RuntimeOptions,
) {
  const sourcePath = runtime.useHashRouting ? normalizeHashRoute(hash) : pathname;
  const parsed = parseAppRoute(sourcePath, defaultScenarioId);

  if (runtime.defaultPage === 'offline' && parsed.page === 'home') {
    return {
      page: 'offline',
      scenarioId: parsed.scenarioId,
      roomId: null,
    } satisfies AppRoute;
  }

  return coerceRoute(parsed, runtime);
}

export function buildRuntimeLocation(route: AppRoute, runtime: RuntimeOptions) {
  const safeRoute = coerceRoute(route, runtime);
  const path = buildAppPath(safeRoute);

  if (runtime.useHashRouting) {
    return `#${path}`;
  }

  return path;
}
