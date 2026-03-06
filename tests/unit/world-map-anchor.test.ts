import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { RegionId } from '../../src/engine/index.ts';
import {
  BASE_WORLD_REGION_MAP_MANIFEST,
  getBoardRegionAnchorPathIds,
} from '../../src/game/board/worldMapSvgManifest.ts';
import {
  computeRegionInteriorAnchorPercentages,
  extractSvgGeometry,
  findBestInteriorPoint,
  getSignedDistanceToPolygons,
  parsePathToPolygons,
  tokenizePathData,
} from '../../src/game/board/svgPathCentroid.ts';

function parsePercent(value: string) {
  return Number(value.replace('%', ''));
}

const BASE_WORLD_REGION_IDS = Object.keys(BASE_WORLD_REGION_MAP_MANIFEST) as RegionId[];

test('tokenizePathData keeps commands and scientific notation numbers intact', () => {
  assert.deepEqual(tokenizePathData('M0 0L10.5-2e-1z'), ['M', '0', '0', 'L', '10.5', '-2e-1', 'z']);
});

test('parsePathToPolygons closes basic polygons', () => {
  const polygons = parsePathToPolygons('M0 0 L10 0 L10 10 L0 10 Z');

  assert.equal(polygons.length, 1);
  assert.deepEqual(polygons[0], [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 0 },
  ]);
});

test('parsePathToPolygons approximates curved segments into interior-searchable points', () => {
  const polygons = parsePathToPolygons('M0 0 Q10 0 10 10 T20 20 L0 20 Z');

  assert.equal(polygons.length, 1);
  assert.equal(polygons[0].length > 10, true);
  assert.deepEqual(polygons[0][0], polygons[0].at(-1));
});

test('extractSvgGeometry maps descendant path data to group ids and direct path ids', () => {
  const geometry = extractSvgGeometry(`
    <svg viewBox="0 0 100 100">
      <g id="region-a">
        <path id="a1" d="M0 0 L10 0 L10 10 L0 10 Z" />
      </g>
      <path id="solo" d="M20 20 L30 20 L30 30 L20 30 Z" />
    </svg>
  `);

  assert.deepEqual(geometry.viewBox, [0, 0, 100, 100]);
  assert.equal(geometry.pathDataById.get('region-a')?.length, 1);
  assert.equal(geometry.pathDataById.get('a1')?.length, 1);
  assert.equal(geometry.pathDataById.get('solo')?.length, 1);
});

test('getSignedDistanceToPolygons is positive inside and negative outside', () => {
  const square = parsePathToPolygons('M0 0 L10 0 L10 10 L0 10 Z');

  assert.equal(getSignedDistanceToPolygons({ x: 5, y: 5 }, square) > 0, true);
  assert.equal(getSignedDistanceToPolygons({ x: 15, y: 5 }, square) < 0, true);
});

test('findBestInteriorPoint returns the visual center for a square', () => {
  const square = parsePathToPolygons('M0 0 L10 0 L10 10 L0 10 Z');
  const point = findBestInteriorPoint(square, 0.01);

  assert.ok(point);
  assert.equal(Math.abs(point.x - 5) < 0.05, true);
  assert.equal(Math.abs(point.y - 5) < 0.05, true);
  assert.equal(point.distance > 4.9, true);
});

test('findBestInteriorPoint favors the thick interior of an L-shaped region', () => {
  const lShape = parsePathToPolygons('M0 0 L6 0 L6 2 L2 2 L2 6 L0 6 Z');
  const point = findBestInteriorPoint(lShape, 0.01);

  assert.ok(point);
  assert.equal(point.x < 2.1, true);
  assert.equal(point.y < 2.1, true);
  assert.equal(point.distance > 1.1, true);
});

test('computeRegionInteriorAnchorPercentages converts interior points into percentages', () => {
  const anchors = computeRegionInteriorAnchorPercentages(
    `
      <svg viewBox="0 0 200 100">
        <g id="region-one">
          <path d="M0 0 L40 0 L40 40 L0 40 Z" />
        </g>
        <g id="region-two">
          <path d="M120 10 L180 10 L180 70 L120 70 Z" />
        </g>
      </svg>
    `,
    {
      Congo: ['region-one'],
      Levant: ['region-two'],
      Amazon: [],
      Sahel: [],
      Mekong: [],
      Andes: [],
    } as unknown as Record<RegionId, string[]>,
  );

  assert.equal(Math.abs(parsePercent(anchors.Congo?.x ?? '') - 10) < 0.2, true);
  assert.equal(Math.abs(parsePercent(anchors.Congo?.y ?? '') - 20) < 0.2, true);
  assert.equal(Math.abs(parsePercent(anchors.Levant?.x ?? '') - 75) < 0.2, true);
  assert.equal(Math.abs(parsePercent(anchors.Levant?.y ?? '') - 40) < 0.2, true);
  assert.equal(anchors.Amazon, undefined);
});

test('levant anchor coverage removes missing Palestine geometry before pin calculation', () => {
  const anchorIds = getBoardRegionAnchorPathIds('Levant');

  assert.equal(anchorIds.includes('ps'), false);
  assert.equal(anchorIds.includes('il'), true);
  assert.equal(anchorIds.includes('jo'), true);
});

test('real world map asset produces bounded interior anchors for every active region', () => {
  const svgMarkup = readFileSync(new URL('../../public/assets/scenarios/stones_cry_out/world-map-board.svg', import.meta.url), 'utf8');
  const regionCoverage = Object.fromEntries(
    BASE_WORLD_REGION_IDS.map((regionId) => [regionId, getBoardRegionAnchorPathIds(regionId)]),
  ) as Record<RegionId, string[]>;

  const anchors = computeRegionInteriorAnchorPercentages(svgMarkup, regionCoverage);

  for (const regionId of BASE_WORLD_REGION_IDS) {
    const anchor = anchors[regionId];
    assert.ok(anchor, `${regionId} should have a computed anchor`);
    assert.equal(parsePercent(anchor.x) > 0 && parsePercent(anchor.x) < 100, true);
    assert.equal(parsePercent(anchor.y) > 0 && parsePercent(anchor.y) < 100, true);
  }
});

test('real world map anchors stay in the same neighborhood as the authored marker fallbacks', () => {
  const svgMarkup = readFileSync(new URL('../../public/assets/scenarios/stones_cry_out/world-map-board.svg', import.meta.url), 'utf8');
  const regionCoverage = Object.fromEntries(
    BASE_WORLD_REGION_IDS.map((regionId) => [regionId, getBoardRegionAnchorPathIds(regionId)]),
  ) as Record<RegionId, string[]>;

  const anchors = computeRegionInteriorAnchorPercentages(svgMarkup, regionCoverage);

  for (const regionId of BASE_WORLD_REGION_IDS) {
    const computed = anchors[regionId];
    const fallback = BASE_WORLD_REGION_MAP_MANIFEST[regionId]?.marker;
    assert.ok(computed, `${regionId} should have a computed anchor`);
    assert.ok(fallback, `${regionId} should have a fallback marker`);
    assert.equal(Math.abs(parsePercent(computed.x) - parsePercent(fallback.x)) < 12, true);
    assert.equal(Math.abs(parsePercent(computed.y) - parsePercent(fallback.y)) < 12, true);
  }
});

test('real world map anchor outputs stay stable for the shipped SVG asset', () => {
  const svgMarkup = readFileSync(new URL('../../public/assets/scenarios/stones_cry_out/world-map-board.svg', import.meta.url), 'utf8');
  const regionCoverage = Object.fromEntries(
    BASE_WORLD_REGION_IDS.map((regionId) => [regionId, getBoardRegionAnchorPathIds(regionId)]),
  ) as Record<RegionId, string[]>;

  const anchors = computeRegionInteriorAnchorPercentages(svgMarkup, regionCoverage);
  const expected = {
    Congo: { x: 55.2381, y: 64.3257 },
    Levant: { x: 59.1196, y: 43.0922 },
    Amazon: { x: 32.7203, y: 69.2497 },
    Sahel: { x: 51.0003, y: 53.8332 },
    Mekong: { x: 79.0297, y: 53.4770 },
    Andes: { x: 28.1893, y: 73.1984 },
  } as Record<RegionId, { x: number; y: number }>;

  for (const regionId of BASE_WORLD_REGION_IDS) {
    const anchor = anchors[regionId];
    assert.ok(anchor, `${regionId} should have a computed anchor`);
    assert.equal(Math.abs(parsePercent(anchor.x) - expected[regionId].x) < 0.05, true);
    assert.equal(Math.abs(parsePercent(anchor.y) - expected[regionId].y) < 0.05, true);
  }
});

test('manifest keeps repaired token anchors aligned to the stable marker baseline', () => {
  for (const regionId of BASE_WORLD_REGION_IDS) {
    const entry = BASE_WORLD_REGION_MAP_MANIFEST[regionId];

    assert.ok(entry, `${regionId} should exist in the base-world manifest`);
    assert.ok(entry.tokenAnchor);
    assert.deepEqual(entry.tokenAnchor, entry.marker);
    assert.deepEqual(entry.anchorBias, { x: 0, y: 0 });
    assert.equal(entry.clusterRadius >= 60, true);
    assert.equal(entry.labelOffsetY, -14);
    assert.deepEqual(entry.opticalCenteringByTokenType.extraction, { x: 0, y: -1 });
    assert.deepEqual(entry.opticalCenteringByTokenType.defense, { x: 0, y: 0 });
    assert.deepEqual(entry.opticalCenteringByTokenType.comrades, { x: 0, y: 0.5 });
  }
});
