import type { RegionId } from '../../engine/index.ts';

interface Point {
  x: number;
  y: number;
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

function tokenizePathData(pathData: string) {
  return [...pathData.matchAll(/[AaCcHhLlMmQqSsTtVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)].map((match) => match[0]);
}

function parsePathToPolygons(pathData: string): Point[][] {
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

function getPolygonCentroid(points: Point[]) {
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

function getPathDataForId(documentRoot: Document, id: string) {
  const target = documentRoot.getElementById(id);
  if (!target) {
    return [];
  }

  if (target.tagName.toLowerCase() === 'path') {
    const pathData = target.getAttribute('d');
    return pathData ? [pathData] : [];
  }

  return Array.from(target.querySelectorAll('path'))
    .map((path) => path.getAttribute('d'))
    .filter((pathData): pathData is string => Boolean(pathData));
}

export function computeRegionAnchorPercentages(svgMarkup: string, regionCoverage: Record<RegionId, string[]>) {
  const parser = new DOMParser();
  const documentRoot = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const svgRoot = documentRoot.querySelector('svg');
  if (!svgRoot) {
    return {};
  }

  const viewBox = svgRoot.getAttribute('viewBox')?.split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4) {
    return {};
  }

  const [minX, minY, width, height] = viewBox;
  const anchors: Partial<Record<RegionId, { x: string; y: string }>> = {};

  for (const [regionId, ids] of Object.entries(regionCoverage) as Array<[RegionId, string[]]>) {
    let weightedArea = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const id of ids) {
      for (const pathData of getPathDataForId(documentRoot, id)) {
        for (const polygon of parsePathToPolygons(pathData)) {
          const centroid = getPolygonCentroid(polygon);
          if (!centroid) {
            continue;
          }
          const absoluteArea = Math.abs(centroid.area);
          weightedArea += absoluteArea;
          weightedX += centroid.centroid.x * absoluteArea;
          weightedY += centroid.centroid.y * absoluteArea;
        }
      }
    }

    if (weightedArea <= 0) {
      continue;
    }

    anchors[regionId] = {
      x: `${((weightedX / weightedArea - minX) / width) * 100}%`,
      y: `${((weightedY / weightedArea - minY) / height) * 100}%`,
    };
  }

  return anchors;
}
