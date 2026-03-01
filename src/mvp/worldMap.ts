import type { FrontId, RegionId } from '../../engine/index.ts';

export const REGION_LAYOUT: Record<
  RegionId,
  {
    area: string;
    accent: string;
    strapline: string;
  }
> = {
  NorthAmerica: {
    area: 'north-america',
    accent: '#0f766e',
    strapline: 'Media power, rights drift, upstream pressure.',
  },
  LatinAmerica: {
    area: 'latin-america',
    accent: '#15803d',
    strapline: 'Culture, poverty, and solidarity networks.',
  },
  Europe: {
    area: 'europe',
    accent: '#1d4ed8',
    strapline: 'Diplomatic leverage, speech pressure, legal spillover.',
  },
  MENA: {
    area: 'mena',
    accent: '#c2410c',
    strapline: 'War pressure, aid corridors, witness focus.',
  },
  SubSaharanAfrica: {
    area: 'sub-saharan-africa',
    accent: '#b45309',
    strapline: 'Climate, poverty, and infrastructure fragility.',
  },
  SouthAsia: {
    area: 'south-asia',
    accent: '#7c3aed',
    strapline: 'Heat stress, energy transitions, mass exposure.',
  },
  SoutheastAsia: {
    area: 'southeast-asia',
    accent: '#2563eb',
    strapline: 'Disinfo corridors across dense coastal systems.',
  },
  PacificIslands: {
    area: 'pacific-islands',
    accent: '#0891b2',
    strapline: 'Sea-level front line and climate alarms.',
  },
};

export const FRONT_ACCENTS: Record<FrontId, string> = {
  WAR: '#b91c1c',
  CLIMATE: '#0f766e',
  RIGHTS: '#1d4ed8',
  SPEECH_INFO: '#6d28d9',
  POVERTY: '#c2410c',
  ENERGY: '#14532d',
  CULTURE: '#b45309',
};
