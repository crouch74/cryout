import type { FrontId, RegionId } from '../../engine/index.ts';

export const REGION_THEMES: Record<
  RegionId,
  {
    area: string;
    strapline: string;
    themeClass: string;
  }
> = {
  NorthAmerica: {
    area: 'north-america',
    strapline: 'Media power, rights drift, upstream pressure.',
    themeClass: 'region-theme-north-america',
  },
  LatinAmerica: {
    area: 'latin-america',
    strapline: 'Culture, poverty, and solidarity networks.',
    themeClass: 'region-theme-latin-america',
  },
  Europe: {
    area: 'europe',
    strapline: 'Diplomatic leverage, speech pressure, legal spillover.',
    themeClass: 'region-theme-europe',
  },
  MENA: {
    area: 'mena',
    strapline: 'War pressure, aid corridors, witness focus.',
    themeClass: 'region-theme-mena',
  },
  SubSaharanAfrica: {
    area: 'sub-saharan-africa',
    strapline: 'Climate, poverty, and infrastructure fragility.',
    themeClass: 'region-theme-sub-saharan-africa',
  },
  SouthAsia: {
    area: 'south-asia',
    strapline: 'Heat stress, energy transitions, mass exposure.',
    themeClass: 'region-theme-south-asia',
  },
  SoutheastAsia: {
    area: 'southeast-asia',
    strapline: 'Disinfo corridors across dense coastal systems.',
    themeClass: 'region-theme-southeast-asia',
  },
  PacificIslands: {
    area: 'pacific-islands',
    strapline: 'Sea-level front line and climate alarms.',
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
