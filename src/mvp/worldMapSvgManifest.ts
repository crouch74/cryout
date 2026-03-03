import type { BoardRegionMapEntry, RegionId } from '../../engine/index.ts';
import {
  BASE_WORLD_SVG_COUNTRY_INDEX,
  baseWorldBoard,
  getBaseWorldRegionAnchorPathIds,
  getBaseWorldRegionInteractionPathIds,
} from './boards/baseWorldBoard.ts';
import { tahrirBoard } from './boards/tahrirBoard.ts';
import { womanLifeFreedomBoard } from './boards/womanLifeFreedomBoard.ts';

export type { BoardRegionMapEntry, MapViewport } from '../../engine/index.ts';

export const WORLD_MAP_SVG_METADATA = {
  assetPath: baseWorldBoard.assetPath,
  sourceViewBox: baseWorldBoard.sourceViewBox,
  viewport: baseWorldBoard.viewport,
  idConvention: baseWorldBoard.svgIdConvention ?? '',
};

export const SVG_COUNTRY_PATH_INDEX = BASE_WORLD_SVG_COUNTRY_INDEX;
export const BASE_WORLD_REGION_MAP_MANIFEST = baseWorldBoard.regions as Partial<Record<RegionId, BoardRegionMapEntry>>;
export const BOARD_REGION_MAP_MANIFEST = {
  ...baseWorldBoard.regions,
  ...tahrirBoard.regions,
  ...womanLifeFreedomBoard.regions,
} as Partial<Record<RegionId, BoardRegionMapEntry>>;

export function getBoardRegionSvgPathIds(regionId: keyof typeof baseWorldBoard.regions) {
  const region = BASE_WORLD_REGION_MAP_MANIFEST[regionId];
  if (!region) {
    return [];
  }
  return region.svgCoverage.filter((id) => SVG_COUNTRY_PATH_INDEX[id as keyof typeof SVG_COUNTRY_PATH_INDEX]?.kind !== 'missing');
}

export function getBoardRegionAnchorPathIds(regionId: RegionId) {
  if (regionId in baseWorldBoard.regions) {
    return getBaseWorldRegionAnchorPathIds(regionId as Parameters<typeof getBaseWorldRegionAnchorPathIds>[0]);
  }
  return BOARD_REGION_MAP_MANIFEST[regionId]?.anchorCoverage ?? [];
}

export function getBoardRegionInteractionPathIds(regionId: RegionId) {
  if (regionId in baseWorldBoard.regions) {
    return getBaseWorldRegionInteractionPathIds(regionId as Parameters<typeof getBaseWorldRegionInteractionPathIds>[0]);
  }
  return BOARD_REGION_MAP_MANIFEST[regionId]?.interactionCoverage ?? [];
}
