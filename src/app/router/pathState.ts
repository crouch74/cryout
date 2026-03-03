export interface AppRoute {
  page: 'home' | 'guidelines' | 'player-guide' | 'offline' | 'room';
  rulesetId: string;
  roomId: string | null;
}

function decodePathSegment(value: string | undefined) {
  return value ? decodeURIComponent(value) : null;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export function parseAppRoute(pathname: string, defaultRulesetId: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'guidelines') {
    return { page: 'guidelines', rulesetId: defaultRulesetId, roomId: null };
  }

  if (segments[0] === 'player-guide') {
    return { page: 'player-guide', rulesetId: defaultRulesetId, roomId: null };
  }

  if (segments[0] === 'offline') {
    return { page: 'offline', rulesetId: defaultRulesetId, roomId: null };
  }

  if (segments[0] === 'rooms' && segments[1]) {
    return {
      page: 'room',
      rulesetId: defaultRulesetId,
      roomId: decodePathSegment(segments[1]),
    };
  }

  return {
    page: 'home',
    rulesetId: defaultRulesetId,
    roomId: null,
  };
}

export function buildAppPath(route: AppRoute) {
  switch (route.page) {
    case 'guidelines':
      return '/guidelines';
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
