import type { RegionId } from '../../engine/index.ts';
import type { MapViewport, BoardRegionMapEntry } from './worldMapSvgManifest.ts';

export type RegionTokenVisual = 'extraction' | 'defense' | 'comrades';

export interface RegionTokenUnit {
  key: string;
  type: RegionTokenVisual;
  x: number;
  y: number;
  rotationDeg: number;
  stackOrder: number;
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
  comrades: number;
}

interface LayoutViewport {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface SourceViewBox {
  width: number;
  height: number;
}

interface TokenLayoutOptions {
  tokenSize: number;
  gap: number;
  padding: number;
  overflowBadgeWidth: number;
  opticalCorrection: { x: number; y: number };
  randomizeStack?: boolean;
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
  sourceViewBox?: SourceViewBox;
  svgFitMode?: 'meet' | 'slice';
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
const MAX_VISIBLE_TOKENS = 8;
const MAX_NEIGHBOR_OFFSET = 12;
const SMART_STACK_THRESHOLD = 7;
const TYPE_ORDER: RegionTokenVisual[] = ['extraction', 'defense', 'comrades'];

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

// Map anchors are authored in SVG viewBox space. Token anchors must use the same fitted box
// that the SVG renderer uses (xMidYMid meet/slice), otherwise visible drift appears.
function getAnchorViewport(
  viewport: LayoutViewport,
  sourceViewBox?: SourceViewBox,
  fitMode: 'meet' | 'slice' = 'meet',
): LayoutViewport {
  if (!sourceViewBox || sourceViewBox.width <= 0 || sourceViewBox.height <= 0) {
    return viewport;
  }

  const scale = fitMode === 'slice'
    ? Math.max(viewport.width / sourceViewBox.width, viewport.height / sourceViewBox.height)
    : Math.min(viewport.width / sourceViewBox.width, viewport.height / sourceViewBox.height);
  const fittedWidth = sourceViewBox.width * scale;
  const fittedHeight = sourceViewBox.height * scale;

  return {
    width: fittedWidth,
    height: fittedHeight,
    left: viewport.left + (viewport.width - fittedWidth) / 2,
    top: viewport.top + (viewport.height - fittedHeight) / 2,
  };
}

// Token scale now follows the visible world width so pieces stay proportional to the rendered map.
function getTokenSizing(defaultVisibleWorldWidth: number, currentVisibleWorldWidth: number): TokenSizing {
  const zoomFactor = clamp(defaultVisibleWorldWidth / currentVisibleWorldWidth, 0.8, 1.6);
  const tokenScale = clamp(Math.sqrt(zoomFactor), 0.82, 1.08);
  const tokenSize = clamp(Math.round(14 * tokenScale), 11, 15);

  return {
    tokenScale,
    tokenSize,
    gap: tokenSize >= 14 ? 4 : 3,
    padding: tokenSize >= 14 ? 4 : 3,
    overflowBadgeWidth: tokenSize >= 14 ? 28 : 24,
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

function getSmartStackDimensions(
  visibleCount: number,
  tokenSize: number,
  gap: number,
  padding: number,
  hasOverflow: boolean,
  overflowBadgeWidth: number,
) {
  const rowCount = visibleCount <= 4 ? 1 : 2;
  const topRowCount = rowCount === 1 ? visibleCount : Math.ceil(visibleCount / 2);
  const bottomRowCount = rowCount === 1 ? 0 : visibleCount - topRowCount;
  const stackStepX = Math.max(3, Math.round(tokenSize * 0.58));
  const stackStepY = Math.max(3, Math.round(tokenSize * 0.52));
  const rowWidth = tokenSize + Math.max(0, topRowCount - 1) * stackStepX;
  const bottomRowWidth = bottomRowCount > 0
    ? tokenSize + Math.max(0, bottomRowCount - 1) * stackStepX
    : 0;
  const gridWidth = Math.max(rowWidth, bottomRowWidth);
  const gridHeight = tokenSize + Math.max(0, rowCount - 1) * stackStepY;
  const totalWidth = gridWidth + padding * 2 + (hasOverflow ? overflowBadgeWidth + gap : 0);

  return {
    width: totalWidth,
    height: gridHeight + padding * 2,
    gridWidth,
    gridHeight,
    stackStepX,
    stackStepY,
    topRowCount,
    bottomRowCount,
  };
}

function getColumnStackSizes(visibleCount: number) {
  const columnCount = clamp(Math.ceil(visibleCount / 3), 1, 3);
  const base = Math.floor(visibleCount / columnCount);
  const remainder = visibleCount % columnCount;
  return Array.from({ length: columnCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function getColumnStackDimensions(
  visibleCount: number,
  tokenSize: number,
  gap: number,
  padding: number,
  hasOverflow: boolean,
  overflowBadgeWidth: number,
) {
  const columnSizes = getColumnStackSizes(visibleCount);
  const stackStepX = Math.max(3, Math.round(tokenSize * 0.52));
  const stackStepY = Math.max(2, Math.round(tokenSize * 0.24));
  const columnsWidth = tokenSize + Math.max(0, columnSizes.length - 1) * stackStepX;
  const columnHeights = columnSizes.map((size) => tokenSize + Math.max(0, size - 1) * stackStepY);
  const gridHeight = Math.max(...columnHeights, tokenSize);
  const totalWidth = columnsWidth + padding * 2 + (hasOverflow ? overflowBadgeWidth + gap : 0);

  return {
    width: totalWidth,
    height: gridHeight + padding * 2,
    gridWidth: columnsWidth,
    gridHeight,
    stackStepX,
    stackStepY,
    columnSizes,
  };
}

// Three-token groups use a shallow arc so the eye reads them as a single countable cluster.
function getThreeTokenArcYOffset(columnIndex: number) {
  return columnIndex === 1 ? 0 : -4;
}

function getUnitScatterSeed(regionId: RegionId, type: RegionTokenVisual, unitIndex: number) {
  return hashRegionId(`${regionId}:${type}:${unitIndex}`);
}

function applyTabletopScatter(
  units: RegionTokenUnit[],
  regionId: RegionId,
  type: RegionTokenVisual,
  tokenSize: number,
  randomizeStack: boolean,
) {
  if (!randomizeStack || units.length <= 1) {
    return units.map((unit, index) => ({
      ...unit,
      rotationDeg: 0,
      stackOrder: unit.stackOrder || index + 1,
    }));
  }

  const maxScatter = Math.max(1.5, Math.round(tokenSize * 0.14 * 100) / 100);

  return units.map((unit, index) => {
    const seed = getUnitScatterSeed(regionId, type, index);
    const angle = ((seed % 360) * Math.PI) / 180;
    const radius = (((seed >>> 9) % 100) / 100) * maxScatter;
    const jitterX = Math.cos(angle) * radius;
    const jitterY = Math.sin(angle) * radius * 0.72;
    const rotationDeg = ((seed >>> 16) % 15) - 7;

    return {
      ...unit,
      x: normalizeZero(Number((unit.x + jitterX).toFixed(2))),
      y: normalizeZero(Number((unit.y + jitterY).toFixed(2))),
      rotationDeg,
      stackOrder: unit.stackOrder || index + 1,
    };
  });
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
  const useColumnStack = Boolean(options.randomizeStack);
  const useSmartStack = !useColumnStack && visibleCount >= SMART_STACK_THRESHOLD;
  const rowSizes = useSmartStack ? [] : getRowSizes(visibleCount);
  const dimensions = useColumnStack
    ? getColumnStackDimensions(
      visibleCount,
      options.tokenSize,
      options.gap,
      options.padding,
      hasOverflow,
      options.overflowBadgeWidth,
    )
    : useSmartStack
    ? getSmartStackDimensions(
      visibleCount,
      options.tokenSize,
      options.gap,
      options.padding,
      hasOverflow,
      options.overflowBadgeWidth,
    )
    : getGroupDimensions(
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

  if (useColumnStack) {
    const columnDimensions = dimensions as ReturnType<typeof getColumnStackDimensions>;
    const columnsWidth = options.tokenSize + Math.max(0, columnDimensions.columnSizes.length - 1) * columnDimensions.stackStepX;
    const startX = options.padding + (columnDimensions.gridWidth - columnsWidth) / 2;

    columnDimensions.columnSizes.forEach((columnSize, columnIndex) => {
      const columnX = startX + columnIndex * columnDimensions.stackStepX + options.tokenSize / 2;
      const columnHeight = options.tokenSize + Math.max(0, columnSize - 1) * columnDimensions.stackStepY;
      const startY = options.padding + (columnDimensions.gridHeight - columnHeight) / 2 + options.tokenSize / 2;

      for (let level = 0; level < columnSize; level += 1) {
        const y = startY + level * columnDimensions.stackStepY;
        const relativeX = normalizeZero(Number((columnX - groupCenterX + options.opticalCorrection.x).toFixed(2)));
        const relativeY = normalizeZero(Number((y - groupCenterY + options.opticalCorrection.y).toFixed(2)));
        units.push({
          key: `${regionId}-${type}-${tokenIndex}`,
          type,
          x: relativeX,
          y: relativeY,
          rotationDeg: 0,
          stackOrder: (level + 1) * 10 + columnIndex + 1,
        });
        tokenIndex += 1;
      }
    });
  } else if (useSmartStack) {
    const smartDimensions = dimensions as ReturnType<typeof getSmartStackDimensions>;
    const topRowCount = smartDimensions.topRowCount;
    const bottomRowCount = smartDimensions.bottomRowCount;
    const topRowWidth = options.tokenSize + Math.max(0, topRowCount - 1) * smartDimensions.stackStepX;
    const topStartX = options.padding + (dimensions.gridWidth - topRowWidth) / 2;
    const topY = options.padding + options.tokenSize / 2;

    for (let columnIndex = 0; columnIndex < topRowCount; columnIndex += 1) {
      const x = topStartX + columnIndex * smartDimensions.stackStepX + options.tokenSize / 2;
      const relativeX = snapToGrid(x - groupCenterX + options.opticalCorrection.x, GRID_STEP);
      const relativeY = snapToGrid(topY - groupCenterY + options.opticalCorrection.y, GRID_STEP);
      units.push({
        key: `${regionId}-${type}-${tokenIndex}`,
        type,
        x: normalizeZero(relativeX),
        y: normalizeZero(relativeY),
        rotationDeg: 0,
        stackOrder: tokenIndex + 1,
      });
      tokenIndex += 1;
    }

    if (bottomRowCount > 0) {
      const bottomRowWidth = options.tokenSize + Math.max(0, bottomRowCount - 1) * smartDimensions.stackStepX;
      const bottomStartX = options.padding + (dimensions.gridWidth - bottomRowWidth) / 2 + smartDimensions.stackStepX * 0.5;
      const bottomY = options.padding + options.tokenSize / 2 + smartDimensions.stackStepY;

      for (let columnIndex = 0; columnIndex < bottomRowCount; columnIndex += 1) {
        const x = bottomStartX + columnIndex * smartDimensions.stackStepX + options.tokenSize / 2;
        const relativeX = snapToGrid(x - groupCenterX + options.opticalCorrection.x, GRID_STEP);
        const relativeY = snapToGrid(bottomY - groupCenterY + options.opticalCorrection.y, GRID_STEP);
        units.push({
          key: `${regionId}-${type}-${tokenIndex}`,
          type,
          x: normalizeZero(relativeX),
          y: normalizeZero(relativeY),
          rotationDeg: 0,
          stackOrder: tokenIndex + 1,
        });
        tokenIndex += 1;
      }
    }
  } else {
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
          rotationDeg: 0,
          stackOrder: tokenIndex + 1,
        });
        tokenIndex += 1;
      }

      cursorY += options.tokenSize + options.gap;
    });
  }

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
    units: applyTabletopScatter(units, regionId, type, options.tokenSize, options.randomizeStack ?? false),
    overflowBadge,
  };
}

function buildClusterLayout(
  regionId: RegionId,
  manifestEntry: BoardRegionMapEntry,
  counts: RegionCountSummary,
  sizing: TokenSizing,
): RegionClusterLayout {
  const effectiveClusterRadius = clamp(Math.round(manifestEntry.clusterRadius * sizing.tokenScale), 52, 76);
  const items = TYPE_ORDER
    .map((type) => buildTokenGroupLayout(regionId, type, counts[type], {
      tokenSize: sizing.tokenSize,
      gap: sizing.gap,
      padding: sizing.padding,
      overflowBadgeWidth: sizing.overflowBadgeWidth,
      opticalCorrection: manifestEntry.opticalCenteringByTokenType[type],
      randomizeStack: true,
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
  let maxWidth = Math.max(...items.map((item) => item.width));
  let naturalHeight = items.reduce((sum, item) => sum + item.height, 0) + itemGap * Math.max(0, items.length - 1);

  if (items.length === 2) {
    const [left, right] = items;
    const columnGap = Math.max(4, Math.round(itemGap * 0.75));
    maxWidth = left.width + columnGap + right.width;
    naturalHeight = Math.max(left.height, right.height);

    left.x = 0;
    left.y = snapToGrid((naturalHeight - left.height) / 2, GRID_STEP);
    right.x = snapToGrid(left.width + columnGap, GRID_STEP);
    right.y = snapToGrid((naturalHeight - right.height) / 2, GRID_STEP);
  } else if (items.length === 3) {
    const [left, right, bottom] = items;
    const columnGap = Math.max(4, Math.round(itemGap * 0.75));
    const rowGap = Math.max(4, Math.round(itemGap * 0.75));
    const topRowHeight = Math.max(left.height, right.height);
    const topRowWidth = left.width + columnGap + right.width;
    maxWidth = Math.max(topRowWidth, bottom.width);
    naturalHeight = topRowHeight + rowGap + bottom.height;

    left.x = snapToGrid((maxWidth - topRowWidth) / 2, GRID_STEP);
    left.y = 0;
    right.x = snapToGrid(left.x + left.width + columnGap, GRID_STEP);
    right.y = 0;
    bottom.x = snapToGrid((maxWidth - bottom.width) / 2, GRID_STEP);
    bottom.y = snapToGrid(topRowHeight + rowGap, GRID_STEP);
  } else {
    let cursorY = 0;

    items.forEach((item) => {
      item.x = snapToGrid((maxWidth - item.width) / 2, GRID_STEP);
      item.y = snapToGrid(cursorY, GRID_STEP);
      cursorY += item.height + itemGap;
    });
  }

  const clusterMaxDimension = Math.max(maxWidth, naturalHeight);
  const compressionThreshold = effectiveClusterRadius * 1.34;
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
  return counts.extraction + counts.defense + counts.comrades;
}

export function buildRegionLayouts(input: BuildRegionLayoutsInput) {
  const viewport = getViewportMetrics(input.mapViewport, input.canvasWidth, input.canvasHeight);
  const anchorViewport = getAnchorViewport(viewport, input.sourceViewBox, input.svgFitMode ?? 'meet');
  const sizing = getTokenSizing(input.defaultVisibleWorldWidth, input.currentVisibleWorldWidth);
  const layouts = input.regionIds.map((regionId) => {
    const manifestEntry = input.manifest[regionId];
    if (!manifestEntry) {
      throw new Error(`Missing board region entry for ${regionId}.`);
    }
    const counts = input.regionCounts[regionId];
    const baseX = anchorViewport.left + anchorViewport.width * (percentToNumber(manifestEntry.tokenAnchor.x) / 100) + manifestEntry.anchorBias.x;
    const baseY = anchorViewport.top + anchorViewport.height * (percentToNumber(manifestEntry.tokenAnchor.y) / 100) + manifestEntry.anchorBias.y;
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
    if (!manifestEntry) {
      return;
    }
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
  comrades: number,
): RegionCountSummary {
  return { extraction, defense, comrades };
}
