import type { RegionId } from '../../engine/index.ts';
import { baseWorldBoard, BASE_WORLD_SVG_COUNTRY_INDEX, getBaseWorldRegionAnchorPathIds, getBaseWorldRegionInteractionPathIds } from './boards/baseWorldBoard.ts';

export const WORLD_MAP_SVG_METADATA = {
  assetPath: baseWorldBoard.assetPath,
  sourceViewBox: baseWorldBoard.sourceViewBox,
  viewport: baseWorldBoard.viewport,
  idConvention: baseWorldBoard.svgIdConvention ?? '',
};

export const SVG_COUNTRY_PATH_INDEX = BASE_WORLD_SVG_COUNTRY_INDEX;
export const BOARD_REGION_MAP_MANIFEST = baseWorldBoard.regions;

export function getBoardRegionSvgPathIds(regionId: keyof typeof baseWorldBoard.regions) {
  return BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage.filter((id) => SVG_COUNTRY_PATH_INDEX[id as keyof typeof SVG_COUNTRY_PATH_INDEX]?.kind !== 'missing');
}

export function getBoardRegionAnchorPathIds(regionId: RegionId) {
  if (!(regionId in baseWorldBoard.regions)) {
    return [];
  }
  return getBaseWorldRegionAnchorPathIds(regionId as keyof typeof baseWorldBoard.regions);
}

export function getBoardRegionInteractionPathIds(regionId: RegionId) {
  if (!(regionId in baseWorldBoard.regions)) {
    return [];
  }
  return getBaseWorldRegionInteractionPathIds(regionId as keyof typeof baseWorldBoard.regions);
}
