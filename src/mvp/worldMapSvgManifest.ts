import type { RegionId } from '../../engine/index.ts';

export type SvgElementKind = 'path' | 'group' | 'missing';

export interface SvgPathReference {
  id: string;
  kind: SvgElementKind;
  label: string;
  note?: string;
}

export interface BoardRegionSvgManifestEntry {
  regionId: RegionId;
  label: string;
  primary: SvgPathReference[];
  nearby: SvgPathReference[];
  searchTerms: string[];
  note?: string;
}

export const WORLD_MAP_SVG_METADATA = {
  assetPath: '/assets/world-map-board.svg',
  viewBox: '30.767 241.591 784.077 458.627',
  idConvention: 'ISO 3166-1 alpha-2 where available; some multi-part countries use <g> wrappers.',
} as const;

const SVG_PATHS = {
  ae: { id: 'ae', kind: 'path', label: 'United Arab Emirates' },
  ao: { id: 'ao', kind: 'group', label: 'Angola' },
  bf: { id: 'bf', kind: 'path', label: 'Burkina Faso' },
  bi: { id: 'bi', kind: 'path', label: 'Burundi' },
  bh: { id: 'bh', kind: 'missing', label: 'Bahrain', note: 'No dedicated Bahrain path exists in this SVG.' },
  cd: { id: 'cd', kind: 'path', label: 'Democratic Republic of the Congo' },
  cf: { id: 'cf', kind: 'path', label: 'Central African Republic' },
  cg: { id: 'cg', kind: 'path', label: 'Republic of the Congo' },
  cm: { id: 'cm', kind: 'path', label: 'Cameroon' },
  dj: { id: 'dj', kind: 'path', label: 'Djibouti' },
  dz: { id: 'dz', kind: 'path', label: 'Algeria' },
  eg: { id: 'eg', kind: 'path', label: 'Egypt' },
  er: { id: 'er', kind: 'path', label: 'Eritrea' },
  et: { id: 'et', kind: 'path', label: 'Ethiopia' },
  il: { id: 'il', kind: 'path', label: 'Israel' },
  iq: { id: 'iq', kind: 'path', label: 'Iraq' },
  jo: { id: 'jo', kind: 'path', label: 'Jordan' },
  kw: { id: 'kw', kind: 'path', label: 'Kuwait' },
  lb: { id: 'lb', kind: 'path', label: 'Lebanon' },
  ly: { id: 'ly', kind: 'path', label: 'Libya' },
  ml: { id: 'ml', kind: 'path', label: 'Mali' },
  mr: { id: 'mr', kind: 'path', label: 'Mauritania' },
  ne: { id: 'ne', kind: 'path', label: 'Niger' },
  ng: { id: 'ng', kind: 'path', label: 'Nigeria' },
  om: { id: 'om', kind: 'path', label: 'Oman' },
  ps: {
    id: 'ps',
    kind: 'missing',
    label: 'Palestine',
    note: 'This SVG does not contain separate West Bank or Gaza paths; use adjacent Levant paths plus a manual anchor.',
  },
  qa: { id: 'qa', kind: 'path', label: 'Qatar' },
  rw: { id: 'rw', kind: 'path', label: 'Rwanda' },
  sa: { id: 'sa', kind: 'path', label: 'Saudi Arabia' },
  sd: { id: 'sd', kind: 'path', label: 'Sudan' },
  ss: { id: 'ss', kind: 'path', label: 'South Sudan' },
  sy: { id: 'sy', kind: 'path', label: 'Syria' },
  td: { id: 'td', kind: 'path', label: 'Chad' },
  tz: { id: 'tz', kind: 'path', label: 'Tanzania' },
  ug: { id: 'ug', kind: 'path', label: 'Uganda' },
  ye: { id: 'ye', kind: 'group', label: 'Yemen' },
  zm: { id: 'zm', kind: 'path', label: 'Zambia' },
} as const satisfies Record<string, SvgPathReference>;

function refs(...ids: Array<keyof typeof SVG_PATHS>) {
  return ids.map((id) => SVG_PATHS[id]);
}

export const BOARD_REGION_SVG_MANIFEST: Record<RegionId, BoardRegionSvgManifestEntry> = {
  Palestine: {
    regionId: 'Palestine',
    label: 'Palestine',
    primary: refs('ps'),
    nearby: refs('il', 'jo', 'eg', 'lb'),
    searchTerms: ['palestine', 'gaza', 'west bank', 'levant', 'israel', 'jordan'],
    note: 'Use the Gaza / West Bank area as a manual anchor because the SVG has no dedicated Palestine geometry.',
  },
  Lebanon: {
    regionId: 'Lebanon',
    label: 'Lebanon',
    primary: refs('lb'),
    nearby: refs('sy', 'il', 'jo'),
    searchTerms: ['lebanon', 'beirut', 'levant', 'eastern mediterranean'],
  },
  Egypt: {
    regionId: 'Egypt',
    label: 'Egypt',
    primary: refs('eg'),
    nearby: refs('ly', 'sd', 'il', 'jo', 'sa'),
    searchTerms: ['egypt', 'nile', 'suez', 'sinai', 'red sea'],
  },
  Sudan: {
    regionId: 'Sudan',
    label: 'Sudan',
    primary: refs('sd'),
    nearby: refs('ss', 'td', 'eg', 'ly', 'er', 'et', 'cf'),
    searchTerms: ['sudan', 'khartoum', 'darfur', 'nilotic corridor'],
  },
  Congo: {
    regionId: 'Congo',
    label: 'Congo',
    primary: refs('cd'),
    nearby: refs('cg', 'cf', 'cm', 'ao', 'rw', 'bi', 'ug', 'tz', 'zm', 'ss'),
    searchTerms: ['congo', 'drc', 'kivu', 'great lakes', 'equatorial africa'],
  },
  Yemen: {
    regionId: 'Yemen',
    label: 'Yemen',
    primary: refs('ye'),
    nearby: refs('sa', 'om', 'dj', 'er'),
    searchTerms: ['yemen', 'aden', 'sanaa', 'red sea gate', 'arabian peninsula'],
  },
  Sahel: {
    regionId: 'Sahel',
    label: 'Sahel',
    primary: refs('mr', 'ml', 'ne', 'td', 'bf'),
    nearby: refs('ly', 'dz', 'ng', 'sd'),
    searchTerms: ['sahel', 'agadez', 'niger', 'mali', 'burkina', 'mauritania', 'chad'],
    note: 'The game region is a multi-country belt; search the Mauritania-Mali-Niger-Chad chain first.',
  },
  GulfStates: {
    regionId: 'GulfStates',
    label: 'Gulf States',
    primary: refs('sa', 'ae', 'qa', 'om', 'kw', 'bh'),
    nearby: refs('iq', 'jo', 'ye'),
    searchTerms: ['gulf', 'gulf states', 'oil spine', 'arabian gulf', 'saudi', 'uae', 'qatar', 'oman', 'kuwait'],
    note: 'Bahrain is missing in the SVG, so use Saudi, Qatar, UAE, Kuwait, and Oman to bound the region.',
  },
};

export const MAP_THEATRE_SVG_GROUPS = {
  levant: refs('ps', 'il', 'lb', 'jo', 'sy'),
  nileCorridor: refs('eg', 'sd', 'ss', 'er', 'et'),
  kivuBelt: refs('cd', 'cg', 'rw', 'bi', 'ug'),
  sahelBelt: refs('mr', 'ml', 'ne', 'td', 'bf'),
  gulf: refs('sa', 'ae', 'qa', 'om', 'kw', 'bh'),
  redSea: refs('eg', 'sd', 'er', 'dj', 'ye', 'sa'),
} as const;

export const BOARD_REGION_MAP_POINTS: Record<RegionId, { x: string; y: string }> = {
  Palestine: { x: '58.6%', y: '45.5%' },
  Lebanon: { x: '58.3%', y: '43.8%' },
  Egypt: { x: '57.1%', y: '48%' },
  Sudan: { x: '57.3%', y: '54.2%' },
  Congo: { x: '54.8%', y: '65.6%' },
  Yemen: { x: '62.9%', y: '54.4%' },
  Sahel: { x: '48.9%', y: '53.6%' },
  GulfStates: { x: '62.2%', y: '49.4%' },
};

export function getBoardRegionSvgPathIds(regionId: RegionId) {
  const entry = BOARD_REGION_SVG_MANIFEST[regionId];
  return [...entry.primary, ...entry.nearby]
    .filter((path) => path.kind !== 'missing')
    .map((path) => path.id);
}
