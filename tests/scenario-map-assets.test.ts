import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tahrirBoard } from '../src/mvp/boards/tahrirBoard.ts';
import { womanLifeFreedomBoard } from '../src/mvp/boards/womanLifeFreedomBoard.ts';
import { extractSvgGeometry, getPathDataForId } from '../src/mvp/svgPathCentroid.ts';

function parsePercent(value: string) {
  return Number(value.replace('%', ''));
}

const SCENARIO_BOARDS = [
  { label: 'Egypt', board: tahrirBoard },
  { label: 'Iran', board: womanLifeFreedomBoard },
] as const;

test('scenario maps expose every region path id referenced by the board manifests', () => {
  for (const { label, board } of SCENARIO_BOARDS) {
    const svgMarkup = readFileSync(new URL(`../public${board.assetPath}`, import.meta.url), 'utf8');
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
