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
  NorthAmerica: {
    area: 'north-america',
    label: 'Turtle Island / North America',
    shortLabel: 'Northlands',
    strapline: 'Media, rights, upstream pressure',
    themeClass: 'region-theme-north-america',
    accent: '#6e7d8c',
    tilt: -3,
  },
  LatinAmerica: {
    area: 'latin-america',
    label: 'Abya Yala / Latin America',
    shortLabel: 'River Belt',
    strapline: 'Culture, land defense, solidarity',
    themeClass: 'region-theme-latin-america',
    accent: '#a06e49',
    tilt: -6,
  },
  Europe: {
    area: 'europe',
    label: 'Europe',
    shortLabel: 'Institutions',
    strapline: 'Diplomacy, legal spillover, speech',
    themeClass: 'region-theme-europe',
    accent: '#87917d',
    tilt: 2,
  },
  MENA: {
    area: 'mena',
    label: 'West Asia & North Africa',
    shortLabel: 'Witness Front',
    strapline: 'War, aid corridors, witness',
    themeClass: 'region-theme-mena',
    accent: '#c08a4c',
    tilt: -5,
  },
  SubSaharanAfrica: {
    area: 'sub-saharan-africa',
    label: 'Africa South of the Sahara',
    shortLabel: 'Breadbasket',
    strapline: 'Climate, poverty, infrastructure',
    themeClass: 'region-theme-sub-saharan-africa',
    accent: '#b49a71',
    tilt: 3,
  },
  SouthAsia: {
    area: 'south-asia',
    label: 'South Asia',
    shortLabel: 'Heat Arc',
    strapline: 'Heat stress, density, energy',
    themeClass: 'region-theme-south-asia',
    accent: '#d6b26a',
    tilt: -2,
  },
  SoutheastAsia: {
    area: 'southeast-asia',
    label: 'Southeast Asia',
    shortLabel: 'Archipelago',
    strapline: 'Coastal systems and disinfo routes',
    themeClass: 'region-theme-southeast-asia',
    accent: '#7f9e9b',
    tilt: 4,
  },
  PacificIslands: {
    area: 'pacific-islands',
    label: 'Moana / Pacific Islands',
    shortLabel: 'Sea Line',
    strapline: 'Sea-level alarms, climate line',
    themeClass: 'region-theme-pacific-islands',
    accent: '#567b92',
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
