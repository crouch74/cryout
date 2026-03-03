import type { RegionId } from '../../engine/index.ts';
import { baseWorldBoard } from './boards/baseWorldBoard.ts';
import { tahrirBoard } from './boards/tahrirBoard.ts';
import { womanLifeFreedomBoard } from './boards/womanLifeFreedomBoard.ts';

const BOARD_REGION_MAP_MANIFEST = {
  ...baseWorldBoard.regions,
  ...tahrirBoard.regions,
  ...womanLifeFreedomBoard.regions,
};

export interface BoardRegionBlueprint {
  label: string;
  shortLabel: string;
  strapline: string;
  themeClass: string;
  accent: string;
  tilt: number;
  mapPoint: {
    x: string;
    y: string;
  };
  desktopCallout: {
    labelX: string;
    labelY: string;
    tooltipX: string;
    tooltipY: string;
  };
  compactCallout: {
    labelX: string;
    labelY: string;
    tooltipX: string;
    tooltipY: string;
  };
}

export const BOARD_REGION_BLUEPRINT: Record<RegionId, BoardRegionBlueprint> = {
  Congo: {
    label: 'Congo',
    shortLabel: 'Kivu Belt',
    strapline: 'Minerals, forests, militias',
    themeClass: 'region-theme-sub-saharan-africa',
    accent: '#8b7a52',
    tilt: 3,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Congo.marker,
    desktopCallout: { labelX: '-8px', labelY: '42px', tooltipX: '-92px', tooltipY: '74px' },
    compactCallout: { labelX: '-8px', labelY: '34px', tooltipX: '-78px', tooltipY: '64px' },
  },
  Levant: {
    label: 'Levant',
    shortLabel: 'Levant',
    strapline: 'Occupation, siege, witness',
    themeClass: 'region-theme-north-america',
    accent: '#b86c5f',
    tilt: -3,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Levant.marker,
    desktopCallout: { labelX: '54px', labelY: '-22px', tooltipX: '104px', tooltipY: '-86px' },
    compactCallout: { labelX: '38px', labelY: '-18px', tooltipX: '82px', tooltipY: '-72px' },
  },
  Amazon: {
    label: 'Amazon',
    shortLabel: 'Amazon',
    strapline: 'Forest defense against land theft.',
    themeClass: 'region-theme-latin-america',
    accent: '#4f7a3b',
    tilt: -3,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Amazon.marker,
    desktopCallout: { labelX: '24px', labelY: '-18px', tooltipX: '-6px', tooltipY: '-214px' },
    compactCallout: { labelX: '18px', labelY: '-14px', tooltipX: '-4px', tooltipY: '-180px' },
  },
  Sahel: {
    label: 'Sahel',
    shortLabel: 'Agadez Arc',
    strapline: 'Uranium, drought, coups',
    themeClass: 'region-theme-southeast-asia',
    accent: '#ab7e4a',
    tilt: 2,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Sahel.marker,
    desktopCallout: { labelX: '18px', labelY: '-16px', tooltipX: '-4px', tooltipY: '-206px' },
    compactCallout: { labelX: '14px', labelY: '-12px', tooltipX: '-2px', tooltipY: '-170px' },
  },
  Mekong: {
    label: 'Mekong',
    shortLabel: 'Mekong Corridor',
    strapline: 'Water memory against dams.',
    themeClass: 'region-theme-pacific-islands',
    accent: '#4f8190',
    tilt: 4,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Mekong.marker,
    desktopCallout: { labelX: '24px', labelY: '-16px', tooltipX: '-136px', tooltipY: '-212px' },
    compactCallout: { labelX: '18px', labelY: '-12px', tooltipX: '-110px', tooltipY: '-180px' },
  },
  Andes: {
    label: 'Andes',
    shortLabel: 'Andean Spine',
    strapline: 'Highland resistance to debt.',
    themeClass: 'region-theme-europe',
    accent: '#84645f',
    tilt: -5,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Andes.marker,
    desktopCallout: { labelX: '18px', labelY: '-18px', tooltipX: '18px', tooltipY: '-208px' },
    compactCallout: { labelX: '14px', labelY: '-14px', tooltipX: '14px', tooltipY: '-180px' },
  },
  Cairo: {
    label: 'Cairo',
    shortLabel: 'Tahrir Square',
    strapline: 'The center of gravity.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: 2,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Cairo.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Alexandria: {
    label: 'Alexandria',
    shortLabel: 'The Mediterranean',
    strapline: 'Labor, docks, sea.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: -1,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Alexandria.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  NileDelta: {
    label: 'Nile Delta',
    shortLabel: 'The Delta',
    strapline: 'Agriculture, density.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: 1,
    mapPoint: BOARD_REGION_MAP_MANIFEST.NileDelta.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  UpperEgypt: {
    label: 'Upper Egypt',
    shortLabel: 'The South',
    strapline: 'Neglect, conservativism.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: -2,
    mapPoint: BOARD_REGION_MAP_MANIFEST.UpperEgypt.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Suez: {
    label: 'Suez',
    shortLabel: 'Canal Zone',
    strapline: 'Militarized industry.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: -3,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Suez.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Sinai: {
    label: 'Sinai',
    shortLabel: 'The Peninsula',
    strapline: 'Exclusion, security.',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: 4,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Sinai.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Tehran: {
    label: 'Tehran',
    shortLabel: 'Capital',
    strapline: 'Evin prison, universities.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: 1,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Tehran.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Kurdistan: {
    label: 'Kurdistan',
    shortLabel: 'The Vanguard',
    strapline: 'Jin, Jiyan, Azadi.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -3,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Kurdistan.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Isfahan: {
    label: 'Isfahan',
    shortLabel: 'Historic Heart',
    strapline: 'Dry river, schoolgirls.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -2,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Isfahan.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Mashhad: {
    label: 'Mashhad',
    shortLabel: 'Shrine City',
    strapline: 'Conservative rebellion.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: 2,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Mashhad.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Khuzestan: {
    label: 'Khuzestan',
    shortLabel: 'Oil Wealth',
    strapline: 'The thirsty province.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -1,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Khuzestan.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Balochistan: {
    label: 'Balochistan',
    shortLabel: 'Bloody Friday',
    strapline: 'Marginalized fringes.',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -4,
    mapPoint: BOARD_REGION_MAP_MANIFEST.Balochistan.marker,
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
};

export const BOARD_FRONT_RAIL: Array<{ id: string; shortLabel: string }> = [
  { id: 'WAR', shortLabel: 'War' },
  { id: 'CLIMATE', shortLabel: 'Climate' },
  { id: 'RIGHTS', shortLabel: 'Rights' },
  { id: 'SPEECH_INFO', shortLabel: 'Speech' },
  { id: 'POVERTY', shortLabel: 'Poverty' },
  { id: 'ENERGY', shortLabel: 'Energy' },
  { id: 'CULTURE', shortLabel: 'Culture' },
];

export const BOARD_PHASE_RAIL = ['World', 'Coalition', 'Compromise', 'Resolve'];
