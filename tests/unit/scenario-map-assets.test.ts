import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { algeriaBoard } from '../../src/scenarios/algerian_war_of_independence/boards/algeriaBoard.ts';
import { tahrirBoard } from '../../src/scenarios/tahrir_square/boards/tahrirBoard.ts';
import { womanLifeFreedomBoard } from '../../src/scenarios/woman_life_freedom/boards/womanLifeFreedomBoard.ts';
import { extractSvgGeometry, getPathDataForId, parsePathToPolygons } from '../../src/game/board/svgPathCentroid.ts';

function parsePercent(value: string) {
  return Number(value.replace('%', ''));
}

function getSignedPolygonArea(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) {
    return 0;
  }
  let area = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function getPolygonCentroid(points: Array<{ x: number; y: number }>) {
  const signedArea = getSignedPolygonArea(points);
  if (Math.abs(signedArea) < 1e-8) {
    return null;
  }

  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const factor = current.x * next.y - next.x * current.y;
    centroidX += (current.x + next.x) * factor;
    centroidY += (current.y + next.y) * factor;
  }

  return {
    x: centroidX / (6 * signedArea),
    y: centroidY / (6 * signedArea),
    area: Math.abs(signedArea),
  };
}

function getCoverageCentroid(
  geometry: ReturnType<typeof extractSvgGeometry>,
  coverage: string[],
) {
  const polygons = coverage
    .flatMap((id) => getPathDataForId(geometry, id))
    .flatMap((pathData) => parsePathToPolygons(pathData));
  if (polygons.length === 0) {
    return null;
  }

  let weightedX = 0;
  let weightedY = 0;
  let totalArea = 0;
  for (const polygon of polygons) {
    const centroid = getPolygonCentroid(polygon);
    if (!centroid) {
      continue;
    }
    weightedX += centroid.x * centroid.area;
    weightedY += centroid.y * centroid.area;
    totalArea += centroid.area;
  }

  if (totalArea <= 0) {
    return null;
  }

  return { x: weightedX / totalArea, y: weightedY / totalArea };
}

const SCENARIO_BOARDS = [
  { label: 'Egypt', board: tahrirBoard },
  { label: 'Iran', board: womanLifeFreedomBoard },
  { label: 'Algeria', board: algeriaBoard },
] as const;

test('scenario maps expose every region path id referenced by the board manifests', () => {
  for (const { label, board } of SCENARIO_BOARDS) {
    const svgMarkup = readFileSync(new URL(`../../public${board.assetPath}`, import.meta.url), 'utf8');
    const geometry = extractSvgGeometry(svgMarkup);

    assert.deepEqual(geometry.viewBox, [0, 0, 1000, 800], `${label} should keep the fixed board viewBox`);

    for (const entry of Object.values(board.regions)) {
      if (!entry) {
        continue;
      }

      for (const id of entry.interactionCoverage) {
        assert.ok(getPathDataForId(geometry, id).length > 0, `${label} ${entry.regionId} should expose ${id}`);
      }

      for (const id of entry.svgCoverage) {
        assert.ok(getPathDataForId(geometry, id).length > 0, `${label} ${entry.regionId} should expose ${id}`);
      }
    }
  }
});

test('scenario map markers stay within the rendered canvas and token anchors stay near region geometry centers', () => {
  let foundSplitAnchors = false;

  for (const { label, board } of SCENARIO_BOARDS) {
    const svgMarkup = readFileSync(new URL(`../../public${board.assetPath}`, import.meta.url), 'utf8');
    const geometry = extractSvgGeometry(svgMarkup);
    assert.ok(geometry.viewBox, `${label} should expose a viewBox`);
    const [, , viewBoxWidth, viewBoxHeight] = geometry.viewBox as [number, number, number, number];

    for (const entry of Object.values(board.regions)) {
      if (!entry) {
        continue;
      }

      const markerX = parsePercent(entry.marker.x);
      const markerY = parsePercent(entry.marker.y);

      assert.equal(markerX > 0 && markerX < 100, true, `${entry.regionId} marker x should stay on-map`);
      assert.equal(markerY > 0 && markerY < 100, true, `${entry.regionId} marker y should stay on-map`);

      const tokenX = parsePercent(entry.tokenAnchor.x);
      const tokenY = parsePercent(entry.tokenAnchor.y);
      assert.equal(tokenX > 0 && tokenX < 100, true, `${entry.regionId} token anchor x should stay on-map`);
      assert.equal(tokenY > 0 && tokenY < 100, true, `${entry.regionId} token anchor y should stay on-map`);

      if (entry.tokenAnchor.x !== entry.marker.x || entry.tokenAnchor.y !== entry.marker.y) {
        foundSplitAnchors = true;
      }

      const centroid = getCoverageCentroid(geometry, entry.anchorCoverage);
      assert.ok(centroid, `${entry.regionId} should expose centroid geometry`);
      const anchorPoint = {
        x: (tokenX / 100) * viewBoxWidth,
        y: (tokenY / 100) * viewBoxHeight,
      };
      const distance = Math.hypot(anchorPoint.x - centroid.x, anchorPoint.y - centroid.y);
      assert.equal(distance < 70, true, `${entry.regionId} token anchor should stay near geometry center (distance ${distance.toFixed(2)})`);
    }
  }

  assert.equal(foundSplitAnchors, true, 'At least one scenario region should keep marker and token anchors distinct.');
});

test('Algeria source geography is backed by real ADM1 data rather than placeholder boxes', () => {
  const geojson = JSON.parse(
    readFileSync(new URL('../../data/geojson/algeria-adm1/geoBoundaries-DZA-ADM1_simplified.geojson', import.meta.url), 'utf8'),
  ) as { features?: Array<{ properties?: { shapeName?: string } }> };
  const names = new Set((geojson.features ?? []).map((feature) => feature.properties?.shapeName).filter(Boolean));

  assert.equal((geojson.features?.length ?? 0) > 20, true, 'Algeria should expose real ADM1 coverage');
  assert.equal(names.has('Alger'), true);
  assert.equal(names.has('Tizi Ouzou'), true);
  assert.equal(names.has('Tebessa'), true);
});

test('Algeria metropole inset is backed by real geometry instead of a rectangle-only placeholder', () => {
  const svgMarkup = readFileSync(new URL(`../../public${algeriaBoard.assetPath}`, import.meta.url), 'utf8');
  const geometry = extractSvgGeometry(svgMarkup);
  const metropolePath = getPathDataForId(geometry, 'french-metropole-influence-shape').join(' ');

  assert.equal(metropolePath.length > 500, true, 'Metropole inset should contain detailed geometry');
  assert.equal(metropolePath.includes('M72 86 L262 86 L262 212 L72 212 Z'), false, 'Metropole inset should no longer be a box');
});
