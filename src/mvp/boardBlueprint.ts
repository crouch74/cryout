import type { FrontId, RegionId } from '../../engine/index.ts';

export interface BoardRegionBlueprint {
  area: string;
  label: string;
  shortLabel: string;
  strapline: string;
  themeClass: string;
  accent: string;
  tilt: number;
}

export const BOARD_REGION_BLUEPRINT: Record<RegionId, BoardRegionBlueprint> = {
  Palestine: {
    area: 'north-america',
    label: 'Palestine',
    shortLabel: 'Gaza / West Bank',
    strapline: 'Occupation, siege, witness',
    themeClass: 'region-theme-north-america',
    accent: '#b86c5f',
    tilt: -3,
  },
  Lebanon: {
    area: 'latin-america',
    label: 'Lebanon',
    shortLabel: 'Beirut Corridor',
    strapline: 'Ports, spillover, media',
    themeClass: 'region-theme-latin-america',
    accent: '#8b6d5d',
    tilt: -6,
  },
  Egypt: {
    area: 'europe',
    label: 'Egypt',
    shortLabel: 'Nile / Suez',
    strapline: 'Debt, gas, canal control',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: 2,
  },
  Sudan: {
    area: 'mena',
    label: 'Sudan',
    shortLabel: 'Khartoum Front',
    strapline: 'War, gold, displacement',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -5,
  },
  Congo: {
    area: 'sub-saharan-africa',
    label: 'Congo',
    shortLabel: 'Kivu Belt',
    strapline: 'Minerals, forests, militias',
    themeClass: 'region-theme-sub-saharan-africa',
    accent: '#8b7a52',
    tilt: 3,
  },
  Yemen: {
    area: 'south-asia',
    label: 'Yemen',
    shortLabel: 'Red Sea Gate',
    strapline: 'Blockade, ports, famine',
    themeClass: 'region-theme-south-asia',
    accent: '#a77b63',
    tilt: -2,
  },
  Sahel: {
    area: 'southeast-asia',
    label: 'Sahel',
    shortLabel: 'Agadez Arc',
    strapline: 'Uranium, drought, coups',
    themeClass: 'region-theme-southeast-asia',
    accent: '#9f8f62',
    tilt: 4,
  },
  GulfStates: {
    area: 'pacific-islands',
    label: 'Gulf States',
    shortLabel: 'Oil Spine',
    strapline: 'Oil, gas, logistics',
    themeClass: 'region-theme-pacific-islands',
    accent: '#6d7f8e',
    tilt: -4,
  },
};

export const BOARD_FRONT_RAIL: Array<{ id: FrontId; shortLabel: string }> = [
  { id: 'WAR', shortLabel: 'War' },
  { id: 'CLIMATE', shortLabel: 'Climate' },
  { id: 'RIGHTS', shortLabel: 'Rights' },
  { id: 'SPEECH_INFO', shortLabel: 'Speech' },
  { id: 'POVERTY', shortLabel: 'Poverty' },
  { id: 'ENERGY', shortLabel: 'Energy' },
  { id: 'CULTURE', shortLabel: 'Culture' },
];

export const BOARD_PHASE_RAIL = ['World', 'Coalition', 'Compromise', 'Resolve'];
