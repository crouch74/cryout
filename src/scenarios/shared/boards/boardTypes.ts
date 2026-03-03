import type { BoardRegionMapEntry, MapViewport, RegionId, ScenarioBoardDefinition } from '../../../engine/index.ts';

export type { BoardRegionMapEntry, MapViewport, RegionId, ScenarioBoardDefinition };

export type SvgElementKind = 'path' | 'group' | 'missing';

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

export function getRenderablePathIds(ids: string[], index: Partial<Record<string, SvgPathReference>>) {
  return ids.filter((id) => index[id]?.kind !== 'missing');
}

export function createBoardRegionEntry(entry: BoardRegionMapEntry): BoardRegionMapEntry {
  return entry;
}
