import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { corridorsBurnBoard } from '../../src/scenarios/when_the_corridors_burn/boards/corridorsBurnBoard.ts';
import {
  computeRegionInteriorAnchorPercentages,
  extractSvgGeometry,
  getPathDataForId,
} from '../../src/game/board/svgPathCentroid.ts';

function parsePercent(value: string) {
  return Number(value.replace('%', ''));
}

test('when_the_corridors_burn world board coverage IDs exist in the shared SVG', () => {
  const svgMarkup = readFileSync(new URL('../../public/assets/scenarios/stones_cry_out/world-map-board.svg', import.meta.url), 'utf8');
  const geometry = extractSvgGeometry(svgMarkup);

  for (const entry of Object.values(corridorsBurnBoard.regions)) {
    if (!entry) {
      continue;
    }

    for (const id of entry.interactionCoverage) {
      assert.ok(getPathDataForId(geometry, id).length > 0, `${entry.regionId} should expose ${id}`);
    }

    for (const id of entry.svgCoverage) {
      assert.ok(getPathDataForId(geometry, id).length > 0, `${entry.regionId} should expose ${id}`);
    }
  }
});

test('when_the_corridors_burn anchors stay in the same neighborhood as computed world-map interior anchors', () => {
  const svgMarkup = readFileSync(new URL('../../public/assets/scenarios/stones_cry_out/world-map-board.svg', import.meta.url), 'utf8');
  const regionCoverage = Object.fromEntries(
    Object.values(corridorsBurnBoard.regions).map((entry) => [entry.regionId, entry.anchorCoverage]),
  );
  const anchors = computeRegionInteriorAnchorPercentages(svgMarkup, regionCoverage);

  for (const entry of Object.values(corridorsBurnBoard.regions)) {
    if (!entry) {
      continue;
    }

    const tokenX = parsePercent(entry.tokenAnchor.x);
    const tokenY = parsePercent(entry.tokenAnchor.y);
    assert.equal(tokenX > 0 && tokenX < 100, true, `${entry.regionId} token anchor x should stay on-map`);
    assert.equal(tokenY > 0 && tokenY < 100, true, `${entry.regionId} token anchor y should stay on-map`);

    const computedAnchor = anchors[entry.regionId];
    assert.ok(computedAnchor, `${entry.regionId} should expose a computed interior anchor`);
    assert.equal(Math.abs(tokenX - parsePercent(computedAnchor.x)) < 3, true, `${entry.regionId} token anchor x should stay near computed interior anchor`);
    assert.equal(Math.abs(tokenY - parsePercent(computedAnchor.y)) < 3, true, `${entry.regionId} token anchor y should stay near computed interior anchor`);
  }
});
