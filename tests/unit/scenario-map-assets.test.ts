import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { algeriaBoard } from '../../src/scenarios/algerian_war_of_independence/boards/algeriaBoard.ts';
import { tahrirBoard } from '../../src/scenarios/tahrir_square/boards/tahrirBoard.ts';
import { womanLifeFreedomBoard } from '../../src/scenarios/woman_life_freedom/boards/womanLifeFreedomBoard.ts';
import { extractSvgGeometry, getPathDataForId } from '../../src/game/board/svgPathCentroid.ts';

function parsePercent(value: string) {
  return Number(value.replace('%', ''));
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

test('scenario map markers stay within the rendered canvas and remain aligned with token anchors', () => {
  for (const { board } of SCENARIO_BOARDS) {
    for (const entry of Object.values(board.regions)) {
      if (!entry) {
        continue;
      }

      const markerX = parsePercent(entry.marker.x);
      const markerY = parsePercent(entry.marker.y);

      assert.equal(markerX > 0 && markerX < 100, true, `${entry.regionId} marker x should stay on-map`);
      assert.equal(markerY > 0 && markerY < 100, true, `${entry.regionId} marker y should stay on-map`);
      assert.deepEqual(entry.tokenAnchor, entry.marker, `${entry.regionId} token anchor should track the city marker`);
    }
  }
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
