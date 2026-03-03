import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_MAP_SVG_METADATA } from '../../src/game/board/worldMapSvgManifest.ts';
import { buildFocusedMapViewport, getBoundsCenter } from '../../src/game/board/worldMapViewport.ts';

const SAMPLE_VIEW_BOX: [number, number, number, number] = [0, 0, 1000, 500];

test('default viewport stays identical to the shipped metadata when no active regions are present', () => {
  const result = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds: null,
    targetAspectRatio: 2.2,
    focusBlend: 0.55,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });

  assert.deepEqual(result.viewport, WORLD_MAP_SVG_METADATA.viewport);
});

test('focused viewport remains clamped inside the source viewBox', () => {
  const result = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds: { minX: 930, minY: 20, maxX: 980, maxY: 80 },
    targetAspectRatio: 2.4,
    focusBlend: 0.55,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });

  assert.equal(result.bounds.minX >= 0, true);
  assert.equal(result.bounds.minY >= 0, true);
  assert.equal(result.bounds.maxX <= 1000, true);
  assert.equal(result.bounds.maxY <= 500, true);
});

test('focused viewport preserves minimum visible world width and height', () => {
  const result = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds: { minX: 400, minY: 180, maxX: 430, maxY: 210 },
    targetAspectRatio: 2.2,
    focusBlend: 0.55,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });

  assert.equal(result.focusedBounds.maxX - result.focusedBounds.minX >= 780, true);
  assert.equal(result.focusedBounds.maxY - result.focusedBounds.minY >= 420, true);
});

test('single-region focus is stronger than multi-region focus', () => {
  const focusBounds = { minX: 700, minY: 160, maxX: 760, maxY: 240 };
  const single = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds,
    targetAspectRatio: 2.2,
    focusBlend: 0.55,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });
  const multi = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds,
    targetAspectRatio: 2.2,
    focusBlend: 0.35,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });
  const focusCenter = getBoundsCenter(focusBounds);
  const defaultCenter = getBoundsCenter(single.defaultBounds);
  const singleCenter = getBoundsCenter(single.bounds);
  const multiCenter = getBoundsCenter(multi.bounds);

  assert.equal(single.bounds.maxY - single.bounds.minY < multi.bounds.maxY - multi.bounds.minY, true);
  assert.equal(Math.abs(singleCenter.y - focusCenter.y) < Math.abs(multiCenter.y - focusCenter.y), true);
  assert.equal(Math.abs(singleCenter.y - defaultCenter.y) > Math.abs(multiCenter.y - defaultCenter.y), true);
  assert.equal(singleCenter.x, defaultCenter.x);
  assert.equal(multiCenter.x, defaultCenter.x);
});

test('final focused viewport stays within a bounded delta from the default world center', () => {
  const focusBounds = { minX: 640, minY: 170, maxX: 740, maxY: 250 };
  const result = buildFocusedMapViewport({
    viewBox: SAMPLE_VIEW_BOX,
    defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
    focusBounds,
    targetAspectRatio: 2.2,
    focusBlend: 0.55,
    marginXRatio: 0.08,
    marginYRatio: 0.10,
    minWidthRatio: 0.78,
    minHeightRatio: 0.84,
  });
  const defaultCenter = getBoundsCenter(result.defaultBounds);
  const focusCenter = getBoundsCenter(result.focusedBounds);
  const finalCenter = getBoundsCenter(result.bounds);

  assert.equal(Math.abs(finalCenter.x - defaultCenter.x) <= Math.abs(focusCenter.x - defaultCenter.x), true);
  assert.equal(Math.abs(finalCenter.y - defaultCenter.y) <= Math.abs(focusCenter.y - defaultCenter.y), true);
});
