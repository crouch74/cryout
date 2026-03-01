import type { GameMode, RegionId, RoleId } from '../../engine/index.ts';

export interface SetupConfig {
  surface: 'local' | 'room';
  scenarioId: string;
  mode: GameMode;
  playerCount: 2 | 3 | 4;
  roleIds: RoleId[];
  seed: number;
  roomUrl: string;
  expansionIds: string[];
}

export interface GameViewState {
  focusedSeat: number;
  regionId: RegionId | null;
  eventSeq: number | null;
  showDebug: boolean;
  leftTab: 'scenario' | 'fronts' | 'charter';
  rightTab: 'actions' | 'log';
  spotlight: string | null;
}

export interface AppRoute {
  page: 'home' | 'guidelines' | 'player-guide' | 'offline' | 'room';
  scenarioId: string;
  roomId: string | null;
}

export const DEFAULT_GAME_VIEW_STATE: GameViewState = {
  focusedSeat: 0,
  regionId: null,
  eventSeq: null,
  showDebug: false,
  leftTab: 'fronts',
  rightTab: 'actions',
  spotlight: null,
};

function decodePathSegment(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export function parseAppRoute(pathname: string, defaultScenarioId: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'guidelines') {
    return {
      page: 'guidelines',
      scenarioId: decodePathSegment(segments[1]) ?? defaultScenarioId,
      roomId: null,
    };
  }

  if (segments[0] === 'player-guide') {
    return {
      page: 'player-guide',
      scenarioId: defaultScenarioId,
      roomId: null,
    };
  }

  if (segments[0] === 'offline') {
    return {
      page: 'offline',
      scenarioId: defaultScenarioId,
      roomId: null,
    };
  }

  if (segments[0] === 'rooms' && segments[1]) {
    return {
      page: 'room',
      scenarioId: defaultScenarioId,
      roomId: decodePathSegment(segments[1]),
    };
  }

  return {
    page: 'home',
    scenarioId: defaultScenarioId,
    roomId: null,
  };
}

export function buildAppPath(route: AppRoute) {
  switch (route.page) {
    case 'guidelines':
      return `/guidelines/${encodePathSegment(route.scenarioId)}`;
    case 'player-guide':
      return '/player-guide';
    case 'offline':
      return '/offline';
    case 'room':
      return route.roomId ? `/rooms/${encodePathSegment(route.roomId)}` : '/';
    case 'home':
    default:
      return '/';
  }
}
