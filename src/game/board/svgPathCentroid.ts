import type { RegionId } from '../../engine/index.ts';

export interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface InteriorPointResult {
  x: number;
  y: number;
  distance: number;
}

interface SearchCell {
  x: number;
  y: number;
  h: number;
  distance: number;
  max: number;
}

interface ExtractedSvgGeometry {
  viewBox: [number, number, number, number] | null;
  pathDataById: Map<string, string[]>;
}

function cubicPoint(start: Point, controlOne: Point, controlTwo: Point, end: Point, t: number): Point {
  const oneMinusT = 1 - t;
  return {
    x:
      (oneMinusT ** 3) * start.x
      + 3 * (oneMinusT ** 2) * t * controlOne.x
      + 3 * oneMinusT * (t ** 2) * controlTwo.x
      + (t ** 3) * end.x,
    y:
      (oneMinusT ** 3) * start.y
      + 3 * (oneMinusT ** 2) * t * controlOne.y
      + 3 * oneMinusT * (t ** 2) * controlTwo.y
      + (t ** 3) * end.y,
  };
}

function quadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const oneMinusT = 1 - t;
  return {
    x: (oneMinusT ** 2) * start.x + 2 * oneMinusT * t * control.x + (t ** 2) * end.x,
    y: (oneMinusT ** 2) * start.y + 2 * oneMinusT * t * control.y + (t ** 2) * end.y,
  };
}

export function tokenizePathData(pathData: string) {
  return [...pathData.matchAll(/[AaCcHhLlMmQqSsTtVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)].map((match) => match[0]);
}

export function parsePathToPolygons(pathData: string): Point[][] {
  const tokens = tokenizePathData(pathData);
  const polygons: Point[][] = [];
  let index = 0;
  let command = '';
  let currentPoint: Point = { x: 0, y: 0 };
  let startPoint: Point = { x: 0, y: 0 };
  let currentPolygon: Point[] = [];
  let lastCubicControl: Point | null = null;
  let lastQuadraticControl: Point | null = null;
  let previousCommand = '';

  const isCommand = (token: string) => /^[A-Za-z]$/.test(token);
  const readNumber = () => Number(tokens[index++]);
  const addPoint = (point: Point) => {
    const last = currentPolygon.at(-1);
    if (!last || last.x !== point.x || last.y !== point.y) {
      currentPolygon.push(point);
    }
  };
  const finishPolygon = () => {
    if (currentPolygon.length >= 3) {
      const first = currentPolygon[0];
      const last = currentPolygon.at(-1);
      if (last && (last.x !== first.x || last.y !== first.y)) {
        currentPolygon.push({ ...first });
      }
      polygons.push(currentPolygon);
    }
    currentPolygon = [];
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index++];
      previousCommand = command;
    }

    const relative = command === command.toLowerCase();

    switch (command) {
      case 'M':
      case 'm': {
        finishPolygon();
        let firstPair = true;
        while (index < tokens.length && !isCommand(tokens[index])) {
          const nextX = readNumber();
          const nextY = readNumber();
          currentPoint = {
            x: relative ? currentPoint.x + nextX : nextX,
            y: relative ? currentPoint.y + nextY : nextY,
          };
          if (firstPair) {
            startPoint = { ...currentPoint };
            currentPolygon = [{ ...currentPoint }];
            firstPair = false;
          } else {
            addPoint({ ...currentPoint });
          }
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case 'L':
      case 'l':
        while (index < tokens.length && !isCommand(tokens[index])) {
          currentPoint = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          addPoint({ ...currentPoint });
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      case 'H':
      case 'h':
        while (index < tokens.length && !isCommand(tokens[index])) {
          currentPoint = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: currentPoint.y,
          };
          addPoint({ ...currentPoint });
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      case 'V':
      case 'v':
        while (index < tokens.length && !isCommand(tokens[index])) {
          currentPoint = {
            x: currentPoint.x,
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          addPoint({ ...currentPoint });
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      case 'C':
      case 'c':
        while (index < tokens.length && !isCommand(tokens[index])) {
          const start = { ...currentPoint };
          const controlOne = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          const controlTwo = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          const end = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          for (let step = 1; step <= 10; step += 1) {
            addPoint(cubicPoint(start, controlOne, controlTwo, end, step / 10));
          }
          currentPoint = end;
          lastCubicControl = controlTwo;
          lastQuadraticControl = null;
        }
        break;
      case 'S':
      case 's':
        while (index < tokens.length && !isCommand(tokens[index])) {
          const start = { ...currentPoint };
          const reflected = previousCommand.toLowerCase() === 'c' || previousCommand.toLowerCase() === 's'
            ? {
                x: currentPoint.x * 2 - (lastCubicControl?.x ?? currentPoint.x),
                y: currentPoint.y * 2 - (lastCubicControl?.y ?? currentPoint.y),
              }
            : { ...currentPoint };
          const controlTwo = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          const end = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          for (let step = 1; step <= 10; step += 1) {
            addPoint(cubicPoint(start, reflected, controlTwo, end, step / 10));
          }
          currentPoint = end;
          lastCubicControl = controlTwo;
          lastQuadraticControl = null;
        }
        break;
      case 'Q':
      case 'q':
        while (index < tokens.length && !isCommand(tokens[index])) {
          const start = { ...currentPoint };
          const control = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          const end = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          for (let step = 1; step <= 10; step += 1) {
            addPoint(quadraticPoint(start, control, end, step / 10));
          }
          currentPoint = end;
          lastQuadraticControl = control;
          lastCubicControl = null;
        }
        break;
      case 'T':
      case 't':
        while (index < tokens.length && !isCommand(tokens[index])) {
          const start = { ...currentPoint };
          const control: Point = previousCommand.toLowerCase() === 'q' || previousCommand.toLowerCase() === 't'
            ? {
                x: currentPoint.x * 2 - (lastQuadraticControl?.x ?? currentPoint.x),
                y: currentPoint.y * 2 - (lastQuadraticControl?.y ?? currentPoint.y),
              }
            : { ...currentPoint };
          const end = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          for (let step = 1; step <= 10; step += 1) {
            addPoint(quadraticPoint(start, control, end, step / 10));
          }
          currentPoint = end;
          lastQuadraticControl = control;
          lastCubicControl = null;
        }
        break;
      case 'A':
      case 'a':
        while (index < tokens.length && !isCommand(tokens[index])) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          currentPoint = {
            x: relative ? currentPoint.x + readNumber() : readNumber(),
            y: relative ? currentPoint.y + readNumber() : readNumber(),
          };
          addPoint({ ...currentPoint });
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      case 'Z':
      case 'z':
        addPoint({ ...startPoint });
        currentPoint = { ...startPoint };
        finishPolygon();
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      default:
        throw new Error(`Unsupported SVG path command: ${command}`);
    }

    if (command.toLowerCase() !== 'z') {
      previousCommand = command;
    }
  }

  finishPolygon();
  return polygons;
}

export function getPolygonCentroid(points: Point[]) {
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }

  const area = signedArea / 2;
  if (Math.abs(area) < 0.001) {
    return null;
  }

  return {
    area,
    centroid: {
      x: centroidX / (6 * area),
      y: centroidY / (6 * area),
    },
  };
}

function getBoundingBox(points: Point[]): BoundingBox | null {
  if (points.length === 0) {
    return null;
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox | null {
  if (boxes.length === 0) {
    return null;
  }

  return boxes.reduce((merged, box) => ({
    minX: Math.min(merged.minX, box.minX),
    minY: Math.min(merged.minY, box.minY),
    maxX: Math.max(merged.maxX, box.maxX),
    maxY: Math.max(merged.maxY, box.maxY),
  }));
}

function getSquaredDistanceToSegment(point: Point, start: Point, end: Point) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (deltaX === 0 && deltaY === 0) {
    const distanceX = point.x - start.x;
    const distanceY = point.y - start.y;
    return distanceX ** 2 + distanceY ** 2;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / (deltaX ** 2 + deltaY ** 2)),
  );
  const projectionX = start.x + t * deltaX;
  const projectionY = start.y + t * deltaY;
  const distanceX = point.x - projectionX;
  const distanceY = point.y - projectionY;
  return distanceX ** 2 + distanceY ** 2;
}

function isPointInsidePolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const last = polygon[previous];
    const intersects = ((current.y > point.y) !== (last.y > point.y))
      && point.x < ((last.x - current.x) * (point.y - current.y)) / ((last.y - current.y) || Number.EPSILON) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getSignedDistanceToPolygons(point: Point, polygons: Point[][]) {
  let inside = false;
  let minDistanceSquared = Number.POSITIVE_INFINITY;

  for (const polygon of polygons) {
    if (polygon.length < 2) {
      continue;
    }

    if (isPointInsidePolygon(point, polygon)) {
      inside = true;
    }

    for (let index = 0; index < polygon.length - 1; index += 1) {
      minDistanceSquared = Math.min(
        minDistanceSquared,
        getSquaredDistanceToSegment(point, polygon[index], polygon[index + 1]),
      );
    }
  }

  if (!Number.isFinite(minDistanceSquared)) {
    return Number.NEGATIVE_INFINITY;
  }

  const distance = Math.sqrt(minDistanceSquared);
  return inside ? distance : -distance;
}

function createSearchCell(x: number, y: number, h: number, polygons: Point[][]): SearchCell {
  const distance = getSignedDistanceToPolygons({ x, y }, polygons);
  return {
    x,
    y,
    h,
    distance,
    max: distance + h * Math.SQRT2,
  };
}

function popBestCell(queue: SearchCell[]) {
  let bestIndex = 0;
  for (let index = 1; index < queue.length; index += 1) {
    if (queue[index].max > queue[bestIndex].max) {
      bestIndex = index;
    }
  }
  return queue.splice(bestIndex, 1)[0];
}

function getAreaWeightedCentroid(polygons: Point[]): InteriorPointResult | null;
function getAreaWeightedCentroid(polygons: Point[][]): InteriorPointResult | null;
function getAreaWeightedCentroid(polygons: Point[] | Point[][]): InteriorPointResult | null {
  const polygonList = Array.isArray(polygons[0]) ? polygons as Point[][] : [polygons as Point[]];
  let weightedArea = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const polygon of polygonList) {
    const centroid = getPolygonCentroid(polygon);
    if (!centroid) {
      continue;
    }
    const absoluteArea = Math.abs(centroid.area);
    weightedArea += absoluteArea;
    weightedX += centroid.centroid.x * absoluteArea;
    weightedY += centroid.centroid.y * absoluteArea;
  }

  if (weightedArea <= 0) {
    return null;
  }

  return {
    x: weightedX / weightedArea,
    y: weightedY / weightedArea,
    distance: 0,
  };
}

export function findBestInteriorPoint(polygons: Point[][], precision = 0.5): InteriorPointResult | null {
  const polygonBoxes = polygons.map(getBoundingBox).filter((box): box is BoundingBox => box !== null);
  const bounds = mergeBoundingBoxes(polygonBoxes);
  if (!bounds) {
    return null;
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const initialSize = Math.min(width, height);

  if (initialSize === 0) {
    const centroid = getAreaWeightedCentroid(polygons);
    if (!centroid) {
      return null;
    }
    return { ...centroid, distance: getSignedDistanceToPolygons(centroid, polygons) };
  }

  const queue: SearchCell[] = [];
  const initialHalf = initialSize / 2;

  for (let x = bounds.minX; x < bounds.maxX; x += initialSize) {
    for (let y = bounds.minY; y < bounds.maxY; y += initialSize) {
      queue.push(createSearchCell(x + initialHalf, y + initialHalf, initialHalf, polygons));
    }
  }

  let bestCell = createSearchCell(bounds.minX + width / 2, bounds.minY + height / 2, 0, polygons);
  for (const polygon of polygons) {
    const centroid = getAreaWeightedCentroid(polygon);
    if (!centroid) {
      continue;
    }
    const candidate = createSearchCell(centroid.x, centroid.y, 0, polygons);
    if (candidate.distance > bestCell.distance) {
      bestCell = candidate;
    }
  }

  while (queue.length > 0) {
    const cell = popBestCell(queue);
    if (cell.distance > bestCell.distance) {
      bestCell = cell;
    }

    if (cell.max - bestCell.distance <= precision) {
      continue;
    }

    const half = cell.h / 2;
    queue.push(createSearchCell(cell.x - half, cell.y - half, half, polygons));
    queue.push(createSearchCell(cell.x + half, cell.y - half, half, polygons));
    queue.push(createSearchCell(cell.x - half, cell.y + half, half, polygons));
    queue.push(createSearchCell(cell.x + half, cell.y + half, half, polygons));
  }

  return {
    x: bestCell.x,
    y: bestCell.y,
    distance: bestCell.distance,
  };
}

function parseAttributes(input: string) {
  const attributes: Record<string, string> = {};
  for (const match of input.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attributes[match[1]] = match[3] ?? match[4] ?? '';
  }
  return attributes;
}

export function extractSvgGeometry(svgMarkup: string): ExtractedSvgGeometry {
  const tagPattern = /<\s*(\/?)([A-Za-z0-9:_-]+)([^>]*?)(\/?)>/g;
  const stack: Array<{ id: string | null }> = [];
  const pathDataById = new Map<string, string[]>();
  let viewBox: [number, number, number, number] | null = null;

  for (const match of svgMarkup.matchAll(tagPattern)) {
    const [, closingSlash, rawTagName, rawAttributes, selfClosingSlash] = match;
    const tagName = rawTagName.toLowerCase();

    if (closingSlash) {
      stack.pop();
      continue;
    }

    const attributes = parseAttributes(rawAttributes);
    const id = attributes.id ?? null;
    const selfClosing = selfClosingSlash === '/';

    if (tagName === 'svg' && attributes.viewBox) {
      const numbers = attributes.viewBox.split(/\s+/).map(Number);
      if (numbers.length === 4 && numbers.every((value) => Number.isFinite(value))) {
        viewBox = [numbers[0], numbers[1], numbers[2], numbers[3]];
      }
    }

    if (tagName === 'path' && attributes.d) {
      const recipients = stack
        .map((entry) => entry.id)
        .filter((entry): entry is string => Boolean(entry));
      if (id) {
        recipients.push(id);
      }
      for (const recipientId of recipients) {
        const existing = pathDataById.get(recipientId) ?? [];
        existing.push(attributes.d);
        pathDataById.set(recipientId, existing);
      }
    }

    if (!selfClosing && tagName !== 'path') {
      stack.push({ id });
    }
  }

  return { viewBox, pathDataById };
}

export function getPathDataForId(geometry: ExtractedSvgGeometry, id: string) {
  return geometry.pathDataById.get(id) ?? [];
}

function toPercentage(value: number, min: number, span: number) {
  return `${((value - min) / span) * 100}%`;
}

export function computeRegionInteriorAnchorPercentages(svgMarkup: string, regionCoverage: Record<RegionId, string[]>) {
  const geometry = extractSvgGeometry(svgMarkup);
  if (!geometry.viewBox) {
    return {};
  }

  const [minX, minY, width, height] = geometry.viewBox;
  const anchors: Partial<Record<RegionId, { x: string; y: string }>> = {};

  for (const [regionId, ids] of Object.entries(regionCoverage) as Array<[RegionId, string[]]>) {
    const polygons = ids.flatMap((id) => getPathDataForId(geometry, id))
      .flatMap((pathData) => parsePathToPolygons(pathData));
    const interiorPoint = findBestInteriorPoint(polygons);
    const centroidFallback = interiorPoint ?? getAreaWeightedCentroid(polygons);
    if (!centroidFallback) {
      continue;
    }

    anchors[regionId] = {
      x: toPercentage(centroidFallback.x, minX, width),
      y: toPercentage(centroidFallback.y, minY, height),
    };
  }

  return anchors;
}

export const computeRegionAnchorPercentages = computeRegionInteriorAnchorPercentages;
