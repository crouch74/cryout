import type { FrontId, RegionId } from '../../engine/index.ts';

export const REGION_THEMES: Record<
  RegionId,
  {
    area: string;
    strapline: string;
    themeClass: string;
  }
> = {
  Palestine: {
    area: 'north-america',
    strapline: 'Occupation, siege, witness, and civilian survival.',
    themeClass: 'region-theme-north-america',
  },
  Lebanon: {
    area: 'latin-america',
    strapline: 'Border spillover, debt shock, ports, and media pressure.',
    themeClass: 'region-theme-latin-america',
  },
  Egypt: {
    area: 'europe',
    strapline: 'Canal rents, debt governance, gas, and border control.',
    themeClass: 'region-theme-europe',
  },
  Sudan: {
    area: 'mena',
    strapline: 'War economy, displacement, gold, and corridor struggle.',
    themeClass: 'region-theme-mena',
  },
  Congo: {
    area: 'sub-saharan-africa',
    strapline: 'Critical minerals, forests, militias, and extraction.',
    themeClass: 'region-theme-sub-saharan-africa',
  },
  Yemen: {
    area: 'south-asia',
    strapline: 'Blockade, ports, famine pressure, and Red Sea routes.',
    themeClass: 'region-theme-south-asia',
  },
  Sahel: {
    area: 'southeast-asia',
    strapline: 'Uranium, drought, basing, and fractured sovereignty.',
    themeClass: 'region-theme-southeast-asia',
  },
  GulfStates: {
    area: 'pacific-islands',
    strapline: 'Oil, gas, logistics finance, and regional leverage.',
    themeClass: 'region-theme-pacific-islands',
  },
};

export const FRONT_THEMES: Record<
  FrontId,
  {
    themeClass: string;
    icon: string;
    pattern: string;
  }
> = {
  WAR: {
    themeClass: 'front-theme-war',
    icon: 'Shield',
    pattern: 'Containment corridors',
  },
  CLIMATE: {
    themeClass: 'front-theme-climate',
    icon: 'Storm',
    pattern: 'Heatwave bands',
  },
  RIGHTS: {
    themeClass: 'front-theme-rights',
    icon: 'Scale',
    pattern: 'Civic pressure lines',
  },
  SPEECH_INFO: {
    themeClass: 'front-theme-speech-info',
    icon: 'Signal',
    pattern: 'Broadcast interference',
  },
  POVERTY: {
    themeClass: 'front-theme-poverty',
    icon: 'Grain',
    pattern: 'Supply fractures',
  },
  ENERGY: {
    themeClass: 'front-theme-energy',
    icon: 'Grid',
    pattern: 'Transition grid',
  },
  CULTURE: {
    themeClass: 'front-theme-culture',
    icon: 'Pulse',
    pattern: 'Narrative echo',
  },
};
