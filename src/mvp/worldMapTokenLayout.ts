import type { RegionId } from '../../engine/index.ts';
import type { MapViewport, BoardRegionMapEntry } from './worldMapSvgManifest.ts';

export type RegionTokenVisual = 'extraction' | 'defense' | 'bodies';

export interface RegionTokenUnit {
  key: string;
  type: RegionTokenVisual;
  x: number;
  y: number;
}

export interface RegionOverflowBadgeLayout {
  x: number;
  y: number;
  label: string;
}

export interface RegionClusterItemLayout {
  type: RegionTokenVisual;
  count: number;
  visibleCount: number;
  width: number;
  height: number;
  x: number;
  y: number;
  units: RegionTokenUnit[];
  overflowBadge: RegionOverflowBadgeLayout | null;
}

export interface RegionClusterLayout {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  tokenSize: number;
  gap: number;
  padding: number;
  radius: number;
  items: RegionClusterItemLayout[];
}

export interface RegionLabelLayout {
  x: number;
  y: number;
}

export interface RegionLayoutResult {
  regionId: RegionId;
  anchor: {
    baseX: number;
    baseY: number;
    snappedX: number;
    snappedY: number;
  };
  avoidanceOffset: {
    x: number;
    y: number;
  };
  resolvedOffset: {
    x: number;
    y: number;
  };
  position: {
    x: number;
    y: number;
  };
  cluster: RegionClusterLayout;
  label: RegionLabelLayout;
  totalTokens: number;
  zIndex: number;
}

export interface RegionCountSummary {
  extraction: number;
  defense: number;
  bodies: number;
}

interface LayoutViewport {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface TokenLayoutOptions {
  tokenSize: number;
  gap: number;
  padding: number;
  overflowBadgeWidth: number;
  opticalCorrection: { x: number; y: number };
}

interface TokenSizing {
  tokenScale: number;
  tokenSize: number;
  gap: number;
  padding: number;
  overflowBadgeWidth: number;
}

export interface BuildRegionLayoutsInput {
  canvasWidth: number;
  canvasHeight: number;
  mapViewport: MapViewport;
  defaultVisibleWorldWidth: number;
  currentVisibleWorldWidth: number;
  regionIds: RegionId[];
  selectedRegionId: RegionId | null;
  regionCounts: Record<RegionId, RegionCountSummary>;
  manifest: Partial<Record<RegionId, BoardRegionMapEntry>>;
}

const GRID_STEP = 8;
const ANCHOR_SNAP_STEP_X = 8;
const ANCHOR_SNAP_STEP_Y = 8;
const MAX_VISIBLE_TOKENS = 12;
const MAX_NEIGHBOR_OFFSET = 12;
const TYPE_ORDER: RegionTokenVisual[] = ['extraction', 'defense', 'bodies'];

function percentToNumber(value: string) {
  return Number.parseFloat(value.replace('%', ''));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapToGrid(value: number, step: number) {
  return Math.round(value / step) * step;
}

function normalizeZero(value: number) {
  return Object.is(value, -0) ? 0 : value;
}

function hashRegionId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getViewportMetrics(mapViewport: MapViewport, canvasWidth: number, canvasHeight: number): LayoutViewport {
  return {
    width: (percentToNumber(mapViewport.canvasWidth) / 100) * canvasWidth,
    height: (percentToNumber(mapViewport.canvasHeight) / 100) * canvasHeight,
    left: (percentToNumber(mapViewport.canvasLeft) / 100) * canvasWidth,
    top: (percentToNumber(mapViewport.canvasTop) / 100) * canvasHeight,
  };
}

// Token scale now follows the visible world width so pieces stay proportional to the rendered map.
function getTokenSizing(defaultVisibleWorldWidth: number, currentVisibleWorldWidth: number): TokenSizing {
  const zoomFactor = clamp(defaultVisibleWorldWidth / currentVisibleWorldWidth, 0.8, 1.6);
  const tokenScale = clamp(Math.sqrt(zoomFactor), 0.9, 1.15);
  const tokenSize = clamp(Math.round(16 * tokenScale), 14, 18);

  return {
    tokenScale,
    tokenSize,
    gap: tokenSize >= 17 ? 8 : 6,
    padding: tokenSize >= 17 ? 8 : 6,
    overflowBadgeWidth: tokenSize >= 17 ? 32 : 28,
  };
}

function getRowSizes(count: number) {
  if (count <= 1) {
    return [1];
  }
  if (count <= 3) {
    return [count];
  }
  if (count <= 6) {
    const firstRow = Math.ceil(count / 2);
    return [firstRow, count - firstRow];
  }

  const baseRow = Math.floor(count / 3);
  const remainder = count % 3;
  return Array.from({ length: 3 }, (_, index) => baseRow + (index < remainder ? 1 : 0)).filter((value) => value > 0);
}

function getGroupDimensions(
  rowSizes: number[],
  tokenSize: number,
  gap: number,
  padding: number,
  hasOverflow: boolean,
  overflowBadgeWidth: number,
) {
  const rowWidths = rowSizes.map((rowCount) => rowCount * tokenSize + Math.max(0, rowCount - 1) * gap);
  const width = Math.max(...rowWidths, 0);
  const height = rowSizes.length * tokenSize + Math.max(0, rowSizes.length - 1) * gap;
  const totalWidth = width + padding * 2 + (hasOverflow ? overflowBadgeWidth + gap : 0);

  return {
    width: totalWidth,
    height: height + padding * 2,
    gridWidth: width,
    gridHeight: height,
  };
}

// Three-token groups use a shallow arc so the eye reads them as a single countable cluster.
function getThreeTokenArcYOffset(columnIndex: number) {
  return columnIndex === 1 ? 0 : -4;
}

export function buildTokenGroupLayout(
  regionId: RegionId,
  type: RegionTokenVisual,
  count: number,
  options: TokenLayoutOptions,
): RegionClusterItemLayout | null {
  if (count <= 0) {
    return null;
  }

  const visibleCount = Math.min(count, MAX_VISIBLE_TOKENS);
  const hasOverflow = count > MAX_VISIBLE_TOKENS;
  const rowSizes = getRowSizes(visibleCount);
  const dimensions = getGroupDimensions(
    rowSizes,
    options.tokenSize,
    options.gap,
    options.padding,
    hasOverflow,
    options.overflowBadgeWidth,
  );
  const groupCenterX = dimensions.width / 2;
  const groupCenterY = dimensions.height / 2;
  const units: RegionTokenUnit[] = [];
  let tokenIndex = 0;
  let cursorY = options.padding;

  rowSizes.forEach((rowCount) => {
    const rowWidth = rowCount * options.tokenSize + Math.max(0, rowCount - 1) * options.gap;
    const startX = options.padding + (dimensions.gridWidth - rowWidth) / 2;

    for (let columnIndex = 0; columnIndex < rowCount; columnIndex += 1) {
      const x = startX + columnIndex * (options.tokenSize + options.gap) + options.tokenSize / 2;
      let y = cursorY + options.tokenSize / 2;

      if (visibleCount === 3 && rowCount === 3) {
        y += getThreeTokenArcYOffset(columnIndex);
      }

      const relativeX = snapToGrid(x - groupCenterX + options.opticalCorrection.x, GRID_STEP);
      const relativeY = visibleCount === 3 && rowCount === 3
        ? y - groupCenterY + options.opticalCorrection.y
        : snapToGrid(y - groupCenterY + options.opticalCorrection.y, GRID_STEP);

      units.push({
        key: `${regionId}-${type}-${tokenIndex}`,
        type,
        x: normalizeZero(relativeX),
        y: normalizeZero(relativeY),
      });
      tokenIndex += 1;
    }

    cursorY += options.tokenSize + options.gap;
  });

  const overflowBadge = hasOverflow
    ? {
        x: snapToGrid(
          groupCenterX - options.padding / 2 + dimensions.gridWidth / 2 + options.gap + options.overflowBadgeWidth / 2,
          GRID_STEP,
        ),
        y: 0,
        label: `+${count - MAX_VISIBLE_TOKENS}`,
      }
    : null;

  return {
    type,
    count,
    visibleCount,
    width: dimensions.width,
    height: dimensions.height,
    x: 0,
    y: 0,
    units,
    overflowBadge,
  };
}

function buildClusterLayout(
  regionId: RegionId,
  manifestEntry: BoardRegionMapEntry,
  counts: RegionCountSummary,
  sizing: TokenSizing,
): RegionClusterLayout {
  const effectiveClusterRadius = clamp(Math.round(manifestEntry.clusterRadius * sizing.tokenScale), 56, 84);
  const items = TYPE_ORDER
    .map((type) => buildTokenGroupLayout(regionId, type, counts[type], {
      tokenSize: sizing.tokenSize,
      gap: sizing.gap,
      padding: sizing.padding,
      overflowBadgeWidth: sizing.overflowBadgeWidth,
      opticalCorrection: manifestEntry.opticalCenteringByTokenType[type],
    }))
    .filter((item): item is RegionClusterItemLayout => Boolean(item));

  if (items.length === 0) {
    return {
      width: sizing.tokenSize + sizing.padding * 2,
      height: sizing.tokenSize + sizing.padding * 2,
      naturalWidth: sizing.tokenSize + sizing.padding * 2,
      naturalHeight: sizing.tokenSize + sizing.padding * 2,
      scale: 1,
      tokenSize: sizing.tokenSize,
      gap: sizing.gap,
      padding: sizing.padding,
      radius: effectiveClusterRadius,
      items: [],
    };
  }

  const itemGap = sizing.gap;
  const maxWidth = Math.max(...items.map((item) => item.width));
  const naturalHeight = items.reduce((sum, item) => sum + item.height, 0) + itemGap * Math.max(0, items.length - 1);
  let cursorY = 0;

  items.forEach((item) => {
    item.x = snapToGrid((maxWidth - item.width) / 2, GRID_STEP);
    item.y = snapToGrid(cursorY, GRID_STEP);
    cursorY += item.height + itemGap;
  });

  const clusterMaxDimension = Math.max(maxWidth, naturalHeight);
  const compressionThreshold = effectiveClusterRadius * 1.4;
  const scale = clusterMaxDimension > compressionThreshold
    ? clamp(compressionThreshold / clusterMaxDimension, 0.9, 1)
    : 1;

  return {
    width: snapToGrid(maxWidth * scale, 1),
    height: snapToGrid(naturalHeight * scale, 1),
    naturalWidth: maxWidth,
    naturalHeight,
    scale,
    tokenSize: sizing.tokenSize,
    gap: sizing.gap,
    padding: sizing.padding,
    radius: effectiveClusterRadius,
    items,
  };
}

function getClusterFrameAt(centerX: number, centerY: number, layout: RegionLayoutResult) {
  return {
    left: centerX - layout.cluster.width / 2,
    top: centerY - layout.cluster.height / 2,
    width: layout.cluster.width,
    height: layout.cluster.height,
  };
}

function framesOverlap(source: RegionLayoutResult, target: RegionLayoutResult) {
  const leftFrame = getClusterFrameAt(source.anchor.baseX, source.anchor.baseY, source);
  const rightFrame = getClusterFrameAt(target.anchor.baseX, target.anchor.baseY, target);

  return !(
    leftFrame.left + leftFrame.width <= rightFrame.left
    || rightFrame.left + rightFrame.width <= leftFrame.left
    || leftFrame.top + leftFrame.height <= rightFrame.top
    || rightFrame.top + rightFrame.height <= leftFrame.top
  );
}

function buildAvoidanceVector(source: RegionLayoutResult, target: RegionLayoutResult) {
  const hash = hashRegionId(source.regionId);
  const hashAngle = (hash % 36) * (Math.PI / 18);
  const dx = source.anchor.baseX - target.anchor.baseX;
  const dy = source.anchor.baseY - target.anchor.baseY;
  const baseAngle = dx === 0 && dy === 0 ? hashAngle : Math.atan2(dy, dx);
  const angle = baseAngle + ((hash % 2 === 0 ? 1 : -1) * Math.PI / 18);

  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function getTotalTokenCount(counts: RegionCountSummary) {
  return counts.extraction + counts.defense + counts.bodies;
}

export function buildRegionLayouts(input: BuildRegionLayoutsInput) {
  const viewport = getViewportMetrics(input.mapViewport, input.canvasWidth, input.canvasHeight);
  const sizing = getTokenSizing(input.defaultVisibleWorldWidth, input.currentVisibleWorldWidth);
  const layouts = input.regionIds.map((regionId) => {
    const manifestEntry = input.manifest[regionId];
    if (!manifestEntry) {
      throw new Error(`Missing board region entry for ${regionId}.`);
    }
    const counts = input.regionCounts[regionId];
    const baseX = viewport.left + viewport.width * (percentToNumber(manifestEntry.tokenAnchor.x) / 100) + manifestEntry.anchorBias.x;
    const baseY = viewport.top + viewport.height * (percentToNumber(manifestEntry.tokenAnchor.y) / 100) + manifestEntry.anchorBias.y;
    const snappedBaseX = snapToGrid(baseX, ANCHOR_SNAP_STEP_X);
    const snappedBaseY = snapToGrid(baseY, ANCHOR_SNAP_STEP_Y);
    const cluster = buildClusterLayout(regionId, manifestEntry, counts, sizing);
    const totalTokens = getTotalTokenCount(counts);

    return {
      regionId,
      anchor: {
        baseX,
        baseY,
        snappedX: snappedBaseX,
        snappedY: snappedBaseY,
      },
      avoidanceOffset: { x: 0, y: 0 },
      resolvedOffset: { x: 0, y: 0 },
      position: {
        x: snappedBaseX,
        y: snappedBaseY,
      },
      cluster,
      label: {
        x: 0,
        y: -(cluster.height / 2) - Math.abs(manifestEntry.labelOffsetY) - (cluster.scale < 1 ? GRID_STEP : 0),
      },
      totalTokens,
      zIndex: 1,
    } satisfies RegionLayoutResult;
  });

  const sortedByAnchor = layouts.slice().sort((left, right) => left.anchor.baseX - right.anchor.baseX);

  sortedByAnchor.forEach((layout, index) => {
    const neighborCandidates = [sortedByAnchor[index - 1], sortedByAnchor[index + 1]].filter(
      (entry): entry is RegionLayoutResult => Boolean(entry),
    );
    let nearestNeighbor: RegionLayoutResult | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of neighborCandidates) {
      const distance = Math.hypot(
        layout.anchor.baseX - candidate.anchor.baseX,
        layout.anchor.baseY - candidate.anchor.baseY,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestNeighbor = candidate;
      }
    }

    if (!nearestNeighbor || layout.regionId < nearestNeighbor.regionId) {
      return;
    }

    if (!framesOverlap(layout, nearestNeighbor)) {
      return;
    }

    const overlapX = Math.max(
      0,
      (layout.cluster.width + nearestNeighbor.cluster.width) / 2 - Math.abs(layout.anchor.baseX - nearestNeighbor.anchor.baseX),
    );
    const overlapY = Math.max(
      0,
      (layout.cluster.height + nearestNeighbor.cluster.height) / 2 - Math.abs(layout.anchor.baseY - nearestNeighbor.anchor.baseY),
    );
    const offsetMagnitude = clamp(Math.max(overlapX, overlapY), 0, MAX_NEIGHBOR_OFFSET);
    const direction = buildAvoidanceVector(layout, nearestNeighbor);
    const rawOffset = {
      x: normalizeZero(Number((direction.x * offsetMagnitude).toFixed(2))),
      y: normalizeZero(Number((direction.y * offsetMagnitude).toFixed(2))),
    };
    const resolvedX = snapToGrid(layout.anchor.baseX + rawOffset.x, ANCHOR_SNAP_STEP_X);
    const resolvedY = snapToGrid(layout.anchor.baseY + rawOffset.y, ANCHOR_SNAP_STEP_Y);

    layout.avoidanceOffset = rawOffset;
    layout.position = {
      x: resolvedX,
      y: resolvedY,
    };
    layout.resolvedOffset = {
      x: normalizeZero(resolvedX - layout.anchor.snappedX),
      y: normalizeZero(resolvedY - layout.anchor.snappedY),
    };
  });

  const zOrdered = layouts
    .slice()
    .sort((left, right) => right.totalTokens - left.totalTokens || left.regionId.localeCompare(right.regionId));

  zOrdered.forEach((layout, index) => {
    const baseZIndex = zOrdered.length - index;
    layout.zIndex = baseZIndex + (layout.regionId === input.selectedRegionId ? zOrdered.length + 1 : 0);
    const manifestEntry = input.manifest[layout.regionId];
    layout.label = {
      x: 0,
      y: -(layout.cluster.height / 2) - Math.abs(manifestEntry.labelOffsetY) - (layout.cluster.scale < 1 ? GRID_STEP : 0),
    };
  });

  return Object.fromEntries(layouts.map((layout) => [layout.regionId, layout])) as Record<RegionId, RegionLayoutResult>;
}

export function buildRegionCountSummary(
  extraction: number,
  defense: number,
  bodies: number,
): RegionCountSummary {
  return { extraction, defense, bodies };
}
