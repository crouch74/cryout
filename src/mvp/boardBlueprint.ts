import type { FrontId, RegionId } from '../../engine/index.ts';

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
  Palestine: {
    label: 'Palestine',
    shortLabel: 'Gaza / West Bank',
    strapline: 'Occupation, siege, witness',
    themeClass: 'region-theme-north-america',
    accent: '#b86c5f',
    tilt: -3,
    mapPoint: { x: '58.6%', y: '45.5%' },
    desktopCallout: { labelX: '54px', labelY: '-22px', tooltipX: '104px', tooltipY: '-86px' },
    compactCallout: { labelX: '38px', labelY: '-18px', tooltipX: '82px', tooltipY: '-72px' },
  },
  Lebanon: {
    label: 'Lebanon',
    shortLabel: 'Beirut Corridor',
    strapline: 'Ports, spillover, media',
    themeClass: 'region-theme-latin-america',
    accent: '#8b6d5d',
    tilt: -6,
    mapPoint: { x: '58.3%', y: '43.8%' },
    desktopCallout: { labelX: '-56px', labelY: '-34px', tooltipX: '-122px', tooltipY: '-96px' },
    compactCallout: { labelX: '-42px', labelY: '-26px', tooltipX: '-96px', tooltipY: '-80px' },
  },
  Egypt: {
    label: 'Egypt',
    shortLabel: 'Nile / Suez',
    strapline: 'Debt, gas, canal control',
    themeClass: 'region-theme-europe',
    accent: '#9b845d',
    tilt: 2,
    mapPoint: { x: '57.1%', y: '48%' },
    desktopCallout: { labelX: '-60px', labelY: '-2px', tooltipX: '-120px', tooltipY: '-58px' },
    compactCallout: { labelX: '-48px', labelY: '-4px', tooltipX: '-96px', tooltipY: '-52px' },
  },
  Sudan: {
    label: 'Sudan',
    shortLabel: 'Khartoum Front',
    strapline: 'War, gold, displacement',
    themeClass: 'region-theme-mena',
    accent: '#b87a52',
    tilt: -5,
    mapPoint: { x: '57.3%', y: '54.2%' },
    desktopCallout: { labelX: '-12px', labelY: '38px', tooltipX: '74px', tooltipY: '54px' },
    compactCallout: { labelX: '-8px', labelY: '30px', tooltipX: '58px', tooltipY: '48px' },
  },
  Congo: {
    label: 'Congo',
    shortLabel: 'Kivu Belt',
    strapline: 'Minerals, forests, militias',
    themeClass: 'region-theme-sub-saharan-africa',
    accent: '#8b7a52',
    tilt: 3,
    mapPoint: { x: '54.8%', y: '65.6%' },
    desktopCallout: { labelX: '-8px', labelY: '42px', tooltipX: '-92px', tooltipY: '74px' },
    compactCallout: { labelX: '-8px', labelY: '34px', tooltipX: '-78px', tooltipY: '64px' },
  },
  Yemen: {
    label: 'Yemen',
    shortLabel: 'Red Sea Gate',
    strapline: 'Blockade, ports, famine',
    themeClass: 'region-theme-south-asia',
    accent: '#a77b63',
    tilt: -2,
    mapPoint: { x: '62.9%', y: '54.4%' },
    desktopCallout: { labelX: '44px', labelY: '8px', tooltipX: '106px', tooltipY: '18px' },
    compactCallout: { labelX: '34px', labelY: '6px', tooltipX: '88px', tooltipY: '16px' },
  },
  Sahel: {
    label: 'Sahel',
    shortLabel: 'Agadez Arc',
    strapline: 'Uranium, drought, coups',
    themeClass: 'region-theme-southeast-asia',
    accent: '#9f8f62',
    tilt: 4,
    mapPoint: { x: '48.9%', y: '53.6%' },
    desktopCallout: { labelX: '-78px', labelY: '-6px', tooltipX: '-144px', tooltipY: '-42px' },
    compactCallout: { labelX: '-56px', labelY: '-4px', tooltipX: '-108px', tooltipY: '-34px' },
  },
  GulfStates: {
    label: 'Gulf States',
    shortLabel: 'Oil Spine',
    strapline: 'Oil, gas, logistics',
    themeClass: 'region-theme-pacific-islands',
    accent: '#6d7f8e',
    tilt: -4,
    mapPoint: { x: '62.2%', y: '49.4%' },
    desktopCallout: { labelX: '54px', labelY: '-2px', tooltipX: '118px', tooltipY: '-54px' },
    compactCallout: { labelX: '40px', labelY: '-2px', tooltipX: '96px', tooltipY: '-48px' },
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
