import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const VIEWBOX = { width: 1000, height: 800, padding: 36 };

const SCENARIOS = [
  {
    id: 'tahrir_square',
    countryLabel: 'Egypt',
    sourceGeoJson: 'data/geojson/egypt-adm1/geoBoundaries-EGY-ADM1_simplified.geojson',
    outputSvg: 'public/assets/scenarios/tahrir_square/egypt-location-map.svg',
    markerExport: 'EGYPT_SCENARIO_MARKERS',
    regions: [
      {
        regionId: 'Cairo',
        groupId: 'cairo-region',
        pathId: 'cairo-shape',
        adminNames: ['Cairo Governorate', 'Giza Governorate'],
        cityGeoJson: 'data/geojson/cities/cairo.geojson',
        accent: '#8d6746',
      },
      {
        regionId: 'Alexandria',
        groupId: 'alexandria-region',
        pathId: 'alexandria-shape',
        adminNames: ['Alexandria Governorate', 'Matrouh Governorate'],
        cityGeoJson: 'data/geojson/cities/alexandria.geojson',
        accent: '#9b7d5b',
      },
      {
        regionId: 'NileDelta',
        groupId: 'nile-delta-region',
        pathId: 'nile-delta-shape',
        adminNames: [
          'Beheira Governorate',
          'Dakahlia Governorate',
          'Damietta Governorate',
          'Gharbiyya Governorate',
          'Kafr el-Sheikh Governorate',
          'Monufia Governorate',
          'Qalyubia Governorate',
          'Al Sharqia Governorate',
        ],
        cityGeoJson: 'data/geojson/cities/mansoura.geojson',
        accent: '#ae8a61',
      },
      {
        regionId: 'UpperEgypt',
        groupId: 'upper-egypt-region',
        pathId: 'upper-egypt-shape',
        adminNames: [
          'Faiyum Governorate',
          'Beni Suef Governorate',
          'Minya Governate',
          'Asyut Governorate',
          'Sohag Governorate',
          'Qena Governorate',
          'Luxor Governate',
          'Aswan Governorate',
          'Red Sea Governorate',
          'New Valley Governorate',
        ],
        cityGeoJson: 'data/geojson/cities/asyut.geojson',
        accent: '#7b5c3d',
      },
      {
        regionId: 'Suez',
        groupId: 'suez-region',
        pathId: 'suez-shape',
        adminNames: ['Ismailia Governorate', 'Suez Governorate', 'Port Said Governorate'],
        cityGeoJson: 'data/geojson/cities/suez.geojson',
        accent: '#c18d5b',
      },
      {
        regionId: 'Sinai',
        groupId: 'sinai-region',
        pathId: 'sinai-shape',
        adminNames: ['North Sinai Governorate', 'South Sinai Governorate'],
        cityGeoJson: 'data/geojson/cities/al_arish.geojson',
        accent: '#70513a',
      },
    ],
  },
  {
    id: 'woman_life_freedom',
    countryLabel: 'Iran',
    sourceGeoJson: 'data/geojson/iran-adm1/geoBoundaries-IRN-ADM1_simplified.geojson',
    outputSvg: 'public/assets/scenarios/woman_life_freedom/iran-location-map.svg',
    markerExport: 'IRAN_SCENARIO_MARKERS',
    regions: [
      {
        regionId: 'Tehran',
        groupId: 'tehran-region',
        pathId: 'tehran-shape',
        adminNames: ['Tehran', 'Alborz', 'Qazvin', 'Qom', 'Markazi', 'Semnan', 'Gilan', 'Mazandaran', 'Golestan'],
        cityGeoJson: 'data/geojson/cities/tehran.geojson',
        accent: '#92644f',
      },
      {
        regionId: 'Kurdistan',
        groupId: 'kurdistan-region',
        pathId: 'kurdistan-shape',
        adminNames: ['Kurdistan', 'West Azerbaijan', 'East Azerbaijan', 'Ardabil', 'Zanjan', 'Hamadan', 'Kermanshah', 'Ilam'],
        cityGeoJson: 'data/geojson/cities/sanandaj.geojson',
        accent: '#b2774d',
      },
      {
        regionId: 'Isfahan',
        groupId: 'isfahan-region',
        pathId: 'isfahan-shape',
        adminNames: ['Isfahan', 'Fars', 'Chaharmahal and Bakhtiari', 'Kohgiluyeh and Boyer-Ahmad'],
        cityGeoJson: 'data/geojson/cities/isfahan.geojson',
        accent: '#8a613f',
      },
      {
        regionId: 'Mashhad',
        groupId: 'mashhad-region',
        pathId: 'mashhad-shape',
        adminNames: ['Razavi Khorasan', 'North Khorasan', 'South Khorasan'],
        cityGeoJson: 'data/geojson/cities/mashhad.geojson',
        accent: '#a36d52',
      },
      {
        regionId: 'Khuzestan',
        groupId: 'khuzestan-region',
        pathId: 'khuzestan-shape',
        adminNames: ['Khuzestan', 'Lorestan', 'Bushehr', 'Hormozgan'],
        cityGeoJson: 'data/geojson/cities/ahvaz.geojson',
        accent: '#7c4f3d',
      },
      {
        regionId: 'Balochistan',
        groupId: 'balochistan-region',
        pathId: 'balochistan-shape',
        adminNames: ['Sistan and Baluchestan', 'Kerman', 'Yazd'],
        cityGeoJson: 'data/geojson/cities/zahedan.geojson',
        accent: '#6f4738',
      },
    ],
  },
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));
}

function clampLatitude(latitude) {
  return Math.max(-85, Math.min(85, latitude));
}

function mercatorPoint([longitude, latitude]) {
  const limitedLatitude = clampLatitude(latitude);
  const longitudeRadians = longitude * (Math.PI / 180);
  const latitudeRadians = limitedLatitude * (Math.PI / 180);
  return {
    x: longitudeRadians,
    y: Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
  };
}

function getPolygons(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function collectProjectedBounds(features) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    for (const polygon of getPolygons(feature.geometry)) {
      for (const ring of polygon) {
        for (const coordinate of ring) {
          const point = mercatorPoint(coordinate);
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

function createProjector(bounds) {
  const drawableWidth = VIEWBOX.width - VIEWBOX.padding * 2;
  const drawableHeight = VIEWBOX.height - VIEWBOX.padding * 2;
  const scale = Math.min(
    drawableWidth / (bounds.maxX - bounds.minX),
    drawableHeight / (bounds.maxY - bounds.minY),
  );
  const offsetX = (VIEWBOX.width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = (VIEWBOX.height - (bounds.maxY - bounds.minY) * scale) / 2;

  return ([longitude, latitude]) => {
    const point = mercatorPoint([longitude, latitude]);
    return {
      x: offsetX + (point.x - bounds.minX) * scale,
      y: VIEWBOX.height - (offsetY + (point.y - bounds.minY) * scale),
    };
  };
}

function formatNumber(value) {
  return Number.parseFloat(value.toFixed(2));
}

function squaredDistance(pointA, pointB) {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function squaredSegmentDistance(point, segmentStart, segmentEnd) {
  let segmentX = segmentEnd.x - segmentStart.x;
  let segmentY = segmentEnd.y - segmentStart.y;

  if (segmentX === 0 && segmentY === 0) {
    return squaredDistance(point, segmentStart);
  }

  let projection = ((point.x - segmentStart.x) * segmentX + (point.y - segmentStart.y) * segmentY)
    / (segmentX * segmentX + segmentY * segmentY);

  projection = Math.max(0, Math.min(1, projection));
  segmentX = segmentStart.x + segmentX * projection;
  segmentY = segmentStart.y + segmentY * projection;

  return squaredDistance(point, { x: segmentX, y: segmentY });
}

function simplifyPolyline(points, toleranceSquared) {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = toleranceSquared;
  let splitIndex = -1;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squaredSegmentDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      splitIndex = index;
      maxDistance = distance;
    }
  }

  if (splitIndex === -1) {
    return [points[0], points[points.length - 1]];
  }

  const left = simplifyPolyline(points.slice(0, splitIndex + 1), toleranceSquared);
  const right = simplifyPolyline(points.slice(splitIndex), toleranceSquared);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosedRing(points, tolerance = 0.8) {
  if (points.length <= 4) {
    return points;
  }

  const openPoints = [...points];
  const firstPoint = openPoints[0];
  const lastPoint = openPoints[openPoints.length - 1];
  if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y) {
    openPoints.pop();
  }

  const simplified = simplifyPolyline(openPoints, tolerance * tolerance);
  if (simplified.length < 3) {
    return [...openPoints, openPoints[0]];
  }

  return [...simplified, simplified[0]];
}

function ringToSvgPath(ring, project) {
  const simplifiedRing = simplifyClosedRing(ring.map((coordinate) => project(coordinate)));

  return simplifiedRing
    .map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`;
    })
    .join(' ') + ' Z';
}

function featuresToSvgPath(features, project) {
  return features
    .flatMap((feature) => getPolygons(feature.geometry))
    .flatMap((polygon) => polygon.map((ring) => ringToSvgPath(ring, project)))
    .join(' ');
}

function loadScenarioSource(sourceGeoJsonPath) {
  const collection = readJson(sourceGeoJsonPath);
  if (!Array.isArray(collection.features)) {
    throw new Error(`GeoJSON missing features array: ${sourceGeoJsonPath}`);
  }

  const featuresByName = new Map();
  for (const feature of collection.features) {
    const shapeName = feature?.properties?.shapeName;
    if (!shapeName) {
      continue;
    }
    const entries = featuresByName.get(shapeName) ?? [];
    entries.push(feature);
    featuresByName.set(shapeName, entries);
  }

  return { collection, featuresByName };
}

function getNamedFeatures(featuresByName, adminNames, label) {
  const matched = [];
  const missing = [];

  for (const adminName of adminNames) {
    const features = featuresByName.get(adminName);
    if (!features || features.length === 0) {
      missing.push(adminName);
      continue;
    }
    matched.push(...features);
  }

  if (missing.length > 0) {
    throw new Error(`${label} is missing ADM1 shapes: ${missing.join(', ')}`);
  }

  return matched;
}

function loadCityCoordinate(cityGeoJsonPath) {
  const geojson = readJson(cityGeoJsonPath);
  const coordinates = geojson?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error(`City GeoJSON missing a point geometry: ${cityGeoJsonPath}`);
  }
  return coordinates;
}

function pointToPercent(point) {
  return {
    x: `${(point.x / VIEWBOX.width * 100).toFixed(2)}%`,
    y: `${(point.y / VIEWBOX.height * 100).toFixed(2)}%`,
  };
}

function renderScenarioSvg({ countryLabel, countryPath, boundaryPaths, regionLayers }) {
  const regionMarkup = regionLayers.map((region) => `    <g id="${region.groupId}">
      <path id="${region.pathId}" d="${region.path}" fill="${region.accent}" fill-opacity="0.78" stroke="none" />
    </g>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/generate-scenario-maps.mjs from checked-in GeoJSON sources. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" aria-labelledby="title desc" role="img">
  <title id="title">${countryLabel} scenario map</title>
  <desc id="desc">Scenario board geography generated from ADM1 GeoJSON and local city-point GeoJSON anchors.</desc>
  <rect width="${VIEWBOX.width}" height="${VIEWBOX.height}" fill="#d7ecf5" />
  <g id="country-shell">
    <path id="country-base" d="${countryPath}" fill="#eadfc8" stroke="#8b7556" stroke-width="1.8" stroke-linejoin="round" fill-rule="evenodd" />
  </g>
  <g id="province-boundaries" opacity="0.58">
${boundaryPaths.map((path) => `    <path d="${path}" fill="none" stroke="#a69070" stroke-width="0.8" stroke-linejoin="round" />`).join('\n')}
  </g>
  <g id="scenario-regions">
${regionMarkup}
  </g>
</svg>
`;
}

function renderAnchorModule(anchorSets) {
  const blocks = anchorSets.map(({ exportName, anchors }) => {
    const entries = Object.entries(anchors)
      .map(([regionId, point]) => `  ${regionId}: { x: '${point.x}', y: '${point.y}' },`)
      .join('\n');

    return `export const ${exportName} = {\n${entries}\n} as const;`;
  }).join('\n\n');

  return `// Generated by scripts/generate-scenario-maps.mjs from checked-in GeoJSON.
// The board manifests spread these values so authored offsets remain readable
// while the actual anchor positions stay tied to the underlying geography.

${blocks}
`;
}

function main() {
  const anchorSets = [];

  for (const scenario of SCENARIOS) {
    const { collection, featuresByName } = loadScenarioSource(scenario.sourceGeoJson);
    const bounds = collectProjectedBounds(collection.features);
    const project = createProjector(bounds);

    const countryPath = featuresToSvgPath(collection.features, project);
    const boundaryPaths = collection.features.map((feature) => featuresToSvgPath([feature], project));
    const regionLayers = [];
    const anchors = {};

    console.log(`🗺️ Generating ${scenario.countryLabel} scenario map from ${scenario.sourceGeoJson}`);

    for (const region of scenario.regions) {
      // These unions are scenario theaters, not new official borders.
      // They keep the movement-facing fronts legible while using real ADM1 geometry.
      const regionFeatures = getNamedFeatures(featuresByName, region.adminNames, region.regionId);
      const cityCoordinate = loadCityCoordinate(region.cityGeoJson);
      const cityPoint = project(cityCoordinate);

      regionLayers.push({
        groupId: region.groupId,
        pathId: region.pathId,
        path: featuresToSvgPath(regionFeatures, project),
        accent: region.accent,
      });
      anchors[region.regionId] = pointToPercent(cityPoint);

      console.log(`📍 ${scenario.countryLabel} ${region.regionId} anchor resolved to ${anchors[region.regionId].x}, ${anchors[region.regionId].y}`);
    }

    const svgMarkup = renderScenarioSvg({
      countryLabel: scenario.countryLabel,
      countryPath,
      boundaryPaths,
      regionLayers,
    });

    const svgOutputPath = resolve(ROOT, scenario.outputSvg);
    mkdirSync(dirname(svgOutputPath), { recursive: true });
    writeFileSync(svgOutputPath, svgMarkup, 'utf8');
    console.log(`🧱 Wrote ${scenario.outputSvg}`);

    anchorSets.push({ exportName: scenario.markerExport, anchors });
  }

  const anchorModulePath = resolve(ROOT, 'src/mvp/boards/generatedScenarioAnchors.ts');
  writeFileSync(anchorModulePath, renderAnchorModule(anchorSets), 'utf8');
  console.log('✅ Wrote src/mvp/boards/generatedScenarioAnchors.ts');
}

main();
