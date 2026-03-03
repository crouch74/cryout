import type { MapViewport } from './worldMapSvgManifest.ts';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface FocusedViewportOptions {
  viewBox: [number, number, number, number];
  defaultViewport: MapViewport;
  focusBounds: WorldBounds | null;
  targetAspectRatio: number;
  focusBlend: number;
  marginXRatio: number;
  marginYRatio: number;
  minWidthRatio: number;
  minHeightRatio: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + ((end - start) * amount);
}

function formatPercent(value: number) {
  return `${Number(value.toFixed(4))}%`;
}

export function getViewBoxBounds(viewBox: [number, number, number, number]): WorldBounds {
  const [minX, minY, width, height] = viewBox;
  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
  };
}

export function getBoundsWidth(bounds: WorldBounds) {
  return bounds.maxX - bounds.minX;
}

export function getBoundsHeight(bounds: WorldBounds) {
  return bounds.maxY - bounds.minY;
}

export function getBoundsCenter(bounds: WorldBounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function getDefaultViewportBounds(
  viewBox: [number, number, number, number],
  viewport: MapViewport,
): WorldBounds {
  const [minX, minY, width, height] = viewBox;
  const widthPercent = Number.parseFloat(viewport.canvasWidth);
  const heightPercent = Number.parseFloat(viewport.canvasHeight);
  const leftPercent = Number.parseFloat(viewport.canvasLeft);
  const topPercent = Number.parseFloat(viewport.canvasTop);
  const visibleWidth = width * (100 / widthPercent);
  const visibleHeight = height * (100 / heightPercent);
  const offsetX = (-leftPercent / widthPercent) * width;
  const offsetY = (-topPercent / heightPercent) * height;

  return {
    minX: minX + offsetX,
    minY: minY + offsetY,
    maxX: minX + offsetX + visibleWidth,
    maxY: minY + offsetY + visibleHeight,
  };
}

export function getUnionBounds(boundsList: WorldBounds[]) {
  if (boundsList.length === 0) {
    return null;
  }

  return boundsList.reduce((merged, bounds) => ({
    minX: Math.min(merged.minX, bounds.minX),
    minY: Math.min(merged.minY, bounds.minY),
    maxX: Math.max(merged.maxX, bounds.maxX),
    maxY: Math.max(merged.maxY, bounds.maxY),
  }));
}

export function expandBounds(bounds: WorldBounds, marginX: number, marginY: number): WorldBounds {
  return {
    minX: bounds.minX - marginX,
    minY: bounds.minY - marginY,
    maxX: bounds.maxX + marginX,
    maxY: bounds.maxY + marginY,
  };
}

export function ensureMinimumBounds(bounds: WorldBounds, minWidth: number, minHeight: number): WorldBounds {
  const { x: centerX, y: centerY } = getBoundsCenter(bounds);
  const width = Math.max(getBoundsWidth(bounds), minWidth);
  const height = Math.max(getBoundsHeight(bounds), minHeight);

  return {
    minX: centerX - (width / 2),
    minY: centerY - (height / 2),
    maxX: centerX + (width / 2),
    maxY: centerY + (height / 2),
  };
}

// Keep the visible world proportional to the actual map panel so focus never crushes the map into a corner.
export function fitBoundsToAspect(bounds: WorldBounds, targetAspectRatio: number): WorldBounds {
  const { x: centerX, y: centerY } = getBoundsCenter(bounds);
  const width = getBoundsWidth(bounds);
  const height = getBoundsHeight(bounds);
  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - targetAspectRatio) < 0.0001) {
    return bounds;
  }

  if (aspectRatio < targetAspectRatio) {
    const adjustedWidth = height * targetAspectRatio;
    return {
      minX: centerX - (adjustedWidth / 2),
      minY: bounds.minY,
      maxX: centerX + (adjustedWidth / 2),
      maxY: bounds.maxY,
    };
  }

  const adjustedHeight = width / targetAspectRatio;
  return {
    minX: bounds.minX,
    minY: centerY - (adjustedHeight / 2),
    maxX: bounds.maxX,
    maxY: centerY + (adjustedHeight / 2),
  };
}

export function clampBoundsToViewBox(bounds: WorldBounds, viewBox: [number, number, number, number]): WorldBounds {
  const viewBoxBounds = getViewBoxBounds(viewBox);
  const width = Math.min(getBoundsWidth(bounds), getBoundsWidth(viewBoxBounds));
  const height = Math.min(getBoundsHeight(bounds), getBoundsHeight(viewBoxBounds));
  let minX = bounds.minX;
  let minY = bounds.minY;
  let maxX = minX + width;
  let maxY = minY + height;

  if (minX < viewBoxBounds.minX) {
    minX = viewBoxBounds.minX;
    maxX = minX + width;
  }
  if (maxX > viewBoxBounds.maxX) {
    maxX = viewBoxBounds.maxX;
    minX = maxX - width;
  }
  if (minY < viewBoxBounds.minY) {
    minY = viewBoxBounds.minY;
    maxY = minY + height;
  }
  if (maxY > viewBoxBounds.maxY) {
    maxY = viewBoxBounds.maxY;
    minY = maxY - height;
  }

  return { minX, minY, maxX, maxY };
}

export function boundsToViewport(bounds: WorldBounds, viewBox: [number, number, number, number]): MapViewport {
  const [minX, minY, width, height] = viewBox;
  const visibleWidth = getBoundsWidth(bounds);
  const visibleHeight = getBoundsHeight(bounds);
  const widthPercent = (width / visibleWidth) * 100;
  const heightPercent = (height / visibleHeight) * 100;
  const leftPercent = -((bounds.minX - minX) / visibleWidth) * 100;
  const topPercent = -((bounds.minY - minY) / visibleHeight) * 100;

  return {
    canvasWidth: formatPercent(widthPercent),
    canvasHeight: formatPercent(heightPercent),
    canvasLeft: formatPercent(leftPercent),
    canvasTop: formatPercent(topPercent),
  };
}

export function blendBounds(defaultBounds: WorldBounds, focusedBounds: WorldBounds, blend: number): WorldBounds {
  const defaultCenter = getBoundsCenter(defaultBounds);
  const focusedCenter = getBoundsCenter(focusedBounds);
  const width = lerp(getBoundsWidth(defaultBounds), getBoundsWidth(focusedBounds), blend);
  const height = lerp(getBoundsHeight(defaultBounds), getBoundsHeight(focusedBounds), blend);
  const centerX = lerp(defaultCenter.x, focusedCenter.x, blend);
  const centerY = lerp(defaultCenter.y, focusedCenter.y, blend);

  return {
    minX: centerX - (width / 2),
    minY: centerY - (height / 2),
    maxX: centerX + (width / 2),
    maxY: centerY + (height / 2),
  };
}

export function buildFocusedMapViewport(options: FocusedViewportOptions) {
  const viewBoxBounds = getViewBoxBounds(options.viewBox);
  const defaultBounds = getDefaultViewportBounds(options.viewBox, options.defaultViewport);

  if (!options.focusBounds) {
    return {
      viewport: options.defaultViewport,
      bounds: defaultBounds,
      defaultBounds,
      focusedBounds: defaultBounds,
      viewBoxBounds,
    };
  }

  const marginX = getBoundsWidth(viewBoxBounds) * options.marginXRatio;
  const marginY = getBoundsHeight(viewBoxBounds) * options.marginYRatio;
  const minWidth = getBoundsWidth(viewBoxBounds) * options.minWidthRatio;
  const minHeight = getBoundsHeight(viewBoxBounds) * options.minHeightRatio;
  const expandedFocus = expandBounds(options.focusBounds, marginX, marginY);
  const minimumFocus = ensureMinimumBounds(expandedFocus, minWidth, minHeight);
  const fittedFocus = fitBoundsToAspect(minimumFocus, options.targetAspectRatio);
  const clampedFocus = clampBoundsToViewBox(fittedFocus, options.viewBox);
  const blendedBounds = clampBoundsToViewBox(
    fitBoundsToAspect(blendBounds(defaultBounds, clampedFocus, clamp(options.focusBlend, 0, 1)), options.targetAspectRatio),
    options.viewBox,
  );

  return {
    viewport: boundsToViewport(blendedBounds, options.viewBox),
    bounds: blendedBounds,
    defaultBounds,
    focusedBounds: clampedFocus,
    viewBoxBounds,
  };
}
