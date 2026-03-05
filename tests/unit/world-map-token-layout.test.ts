import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableRegions, type RegionId } from '../../src/engine/index.ts';
import { BOARD_REGION_MAP_MANIFEST } from '../../src/game/board/worldMapSvgManifest.ts';
import {
  buildRegionCountSummary,
  buildRegionLayouts,
  buildTokenGroupLayout,
} from '../../src/game/board/worldMapTokenLayout.ts';

const TOKEN_OPTIONS = {
  tokenSize: 24,
  gap: 8,
  padding: 8,
  overflowBadgeWidth: 32,
  opticalCorrection: { x: 0, y: 0 },
} as const;

function createRegionCounts(overrides: Partial<Record<RegionId, { extraction: number; defense: number; comrades: number }>>) {
  return Object.fromEntries(
    getAvailableRegions().map((regionId) => [
      regionId,
      buildRegionCountSummary(
        overrides[regionId]?.extraction ?? 0,
        overrides[regionId]?.defense ?? 0,
        overrides[regionId]?.comrades ?? 0,
      ),
    ]),
  ) as Record<RegionId, ReturnType<typeof buildRegionCountSummary>>;
}

function buildLayouts(
  regionCounts: Record<RegionId, ReturnType<typeof buildRegionCountSummary>>,
  options?: Partial<{ defaultVisibleWorldWidth: number; currentVisibleWorldWidth: number; selectedRegionId: RegionId | null }>,
) {
  return buildRegionLayouts({
    canvasWidth: 1280,
    canvasHeight: 760,
    mapViewport: { canvasWidth: '120%', canvasHeight: '110%', canvasLeft: '-10%', canvasTop: '-5%' },
    defaultVisibleWorldWidth: options?.defaultVisibleWorldWidth ?? 653,
    currentVisibleWorldWidth: options?.currentVisibleWorldWidth ?? 653,
    regionIds: getAvailableRegions(),
    selectedRegionId: options?.selectedRegionId ?? null,
    regionCounts,
    manifest: BOARD_REGION_MAP_MANIFEST,
  });
}

test('single token group centers one token', () => {
  const layout = buildTokenGroupLayout('Congo', 'extraction', 1, TOKEN_OPTIONS);

  assert.ok(layout);
  assert.equal(layout.units.length, 1);
  assert.equal(layout.units[0].x, 0);
  assert.equal(layout.units[0].y, 0);
});

test('two and three token groups stay on one row and three-token groups arc slightly', () => {
  const twoTokenLayout = buildTokenGroupLayout('Congo', 'comrades', 2, TOKEN_OPTIONS);
  const threeTokenLayout = buildTokenGroupLayout('Congo', 'comrades', 3, TOKEN_OPTIONS);

  assert.ok(twoTokenLayout);
  assert.deepEqual(twoTokenLayout.units.map((unit) => unit.y), [0, 0]);

  assert.ok(threeTokenLayout);
  assert.deepEqual(threeTokenLayout.units.map((unit) => unit.y), [-4, 0, -4]);
});

test('four to six tokens use a two-row grid with at most three per row', () => {
  const layout = buildTokenGroupLayout('Congo', 'defense', 5, TOKEN_OPTIONS);

  assert.ok(layout);
  const distinctRows = [...new Set(layout.units.map((unit) => unit.y))];
  assert.equal(distinctRows.length, 2);
  assert.equal(layout.units.filter((unit) => unit.y === distinctRows[0]).length <= 3, true);
  assert.equal(layout.units.filter((unit) => unit.y === distinctRows[1]).length <= 3, true);
});

test('seven and above tokens switch to smart stacking with compact overlap', () => {
  const layout = buildTokenGroupLayout('Congo', 'defense', 12, TOKEN_OPTIONS);

  assert.ok(layout);
  const distinctRows = [...new Set(layout.units.map((unit) => unit.y))];
  assert.equal(distinctRows.length <= 2, true);
  assert.equal(layout.visibleCount, 8);
  assert.equal(layout.units.length, 8);
  const sortedX = layout.units.map((unit) => unit.x).sort((left, right) => left - right);
  const minimumStep = sortedX.slice(1).reduce((smallest, value, index) => {
    const delta = Math.abs(value - sortedX[index]);
    return delta === 0 ? smallest : Math.min(smallest, delta);
  }, Number.POSITIVE_INFINITY);
  assert.equal(minimumStep < TOKEN_OPTIONS.tokenSize, true);
});

test('overflow layout caps visible tokens for compact stacks and shows a numeric badge', () => {
  const layout = buildTokenGroupLayout('Congo', 'extraction', 15, TOKEN_OPTIONS);

  assert.ok(layout);
  assert.equal(layout.visibleCount, 8);
  assert.equal(layout.units.length, 8);
  assert.equal(layout.overflowBadge?.label, '+7');
});

test('optical centering offsets token types deterministically', () => {
  const shifted = buildTokenGroupLayout('Congo', 'extraction', 1, {
    ...TOKEN_OPTIONS,
    opticalCorrection: { x: 0, y: -1 },
  });

  assert.ok(shifted);
  assert.equal(shifted.units[0].y, 0);

  const comradeShifted = buildTokenGroupLayout('Congo', 'comrades', 1, {
    ...TOKEN_OPTIONS,
    opticalCorrection: { x: 8, y: 0 },
  });

  assert.ok(comradeShifted);
  assert.equal(comradeShifted.units[0].x, 8);
});

test('region layout compression only triggers past the cluster radius threshold and caps at ten percent', () => {
  const layouts = buildLayouts(createRegionCounts({
    Congo: { extraction: 12, defense: 12, comrades: 12 },
    Levant: { extraction: 1, defense: 0, comrades: 0 },
  }), {
    defaultVisibleWorldWidth: 653,
    currentVisibleWorldWidth: 520,
  });

  assert.equal(layouts.Congo.cluster.scale <= 1, true);
  assert.equal(layouts.Congo.cluster.scale >= 0.9, true);
  assert.equal(layouts.Levant.cluster.scale, 1);
});

test('anchor snap stays within four pixels of the unsnapped anchor', () => {
  const layouts = buildLayouts(createRegionCounts({
    Congo: { extraction: 2, defense: 0, comrades: 1 },
  }));

  for (const regionId of getAvailableRegions()) {
    const layout = layouts[regionId];
    assert.equal(Math.abs(layout.anchor.snappedX - layout.anchor.baseX) <= 4, true);
    assert.equal(Math.abs(layout.anchor.snappedY - layout.anchor.baseY) <= 4, true);
  }
});

test('neighbor avoidance remains bounded and deterministic across repeated runs', () => {
  const regionCounts = createRegionCounts({
    Levant: { extraction: 6, defense: 3, comrades: 4 },
    Sahel: { extraction: 6, defense: 3, comrades: 4 },
    Congo: { extraction: 1, defense: 0, comrades: 0 },
  });

  const first = buildLayouts(regionCounts, { selectedRegionId: 'Levant' });
  const second = buildLayouts(regionCounts, { selectedRegionId: 'Levant' });

  assert.deepEqual(first, second);
  assert.equal(Math.hypot(first.Sahel.avoidanceOffset.x, first.Sahel.avoidanceOffset.y) <= 12.01, true);
  assert.equal(Math.hypot(first.Levant.avoidanceOffset.x, first.Levant.avoidanceOffset.y) <= 12.01, true);
  assert.equal(first.Levant.zIndex > first.Congo.zIndex, true);
});

test('token size shrinks when the visible map is broader and grows slightly when focus zooms in', () => {
  const regionCounts = createRegionCounts({
    Congo: { extraction: 3, defense: 2, comrades: 4 },
  });
  const broad = buildLayouts(regionCounts, {
    defaultVisibleWorldWidth: 653,
    currentVisibleWorldWidth: 820,
  });
  const focused = buildLayouts(regionCounts, {
    defaultVisibleWorldWidth: 653,
    currentVisibleWorldWidth: 520,
  });

  assert.equal(broad.Congo.cluster.tokenSize < focused.Congo.cluster.tokenSize, true);
  assert.equal(broad.Congo.cluster.tokenSize >= 11, true);
  assert.equal(focused.Congo.cluster.tokenSize <= 15, true);
});

test('effective cluster radius scales with viewport zoom', () => {
  const regionCounts = createRegionCounts({
    Congo: { extraction: 3, defense: 2, comrades: 4 },
  });
  const broad = buildLayouts(regionCounts, {
    defaultVisibleWorldWidth: 653,
    currentVisibleWorldWidth: 820,
  });
  const focused = buildLayouts(regionCounts, {
    defaultVisibleWorldWidth: 653,
    currentVisibleWorldWidth: 520,
  });

  assert.equal(broad.Congo.cluster.radius < focused.Congo.cluster.radius, true);
  assert.equal(broad.Congo.cluster.radius >= 52, true);
  assert.equal(focused.Congo.cluster.radius <= 76, true);
});
