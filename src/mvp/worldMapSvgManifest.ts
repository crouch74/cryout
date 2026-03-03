import type { DomainId, RegionId } from '../../engine/index.ts';

export type SvgElementKind = 'path' | 'group' | 'missing';

export interface MapViewport {
  canvasWidth: string;
  canvasHeight: string;
  canvasLeft: string;
  canvasTop: string;
}

export interface SvgPathReference {
  id: string;
  kind: SvgElementKind;
  label: string;
  note?: string;
}

export interface BoardRegionSvgCoverage {
  regionId: RegionId;
  label: string;
  primary: SvgPathReference[];
  nearby: SvgPathReference[];
  searchTerms: string[];
  note: string;
}

export interface BoardRegionMapEntry {
  regionId: RegionId;
  label: string;
  marker: {
    x: string;
    y: string;
  };
  tokenAnchor: {
    x: string;
    y: string;
  };
  anchorBias: {
    x: number;
    y: number;
  };
  clusterRadius: number;
  labelOffsetY: number;
  opticalCenteringByTokenType: Record<'extraction' | 'defense' | 'bodies', { x: number; y: number }>;
  labelOffset: {
    x: string;
    y: string;
  };
  tooltipOffset: {
    x: string;
    y: string;
  };
  territoryTilt: string;
  accent: string;
  searchTerms: string[];
  focusDomains: DomainId[];
  anchorCoverage: string[];
  interactionCoverage: string[];
  svgCoverage: string[];
  note: string;
}

export const WORLD_MAP_SVG_METADATA: {
  assetPath: string;
  sourceViewBox: string;
  viewport: MapViewport;
  idConvention: string;
} = {
  assetPath: '/assets/world-map-board.svg',
  sourceViewBox: '30.767 241.591 784.077 458.627',
  viewport: {
    canvasWidth: '100%',
    canvasHeight: '100%',
    canvasLeft: '0%',
    canvasTop: '0%',
  },
  idConvention: 'ISO 3166-1 alpha-2 country IDs, with some multi-part countries stored as <g> wrappers.',
};

export const SVG_COUNTRY_PATH_INDEX = {
  ao: { id: 'ao', kind: 'group', label: 'Angola' },
  ar: { id: 'ar', kind: 'group', label: 'Argentina' },
  bf: { id: 'bf', kind: 'path', label: 'Burkina Faso' },
  bi: { id: 'bi', kind: 'path', label: 'Burundi' },
  bj: { id: 'bj', kind: 'path', label: 'Benin' },
  bo: { id: 'bo', kind: 'path', label: 'Bolivia' },
  br: { id: 'br', kind: 'path', label: 'Brazil' },
  cd: { id: 'cd', kind: 'path', label: 'Democratic Republic of the Congo' },
  cf: { id: 'cf', kind: 'path', label: 'Central African Republic' },
  cg: { id: 'cg', kind: 'path', label: 'Republic of the Congo' },
  ci: { id: 'ci', kind: 'path', label: "Cote d'Ivoire" },
  cl: { id: 'cl', kind: 'group', label: 'Chile' },
  cm: { id: 'cm', kind: 'path', label: 'Cameroon' },
  cn: { id: 'cn', kind: 'group', label: 'China' },
  co: { id: 'co', kind: 'path', label: 'Colombia' },
  ec: { id: 'ec', kind: 'group', label: 'Ecuador' },
  eg: { id: 'eg', kind: 'path', label: 'Egypt' },
  gh: { id: 'gh', kind: 'path', label: 'Ghana' },
  gm: { id: 'gm', kind: 'path', label: 'Gambia' },
  gn: { id: 'gn', kind: 'path', label: 'Guinea' },
  gw: { id: 'gw', kind: 'path', label: 'Guinea-Bissau' },
  gy: { id: 'gy', kind: 'path', label: 'Guyana' },
  il: { id: 'il', kind: 'path', label: 'Israel / Palestine area', note: 'The SVG has no separate Palestine geometry, so the theatre uses nearby Levant paths.' },
  jo: { id: 'jo', kind: 'path', label: 'Jordan' },
  kh: { id: 'kh', kind: 'path', label: 'Cambodia' },
  la: { id: 'la', kind: 'path', label: 'Laos' },
  lb: { id: 'lb', kind: 'path', label: 'Lebanon' },
  lr: { id: 'lr', kind: 'path', label: 'Liberia' },
  ml: { id: 'ml', kind: 'path', label: 'Mali' },
  mm: { id: 'mm', kind: 'path', label: 'Myanmar' },
  mr: { id: 'mr', kind: 'path', label: 'Mauritania' },
  ne: { id: 'ne', kind: 'path', label: 'Niger' },
  ng: { id: 'ng', kind: 'path', label: 'Nigeria' },
  pe: { id: 'pe', kind: 'path', label: 'Peru' },
  ps: { id: 'ps', kind: 'missing', label: 'Palestine', note: 'No dedicated Palestine path exists in this SVG.' },
  py: { id: 'py', kind: 'path', label: 'Paraguay' },
  rw: { id: 'rw', kind: 'path', label: 'Rwanda' },
  sa: { id: 'sa', kind: 'path', label: 'Saudi Arabia' },
  sd: { id: 'sd', kind: 'path', label: 'Sudan' },
  sl: { id: 'sl', kind: 'path', label: 'Sierra Leone' },
  sn: { id: 'sn', kind: 'path', label: 'Senegal' },
  sr: { id: 'sr', kind: 'path', label: 'Suriname' },
  ss: { id: 'ss', kind: 'path', label: 'South Sudan' },
  sy: { id: 'sy', kind: 'path', label: 'Syria' },
  td: { id: 'td', kind: 'path', label: 'Chad' },
  tg: { id: 'tg', kind: 'path', label: 'Togo' },
  th: { id: 'th', kind: 'path', label: 'Thailand' },
  tz: { id: 'tz', kind: 'path', label: 'Tanzania' },
  ug: { id: 'ug', kind: 'path', label: 'Uganda' },
  uy: { id: 'uy', kind: 'path', label: 'Uruguay' },
  ve: { id: 've', kind: 'path', label: 'Venezuela' },
  vn: { id: 'vn', kind: 'path', label: 'Vietnam' },
  zm: { id: 'zm', kind: 'path', label: 'Zambia' },
} as const satisfies Record<string, SvgPathReference>;

function refs(...ids: Array<keyof typeof SVG_COUNTRY_PATH_INDEX>) {
  return ids.map((id) => SVG_COUNTRY_PATH_INDEX[id]);
}

export const BOARD_REGION_SVG_COVERAGE: Record<RegionId, BoardRegionSvgCoverage> = {
  Congo: {
    regionId: 'Congo',
    label: 'Congo Basin',
    primary: refs('cd', 'cg'),
    nearby: refs('cf', 'cm', 'ug', 'rw', 'bi', 'tz', 'ss', 'ao', 'zm'),
    searchTerms: ['congo', 'drc', 'great lakes', 'equatorial africa', 'cobalt', 'rainforest'],
    note: 'Anchor on the DRC-Congo cluster, then use the Great Lakes and Angola/Zambia edge paths to bound the full basin theatre.',
  },
  Levant: {
    regionId: 'Levant',
    label: 'Levant',
    primary: refs('ps', 'il', 'jo', 'lb', 'sy'),
    nearby: refs('eg', 'sa'),
    searchTerms: ['levant', 'palestine', 'jordan', 'lebanon', 'syria', 'eastern mediterranean'],
    note: 'Use Jordan-Lebanon-Syria-Israel and the Palestine area as the theatre hinge. Egypt and northwest Arabia are nearby anchors only.',
  },
  Amazon: {
    regionId: 'Amazon',
    label: 'Amazon Basin',
    primary: refs('br', 'pe', 'co'),
    nearby: refs('bo', 'ec', 've', 'gy', 'sr'),
    searchTerms: ['amazon', 'brazil', 'peru', 'colombia', 'forest basin'],
    note: 'Use north and northwest Brazil with Peru and Colombia first. Bolivia, Ecuador, Venezuela, Guyana, and Suriname help bound the full basin.',
  },
  Sahel: {
    regionId: 'Sahel',
    label: 'Sahel Belt',
    primary: refs('mr', 'ml', 'bf', 'ne', 'td'),
    nearby: refs('sn', 'gm', 'gn', 'gw', 'sl', 'lr', 'ci', 'gh', 'tg', 'bj', 'ng', 'sd'),
    searchTerms: ['sahel', 'mali', 'niger', 'burkina', 'chad', 'sahel belt'],
    note: 'Start from Mauritania-Mali-Burkina-Niger-Chad as the belt core. West African coast and Sudan are adjacent support paths.',
  },
  Mekong: {
    regionId: 'Mekong',
    label: 'Mekong Corridor',
    primary: refs('th', 'la', 'kh', 'vn'),
    nearby: refs('mm', 'cn'),
    searchTerms: ['mekong', 'thailand', 'laos', 'cambodia', 'vietnam', 'river basin'],
    note: 'Lower Mekong alignment is Thailand-Laos-Cambodia-Vietnam. Myanmar and southwest China help triangulate the upstream edge.',
  },
  Andes: {
    regionId: 'Andes',
    label: 'Andean Spine',
    primary: refs('pe', 'bo', 'cl'),
    nearby: refs('ar', 'ec', 'co', 'py', 'uy'),
    searchTerms: ['andes', 'peru', 'bolivia', 'chile', 'highlands', 'lithium'],
    note: 'Use Peru-Bolivia-Chile for the mountain spine. Argentina, Ecuador, Colombia, Paraguay, and Uruguay are nearby reference paths.',
  },
  Cairo: {
    regionId: 'Cairo', label: 'Cairo',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['cairo'], note: ''
  },
  Alexandria: {
    regionId: 'Alexandria', label: 'Alexandria',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['alexandria'], note: ''
  },
  NileDelta: {
    regionId: 'NileDelta', label: 'Nile Delta',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['nile'], note: ''
  },
  UpperEgypt: {
    regionId: 'UpperEgypt', label: 'Upper Egypt',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['egypt'], note: ''
  },
  Suez: {
    regionId: 'Suez', label: 'Suez',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['suez'], note: ''
  },
  Sinai: {
    regionId: 'Sinai', label: 'Sinai',
    primary: refs('eg'), nearby: refs('eg'), searchTerms: ['sinai'], note: ''
  },
  Tehran: {
    regionId: 'Tehran', label: 'Tehran',
    primary: refs(), nearby: refs(), searchTerms: ['tehran'], note: ''
  },
  Kurdistan: {
    regionId: 'Kurdistan', label: 'Kurdistan',
    primary: refs(), nearby: refs(), searchTerms: ['kurdistan'], note: ''
  },
  Isfahan: {
    regionId: 'Isfahan', label: 'Isfahan',
    primary: refs(), nearby: refs(), searchTerms: ['isfahan'], note: ''
  },
  Mashhad: {
    regionId: 'Mashhad', label: 'Mashhad',
    primary: refs(), nearby: refs(), searchTerms: ['mashhad'], note: ''
  },
  Khuzestan: {
    regionId: 'Khuzestan', label: 'Khuzestan',
    primary: refs(), nearby: refs(), searchTerms: ['khuzestan'], note: ''
  },
  Balochistan: {
    regionId: 'Balochistan', label: 'Balochistan',
    primary: refs(), nearby: refs(), searchTerms: ['balochistan'], note: ''
  },
};


export const BOARD_REGION_MAP_MANIFEST: Record<RegionId, BoardRegionMapEntry> = {
  Congo: {
    regionId: 'Congo',
    label: 'Congo Basin',
    marker: { x: '55.64%', y: '64.66%' },
    tokenAnchor: { x: '55.64%', y: '64.66%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 76,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '28px', y: '-16px' },
    tooltipOffset: { x: '18px', y: '-214px' },
    territoryTilt: '-4deg',
    accent: '#5f7e4d',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Congo.searchTerms,
    focusDomains: ['FossilGrip', 'DyingPlanet'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Congo.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Congo.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Congo.primary, ...BOARD_REGION_SVG_COVERAGE.Congo.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Congo.note,
  },
  Levant: {
    regionId: 'Levant',
    label: 'Levant',
    marker: { x: '60.18%', y: '47.88%' },
    tokenAnchor: { x: '60.18%', y: '47.88%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 68,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '22px', y: '-18px' },
    tooltipOffset: { x: '-34px', y: '-214px' },
    territoryTilt: '3deg',
    accent: '#8c5f56',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Levant.searchTerms,
    focusDomains: ['WarMachine', 'GildedCage', 'SilencedTruth'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Levant.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Levant.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Levant.primary, ...BOARD_REGION_SVG_COVERAGE.Levant.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Levant.note,
  },
  Amazon: {
    regionId: 'Amazon',
    label: 'Amazon',
    marker: { x: '28.25%', y: '69.05%' },
    tokenAnchor: { x: '28.25%', y: '69.05%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 84,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '24px', y: '-18px' },
    tooltipOffset: { x: '-6px', y: '-214px' },
    territoryTilt: '-3deg',
    accent: '#4f7a3b',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Amazon.searchTerms,
    focusDomains: ['DyingPlanet', 'FossilGrip', 'StolenVoice'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Amazon.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Amazon.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Amazon.primary, ...BOARD_REGION_SVG_COVERAGE.Amazon.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Amazon.note,
  },
  Sahel: {
    regionId: 'Sahel',
    label: 'Sahel',
    marker: { x: '51.17%', y: '54.65%' },
    tokenAnchor: { x: '51.17%', y: '54.65%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 74,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '18px', y: '-16px' },
    tooltipOffset: { x: '-4px', y: '-206px' },
    territoryTilt: '2deg',
    accent: '#ab7e4a',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Sahel.searchTerms,
    focusDomains: ['EmptyStomach', 'DyingPlanet', 'WarMachine'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Sahel.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Sahel.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Sahel.primary, ...BOARD_REGION_SVG_COVERAGE.Sahel.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Sahel.note,
  },
  Mekong: {
    regionId: 'Mekong',
    label: 'Mekong',
    marker: { x: '77.08%', y: '42.74%' },
    tokenAnchor: { x: '77.08%', y: '42.74%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 70,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '24px', y: '-16px' },
    tooltipOffset: { x: '-136px', y: '-212px' },
    territoryTilt: '4deg',
    accent: '#4f8190',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Mekong.searchTerms,
    focusDomains: ['FossilGrip', 'SilencedTruth', 'DyingPlanet'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Mekong.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Mekong.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Mekong.primary, ...BOARD_REGION_SVG_COVERAGE.Mekong.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Mekong.note,
  },
  Andes: {
    regionId: 'Andes',
    label: 'Andes',
    marker: { x: '25.94%', y: '77.12%' },
    tokenAnchor: { x: '25.94%', y: '77.12%' },
    anchorBias: { x: 0, y: 0 },
    clusterRadius: 72,
    labelOffsetY: -14,
    opticalCenteringByTokenType: {
      extraction: { x: 0, y: -1 },
      defense: { x: 0, y: 0 },
      bodies: { x: 0, y: 0.5 },
    },
    labelOffset: { x: '18px', y: '-18px' },
    tooltipOffset: { x: '18px', y: '-208px' },
    territoryTilt: '-5deg',
    accent: '#84645f',
    searchTerms: BOARD_REGION_SVG_COVERAGE.Andes.searchTerms,
    focusDomains: ['GildedCage', 'EmptyStomach', 'FossilGrip', 'StolenVoice'],
    anchorCoverage: BOARD_REGION_SVG_COVERAGE.Andes.primary.map((entry) => entry.id),
    interactionCoverage: BOARD_REGION_SVG_COVERAGE.Andes.primary.map((entry) => entry.id),
    svgCoverage: [...BOARD_REGION_SVG_COVERAGE.Andes.primary, ...BOARD_REGION_SVG_COVERAGE.Andes.nearby].map((entry) => entry.id),
    note: BOARD_REGION_SVG_COVERAGE.Andes.note,
  },
  Cairo: {
    regionId: 'Cairo', label: 'Cairo', marker: { x: '620px', y: '340px' }, tokenAnchor: { x: '620px', y: '340px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Alexandria: {
    regionId: 'Alexandria', label: 'Alexandria', marker: { x: '600px', y: '310px' }, tokenAnchor: { x: '600px', y: '310px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  NileDelta: {
    regionId: 'NileDelta', label: 'Nile Delta', marker: { x: '615px', y: '325px' }, tokenAnchor: { x: '615px', y: '325px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  UpperEgypt: {
    regionId: 'UpperEgypt', label: 'Upper Egypt', marker: { x: '630px', y: '370px' }, tokenAnchor: { x: '630px', y: '370px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Suez: {
    regionId: 'Suez', label: 'Suez', marker: { x: '645px', y: '335px' }, tokenAnchor: { x: '645px', y: '335px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Sinai: {
    regionId: 'Sinai', label: 'Sinai', marker: { x: '660px', y: '340px' }, tokenAnchor: { x: '660px', y: '340px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Tehran: {
    regionId: 'Tehran', label: 'Tehran', marker: { x: '730px', y: '320px' }, tokenAnchor: { x: '730px', y: '320px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Kurdistan: {
    regionId: 'Kurdistan', label: 'Kurdistan', marker: { x: '710px', y: '300px' }, tokenAnchor: { x: '710px', y: '300px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Isfahan: {
    regionId: 'Isfahan', label: 'Isfahan', marker: { x: '745px', y: '330px' }, tokenAnchor: { x: '745px', y: '330px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Mashhad: {
    regionId: 'Mashhad', label: 'Mashhad', marker: { x: '770px', y: '315px' }, tokenAnchor: { x: '770px', y: '315px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Khuzestan: {
    regionId: 'Khuzestan', label: 'Khuzestan', marker: { x: '725px', y: '345px' }, tokenAnchor: { x: '725px', y: '345px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
  Balochistan: {
    regionId: 'Balochistan', label: 'Balochistan', marker: { x: '760px', y: '360px' }, tokenAnchor: { x: '760px', y: '360px' },
    anchorBias: { x: 0, y: 0 }, clusterRadius: 72, labelOffsetY: -14, opticalCenteringByTokenType: { extraction: { x: 0, y: -1 }, defense: { x: 0, y: 0 }, bodies: { x: 0, y: 0.5 } },
    labelOffset: { x: '18px', y: '-18px' }, tooltipOffset: { x: '18px', y: '-208px' }, territoryTilt: '0deg', accent: '#84645f', searchTerms: [], focusDomains: [],
    anchorCoverage: [], interactionCoverage: [], svgCoverage: [], note: ''
  },
};


export function getBoardRegionSvgPathIds(regionId: RegionId) {
  return BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage.filter((id) => SVG_COUNTRY_PATH_INDEX[id as keyof typeof SVG_COUNTRY_PATH_INDEX]?.kind !== 'missing');
}

export function getBoardRegionAnchorPathIds(regionId: RegionId) {
  return BOARD_REGION_MAP_MANIFEST[regionId].anchorCoverage.filter((id) => SVG_COUNTRY_PATH_INDEX[id as keyof typeof SVG_COUNTRY_PATH_INDEX]?.kind !== 'missing');
}

export function getBoardRegionInteractionPathIds(regionId: RegionId) {
  return BOARD_REGION_MAP_MANIFEST[regionId].interactionCoverage.filter((id) => SVG_COUNTRY_PATH_INDEX[id as keyof typeof SVG_COUNTRY_PATH_INDEX]?.kind !== 'missing');
}
