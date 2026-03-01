import { useEffect, useMemo, useRef, useState } from 'react';
import { getAvailableRegions, type CompiledContent, type DomainId, type EngineState, type RegionId } from '../../engine/index.ts';
import { formatNumber, localizeDomainField, localizeRegionField, t } from '../i18n/index.ts';
import { getRegionDangerState } from './gameUiHelpers.ts';
import { Icon } from './icons/Icon.tsx';
import type { IconType } from './icons/iconTypes.ts';
import {
  BOARD_REGION_MAP_MANIFEST,
  getBoardRegionInteractionPathIds,
  WORLD_MAP_SVG_METADATA,
} from './worldMapSvgManifest.ts';
import {
  extractSvgGeometry,
  getPathDataForId,
  getSignedDistanceToPolygons,
  parsePathToPolygons,
  type Point,
} from './svgPathCentroid.ts';

interface WorldMapBoardProps {
  state: EngineState;
  content: CompiledContent;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId) => void;
}

type RegionTokenType = 'extraction' | 'defense' | 'bodies';

interface RegionTokenPlacement {
  key: string;
  regionId: RegionId;
  type: RegionTokenType;
  stackSize: 1 | 2 | 3;
  x: string;
  y: string;
  tooltip: string;
  size: number;
  rotation: number;
  tilt: number;
}

interface RegionGeometryInfo {
  polygons: Point[][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface MapViewportStyle {
  width: string;
  height: string;
  left: string;
  top: string;
}

const DOMAIN_ICON_BY_ID: Record<DomainId, IconType> = {
  WarMachine: 'frontWar',
  DyingPlanet: 'frontPlanet',
  GildedCage: 'frontCage',
  SilencedTruth: 'frontTruth',
  EmptyStomach: 'frontHunger',
  FossilGrip: 'frontFossil',
  StolenVoice: 'frontVoice',
};

function createSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function toPercentage(value: number, min: number, span: number) {
  return `${((value - min) / span) * 100}%`;
}

function getBoundingBox(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function getRegionTokenTooltip(type: RegionTokenType, stackCount: number, totalCount: number) {
  switch (type) {
    case 'extraction':
      return t(
        'ui.game.regionExtractionTooltip',
        'Extraction Tokens: this stack shows {{stack}} of {{count}}. If the region reaches 6, it is lost. Remove them with Launch Campaign, Build Solidarity, and resistance effects.',
        { stack: stackCount, count: totalCount },
      );
    case 'defense':
      return t(
        'ui.game.regionDefenseTooltip',
        'Defense: this stack shows {{stack}} of {{count}}. Defense absorbs the next system strike here, then clears. Raise it with Defend and supportive effects before the system phase.',
        { stack: stackCount, count: totalCount },
      );
    case 'bodies':
      return t(
        'ui.game.regionBodiesTooltip',
        'Comrades: this stack shows {{stack}} of {{count}}. Comrades are the people and organizing strength in this region. Commit them to Launch Campaign, Build Solidarity, and Defend.',
        { stack: stackCount, count: totalCount },
      );
  }
}

function getRegionGeometry(svgMarkup: string) {
  const geometry = extractSvgGeometry(svgMarkup);
  if (!geometry.viewBox) {
    return {
      viewBox: null,
      regions: {} as Partial<Record<RegionId, RegionGeometryInfo>>,
    };
  }

  const regions: Partial<Record<RegionId, RegionGeometryInfo>> = {};

  for (const regionId of getAvailableRegions()) {
    const polygons = BOARD_REGION_MAP_MANIFEST[regionId].interactionCoverage
      .flatMap((id) => getPathDataForId(geometry, id))
      .flatMap((pathData) => parsePathToPolygons(pathData));

    if (polygons.length === 0) {
      continue;
    }

    const bounds = polygons.map(getBoundingBox).reduce((merged, box) => ({
      minX: Math.min(merged.minX, box.minX),
      minY: Math.min(merged.minY, box.minY),
      maxX: Math.max(merged.maxX, box.maxX),
      maxY: Math.max(merged.maxY, box.maxY),
    }));
    regions[regionId] = { polygons, bounds };
  }

  return { viewBox: geometry.viewBox, regions };
}

function buildMapViewport(
  viewBox: [number, number, number, number],
  regionGeometry: Partial<Record<RegionId, RegionGeometryInfo>>,
  state: EngineState,
  selectedRegionId: RegionId | null,
) {
  const [minX, minY, width, height] = viewBox;
  const pressuredRegions = getAvailableRegions().filter((regionId) => {
    const region = state.regions[regionId];
    return region.extractionTokens > 0 || region.defenseRating > 0;
  });
  const comradeRegions = getAvailableRegions().filter((regionId) => {
    const region = state.regions[regionId];
    return state.players.some((player) => (region.bodiesPresent[player.seat] ?? 0) > 0);
  });
  const sourceRegionIds = pressuredRegions.length > 0
    ? pressuredRegions
    : selectedRegionId
      ? [selectedRegionId]
      : comradeRegions.length > 0
        ? comradeRegions
        : getAvailableRegions();
  const visibleRegions = sourceRegionIds
    .map((regionId) => regionGeometry[regionId])
    .filter((entry): entry is RegionGeometryInfo => Boolean(entry));

  if (visibleRegions.length === 0) {
    return {
      width: WORLD_MAP_SVG_METADATA.viewport.canvasWidth,
      height: WORLD_MAP_SVG_METADATA.viewport.canvasHeight,
      left: WORLD_MAP_SVG_METADATA.viewport.canvasLeft,
      top: WORLD_MAP_SVG_METADATA.viewport.canvasTop,
    } satisfies MapViewportStyle;
  }

  const bounds = visibleRegions.reduce(
    (merged, region) => ({
      minX: Math.min(merged.minX, region.bounds.minX),
      minY: Math.min(merged.minY, region.bounds.minY),
      maxX: Math.max(merged.maxX, region.bounds.maxX),
      maxY: Math.max(merged.maxY, region.bounds.maxY),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const marginX = width * 0.045;
  const marginY = height * 0.05;
  const paddedWidth = Math.min(width, bounds.maxX - bounds.minX + marginX * 2);
  const paddedHeight = Math.min(height, bounds.maxY - bounds.minY + marginY * 2);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const baseWidthPercent = Number.parseFloat(WORLD_MAP_SVG_METADATA.viewport.canvasWidth);
  const baseHeightPercent = Number.parseFloat(WORLD_MAP_SVG_METADATA.viewport.canvasHeight);
  const baseVisibleWidth = 100 / baseWidthPercent;
  const baseVisibleHeight = 100 / baseHeightPercent;
  const targetWidthFraction = paddedWidth / width;
  const targetHeightFraction = paddedHeight / height;
  const scale = Math.min(baseVisibleWidth / targetWidthFraction, baseVisibleHeight / targetHeightFraction, 4);
  const widthPercent = baseWidthPercent * scale;
  const heightPercent = baseHeightPercent * scale;
  const centerXFraction = (centerX - minX) / width;
  const centerYFraction = (centerY - minY) / height;

  return {
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    left: `${50 - centerXFraction * widthPercent}%`,
    top: `${50 - centerYFraction * heightPercent}%`,
  } satisfies MapViewportStyle;
}

function buildStacks(total: number): Array<1 | 2 | 3> {
  if (total <= 0) {
    return [];
  }
  const fullStacks = Math.floor(total / 3);
  const remainder = total % 3;
  const stacks: Array<1 | 2 | 3> = Array.from({ length: fullStacks }, () => 3 as const);
  if (remainder > 0) {
    stacks.push(remainder as 1 | 2 | 3);
  }
  return stacks;
}

function buildRegionTokenPlacements(
  viewBox: [number, number, number, number],
  regionGeometry: Partial<Record<RegionId, RegionGeometryInfo>>,
  state: EngineState,
) {
  const [minX, minY, width, height] = viewBox;
  const placements: Partial<Record<RegionId, RegionTokenPlacement[]>> = {};

  for (const regionId of getAvailableRegions()) {
    const geometry = regionGeometry[regionId];
    if (!geometry) {
      placements[regionId] = [];
      continue;
    }

    const { polygons, bounds } = geometry;
    const region = state.regions[regionId];
    const totalBodies = state.players.reduce((sum, player) => sum + (region.bodiesPresent[player.seat] ?? 0), 0);
    const tokenStacks: Array<{ type: RegionTokenType; stackSize: 1 | 2 | 3; total: number }> = [
      ...buildStacks(region.extractionTokens).map((stackSize) => ({ type: 'extraction' as const, stackSize, total: region.extractionTokens })),
      ...buildStacks(region.defenseRating).map((stackSize) => ({ type: 'defense' as const, stackSize, total: region.defenseRating })),
      ...buildStacks(totalBodies).map((stackSize) => ({ type: 'bodies' as const, stackSize, total: totalBodies })),
    ];

    const regionPlacements: RegionTokenPlacement[] = [];
    const placed: Array<{ x: number; y: number; radius: number }> = [];
    const minDimension = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const baseSize = Math.max(30, Math.min(60, minDimension / 3.6));

    tokenStacks.forEach((token, index) => {
      const random = createRandom(createSeed(`${regionId}-${token.type}-${index}-${token.stackSize}`));
      const tokenSize = Math.round(baseSize + (random() - 0.5) * Math.max(2, baseSize * 0.18));
      let position: Point | null = null;
      let minDistance = tokenSize * 0.95;

      for (let attempt = 0; attempt < 180 && !position; attempt += 1) {
        if (attempt > 0 && attempt % 45 === 0) {
          minDistance *= 0.9;
        }

        const candidate = {
          x: bounds.minX + random() * (bounds.maxX - bounds.minX),
          y: bounds.minY + random() * (bounds.maxY - bounds.minY),
        };
        const edgeDistance = getSignedDistanceToPolygons(candidate, polygons);
        if (edgeDistance < tokenSize * 0.68) {
          continue;
        }

        const collides = placed.some((current) => {
          const dx = current.x - candidate.x;
          const dy = current.y - candidate.y;
          return Math.sqrt(dx * dx + dy * dy) < current.radius + minDistance;
        });

        if (!collides) {
          position = candidate;
        }
      }

      const fallback = position ?? {
        x: bounds.minX + ((index + 1) / (tokenStacks.length + 1)) * (bounds.maxX - bounds.minX),
        y: bounds.minY + ((index % 3) + 1) / 4 * (bounds.maxY - bounds.minY),
      };

      const rotation = Math.round((random() - 0.5) * 22);
      const tilt = Math.round((random() - 0.5) * 8);

      placed.push({ ...fallback, radius: tokenSize * 0.55 });
      regionPlacements.push({
        key: `${regionId}-${token.type}-${index}`,
        regionId,
        type: token.type,
        stackSize: token.stackSize,
        x: toPercentage(fallback.x, minX, width),
        y: toPercentage(fallback.y, minY, height),
        tooltip: getRegionTokenTooltip(token.type, token.stackSize, token.total),
        size: tokenSize,
        rotation,
        tilt,
      });
    });

    placements[regionId] = regionPlacements;
  }

  return placements;
}

export function WorldMapBoard({
  state,
  content,
  selectedRegionId,
  onSelectRegion,
}: WorldMapBoardProps) {
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [tokenPlacements, setTokenPlacements] = useState<Partial<Record<RegionId, RegionTokenPlacement[]>>>({});
  const [mapViewport, setMapViewport] = useState<MapViewportStyle>({
    width: WORLD_MAP_SVG_METADATA.viewport.canvasWidth,
    height: WORLD_MAP_SVG_METADATA.viewport.canvasHeight,
    left: WORLD_MAP_SVG_METADATA.viewport.canvasLeft,
    top: WORLD_MAP_SVG_METADATA.viewport.canvasTop,
  });
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const regionIds = getAvailableRegions();
  const boardState = useMemo(() => ({
    warCritical: state.northernWarMachine >= 9,
    gazeElevated: state.globalGaze >= 15,
    regionCritical: regionIds.some((regionId) => state.regions[regionId].extractionTokens >= 5),
  }), [regionIds, state.globalGaze, state.northernWarMachine, state.regions]);
  const cardRegionId = hoveredRegionId ?? selectedRegionId ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadSvg = async () => {
      const response = await fetch(WORLD_MAP_SVG_METADATA.assetPath);
      const markup = await response.text();
      if (!cancelled) {
        setSvgMarkup(markup);
      }
    };

    void loadSvg();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!svgMarkup) {
      return;
    }

    const geometry = getRegionGeometry(svgMarkup);
    if (!geometry.viewBox) {
      return;
    }

    setMapViewport(buildMapViewport(geometry.viewBox, geometry.regions, state, selectedRegionId));
    setTokenPlacements(buildRegionTokenPlacements(geometry.viewBox, geometry.regions, state));
  }, [selectedRegionId, svgMarkup, state]);

  useEffect(() => {
    if (!svgHostRef.current || !svgMarkup) {
      return;
    }

    svgHostRef.current.innerHTML = svgMarkup;
    const rootSvg = svgHostRef.current.querySelector('svg');
    if (!rootSvg) {
      return;
    }

    rootSvg.classList.add('board-world-map-svg');
    const interactionRegionByPathId = new Map<string, RegionId>();

    for (const regionId of regionIds) {
      for (const id of getBoardRegionInteractionPathIds(regionId)) {
        interactionRegionByPathId.set(id, regionId);
      }
    }

    const getRegionIdFromEventTarget = (eventTarget: EventTarget | null) => {
      if (!(eventTarget instanceof Element)) {
        return null;
      }

      const svgNode = eventTarget.closest('[id]');
      if (!svgNode) {
        return null;
      }

      return interactionRegionByPathId.get(svgNode.id) ?? null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      setHoveredRegionId(getRegionIdFromEventTarget(event.target));
    };

    const handlePointerLeave = () => {
      setHoveredRegionId(null);
    };

    const handleClick = (event: MouseEvent) => {
      const regionId = getRegionIdFromEventTarget(event.target);
      if (!regionId) {
        return;
      }
      event.stopPropagation();
      onSelectRegion(regionId);
    };

    rootSvg.addEventListener('pointermove', handlePointerMove);
    rootSvg.addEventListener('pointerleave', handlePointerLeave);
    rootSvg.addEventListener('click', handleClick);

    return () => {
      rootSvg.removeEventListener('pointermove', handlePointerMove);
      rootSvg.removeEventListener('pointerleave', handlePointerLeave);
      rootSvg.removeEventListener('click', handleClick);
    };
  }, [onSelectRegion, regionIds, svgMarkup]);

  useEffect(() => {
    if (!svgHostRef.current || !svgMarkup) {
      return;
    }

    const rootSvg = svgHostRef.current.querySelector('svg');
    if (!rootSvg) {
      return;
    }

    const allCoverageIds = new Set(regionIds.flatMap((regionId) => BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage));
    for (const id of allCoverageIds) {
      const target = rootSvg.querySelector(`#${id}`);
      if (!target) {
        continue;
      }
      target.classList.remove('map-region-fill-active', 'map-region-fill-hover');
    }

    if (!hoveredRegionId) {
      return;
    }

    for (const regionId of [hoveredRegionId]) {
      for (const id of BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-hover');
        }
      }
    }
  }, [hoveredRegionId, regionIds, svgMarkup]);

  return (
    <section
      className="board-map-shell"
      data-war-critical={boardState.warCritical}
      data-gaze-elevated={boardState.gazeElevated}
      data-region-critical={boardState.regionCritical}
    >
      <div
        className="board-map-canvas"
        style={{
          ['--map-canvas-width' as string]: mapViewport.width,
          ['--map-canvas-height' as string]: mapViewport.height,
          ['--map-canvas-left' as string]: mapViewport.left,
          ['--map-canvas-top' as string]: mapViewport.top,
        }}
      >
        <div ref={svgHostRef} className="board-world-map" aria-hidden="true" />

        {cardRegionId ? (
          <article className="board-region-sidecard">
            <span className="context-eyebrow">{t('ui.game.regionSummary', 'Region')}</span>
            <strong>{localizeRegionField(cardRegionId, 'name', content.regions[cardRegionId].name)}</strong>
            <p>{localizeRegionField(cardRegionId, 'strapline', content.regions[cardRegionId].strapline)}</p>
            <div className="board-region-sidecard-metrics">
              <span>
                <Icon type="extraction" size={15} />
                {t('ui.game.extraction', 'Extraction')} {formatNumber(state.regions[cardRegionId].extractionTokens)}
              </span>
              <span>
                <Icon type="defense" size={15} />
                {t('ui.game.defense', 'Defense')} {formatNumber(state.regions[cardRegionId].defenseRating)}
              </span>
              <span>
                <Icon type="bodies" size={15} />
                {t('ui.game.bodies', 'Comrades')} {formatNumber(
                  state.players.reduce((sum, player) => sum + (state.regions[cardRegionId].bodiesPresent[player.seat] ?? 0), 0),
                )}
              </span>
            </div>
            <div className="board-region-sidecard-fronts">
              {(Object.entries(state.regions[cardRegionId].vulnerability) as Array<[DomainId, number]>)
                .sort((left, right) => right[1] - left[1])
                .slice(0, 3)
                .map(([domainId, value]) => (
                  <span key={domainId}>
                    <Icon type={DOMAIN_ICON_BY_ID[domainId]} size={15} />
                    {localizeDomainField(domainId, 'name', content.domains[domainId].name)} {formatNumber(value)}
                  </span>
                ))}
            </div>
          </article>
        ) : null}

        {regionIds.flatMap((regionId) => {
          const region = state.regions[regionId];
          const danger = getRegionDangerState(region.extractionTokens);
          return (tokenPlacements[regionId] ?? []).map((placement) => (
            <button
              key={placement.key}
              type="button"
              className={`region-token-marker region-token-marker-${placement.type} ${selectedRegionId === regionId ? 'is-selected' : ''}`.trim()}
              data-region-tone={danger.tone}
              data-region-pulsing={danger.pulsing}
              data-tooltip={placement.tooltip}
              aria-label={placement.tooltip}
              onClick={() => onSelectRegion(regionId)}
              onMouseEnter={() => setHoveredRegionId(regionId)}
              onMouseLeave={() => setHoveredRegionId((current) => (current === regionId ? null : current))}
              style={{
                ['--map-point-x' as string]: placement.x,
                ['--map-point-y' as string]: placement.y,
                ['--region-tone' as string]: danger.color,
                ['--token-size' as string]: `${placement.size}px`,
                ['--token-rotation' as string]: `${placement.rotation}deg`,
                ['--token-tilt' as string]: `${placement.tilt}deg`,
              }}
            >
              <span className="region-token-face" data-stack-size={placement.stackSize}></span>
            </button>
          ));
        })}
      </div>
    </section>
  );
}
