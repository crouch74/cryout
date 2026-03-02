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
  parsePathToPolygons,
  type Point,
} from './svgPathCentroid.ts';
import { useTransientHighlightKeys } from './useTransientHighlights.ts';
import { buildRegionCountSummary, buildRegionLayouts } from './worldMapTokenLayout.ts';
import { buildFocusedMapViewport, getUnionBounds } from './worldMapViewport.ts';

interface WorldMapBoardProps {
  state: EngineState;
  content: CompiledContent;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId) => void;
  debugLayout?: boolean;
  campaignRoll?: {
    seq: number;
    regionId: RegionId;
    total: number;
    modifier: number;
    dieOne: number;
    dieTwo: number;
    success: boolean;
  } | null;
}

interface RegionGeometryInfo {
  polygons: Point[][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
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

function getRegionSummaryLabel(regionId: RegionId, state: EngineState, content: CompiledContent) {
  const region = state.regions[regionId];
  const totalBodies = state.players.reduce((sum, player) => sum + (region.bodiesPresent[player.seat] ?? 0), 0);
  return `${localizeRegionField(regionId, 'name', content.regions[regionId].name)}. `
    + `${t('ui.game.extraction', 'Extraction')} ${region.extractionTokens}. `
    + `${t('ui.game.defense', 'Defense')} ${region.defenseRating}. `
    + `${t('ui.game.bodies', 'Bodies')} ${totalBodies}.`;
}

export function WorldMapBoard({
  state,
  content,
  selectedRegionId,
  onSelectRegion,
  debugLayout = false,
  campaignRoll = null,
}: WorldMapBoardProps) {
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
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
    if (!canvasRef.current) {
      return;
    }

    const node = canvasRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setCanvasSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const geometry = useMemo(() => (svgMarkup ? getRegionGeometry(svgMarkup) : { viewBox: null, regions: {} }), [svgMarkup]);
  const focusRegionIds = useMemo(() => {
    const pressuredRegions = regionIds.filter((regionId) => {
      const region = state.regions[regionId];
      return region.extractionTokens > 0 || region.defenseRating > 0;
    });
    if (pressuredRegions.length > 0) {
      return pressuredRegions;
    }

    if (selectedRegionId) {
      return [selectedRegionId];
    }

    const comradeRegions = regionIds.filter((regionId) => {
      const region = state.regions[regionId];
      return state.players.some((player) => (region.bodiesPresent[player.seat] ?? 0) > 0);
    });

    return comradeRegions;
  }, [regionIds, selectedRegionId, state.players, state.regions]);

  const mapCamera = useMemo(() => {
    if (!geometry.viewBox) {
      return null;
    }

    const targetAspectRatio = canvasSize.width > 0 && canvasSize.height > 0
      ? canvasSize.width / canvasSize.height
      : geometry.viewBox[2] / geometry.viewBox[3];
    const focusBounds = getUnionBounds(
      focusRegionIds
        .map((regionId) => geometry.regions[regionId]?.bounds)
        .filter((entry): entry is RegionGeometryInfo['bounds'] => Boolean(entry)),
    );

    return buildFocusedMapViewport({
      viewBox: geometry.viewBox,
      defaultViewport: WORLD_MAP_SVG_METADATA.viewport,
      focusBounds,
      targetAspectRatio,
      focusBlend: focusRegionIds.length <= 1 ? 0.55 : 0.35,
      marginXRatio: 0.08,
      marginYRatio: 0.10,
      minWidthRatio: 0.78,
      minHeightRatio: 0.84,
    });
  }, [canvasSize.height, canvasSize.width, focusRegionIds, geometry]);
  const mapViewport = mapCamera?.viewport ?? WORLD_MAP_SVG_METADATA.viewport;

  const regionCounts = useMemo(() => Object.fromEntries(
    regionIds.map((regionId) => {
      const region = state.regions[regionId];
      const totalBodies = state.players.reduce((sum, player) => sum + (region.bodiesPresent[player.seat] ?? 0), 0);
      return [regionId, buildRegionCountSummary(region.extractionTokens, region.defenseRating, totalBodies)];
    }),
  ) as Record<RegionId, ReturnType<typeof buildRegionCountSummary>>, [regionIds, state.players, state.regions]);
  const regionChangeSignatures = useMemo(
    () => Object.fromEntries(
      regionIds.flatMap((regionId) => {
        const counts = regionCounts[regionId];
        return [
          [`region:${regionId}`, `${counts.extraction}-${counts.defense}-${counts.bodies}`],
          [`region:${regionId}:extraction`, counts.extraction],
          [`region:${regionId}:defense`, counts.defense],
          [`region:${regionId}:bodies`, counts.bodies],
        ];
      }),
    ),
    [regionCounts, regionIds],
  );
  const highlightedRegionKeys = useTransientHighlightKeys(regionChangeSignatures, 1800);

  const regionLayouts = useMemo(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0 || !mapCamera) {
      return null;
    }

    return buildRegionLayouts({
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      mapViewport,
      defaultVisibleWorldWidth: mapCamera.defaultBounds.maxX - mapCamera.defaultBounds.minX,
      currentVisibleWorldWidth: mapCamera.bounds.maxX - mapCamera.bounds.minX,
      regionIds,
      selectedRegionId,
      regionCounts,
      manifest: BOARD_REGION_MAP_MANIFEST,
    });
  }, [canvasSize.height, canvasSize.width, mapCamera, mapViewport, regionCounts, regionIds, selectedRegionId]);

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

    const activeRegionIds = [selectedRegionId].filter((entry): entry is RegionId => Boolean(entry));
    const hoverRegionIds = [hoveredRegionId].filter((entry): entry is RegionId => Boolean(entry));

    for (const regionId of activeRegionIds) {
      for (const id of BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-active');
        }
      }
    }

    for (const regionId of hoverRegionIds) {
      for (const id of BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-hover');
        }
      }
    }
  }, [hoveredRegionId, regionIds, selectedRegionId, svgMarkup]);

  return (
    <section
      className="board-map-shell"
      data-war-critical={boardState.warCritical}
      data-gaze-elevated={boardState.gazeElevated}
      data-region-critical={boardState.regionCritical}
    >
      <div
        ref={canvasRef}
        className="board-map-canvas"
        style={{
          ['--map-canvas-width' as string]: mapViewport.canvasWidth,
          ['--map-canvas-height' as string]: mapViewport.canvasHeight,
          ['--map-canvas-left' as string]: mapViewport.canvasLeft,
          ['--map-canvas-top' as string]: mapViewport.canvasTop,
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
                {t('ui.game.bodies', 'Bodies')} {formatNumber(
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

        {campaignRoll && regionLayouts?.[campaignRoll.regionId] ? (
          <article
            className={`campaign-roll-overlay ${campaignRoll.success ? 'is-success' : 'is-failure'}`.trim()}
            style={{
              left: `${regionLayouts[campaignRoll.regionId].position.x}px`,
              top: `${regionLayouts[campaignRoll.regionId].position.y}px`,
              zIndex: regionLayouts[campaignRoll.regionId].zIndex + 2,
            }}
          >
            <span className="campaign-roll-overlay-eyebrow">{t('ui.game.launchCampaign', 'Launch Campaign')}</span>
            <strong>{formatNumber(campaignRoll.total)}</strong>
            <span>
              {formatNumber(campaignRoll.dieOne)} + {formatNumber(campaignRoll.dieTwo)} + {formatNumber(campaignRoll.modifier)}
            </span>
          </article>
        ) : null}

        <div className="board-region-clusters">
          {regionLayouts
            ? regionIds.map((regionId) => {
              const region = state.regions[regionId];
              const danger = getRegionDangerState(region.extractionTokens);
              const layout = regionLayouts[regionId];
              const label = localizeRegionField(regionId, 'name', content.regions[regionId].name);
              const regionChanging = highlightedRegionKeys.has(`region:${regionId}`);

              return (
                <button
                  key={regionId}
                  type="button"
                  className={`board-region-cluster ${selectedRegionId === regionId ? 'is-selected' : ''} ${regionChanging ? 'is-changing' : ''}`.trim()}
                  data-region-tone={danger.tone}
                  data-region-pulsing={danger.pulsing}
                  data-region-changing={regionChanging}
                  aria-label={getRegionSummaryLabel(regionId, state, content)}
                  onClick={() => onSelectRegion(regionId)}
                  onMouseEnter={() => setHoveredRegionId(regionId)}
                  onMouseLeave={() => setHoveredRegionId((current) => (current === regionId ? null : current))}
                  style={{
                    left: `${layout.position.x}px`,
                    top: `${layout.position.y}px`,
                    width: `${layout.cluster.width}px`,
                    height: `${layout.cluster.height}px`,
                    zIndex: layout.zIndex,
                    ['--cluster-width' as string]: `${layout.cluster.width}px`,
                    ['--cluster-height' as string]: `${layout.cluster.height}px`,
                    ['--cluster-natural-width' as string]: `${layout.cluster.naturalWidth}px`,
                    ['--cluster-natural-height' as string]: `${layout.cluster.naturalHeight}px`,
                    ['--cluster-scale' as string]: String(layout.cluster.scale),
                    ['--region-tone' as string]: danger.color,
                  }}
                >
                  <span
                    className="board-region-label"
                    style={{
                      left: '50%',
                      top: `calc(50% + ${layout.label.y}px)`,
                    }}
                  >
                    {label}
                  </span>

                  <span className="board-region-token-container">
                    {layout.cluster.items.map((item) => (
                      <span
                        key={`${regionId}-${item.type}`}
                        className={`board-region-token-group board-region-token-group-${item.type} ${highlightedRegionKeys.has(`region:${regionId}:${item.type}`) ? 'is-changing' : ''}`.trim()}
                        data-token-changing={highlightedRegionKeys.has(`region:${regionId}:${item.type}`)}
                        style={{
                          left: `${item.x}px`,
                          top: `${item.y}px`,
                          width: `${item.width}px`,
                          height: `${item.height}px`,
                        }}
                      >
                        {item.units.map((unit, unitIndex) => (
                          <span
                            key={unit.key}
                            className={`board-region-token board-region-token-${unit.type}`}
                            style={{
                              left: `${item.width / 2 + unit.x}px`,
                              top: `${item.height / 2 + unit.y}px`,
                              width: `${layout.cluster.tokenSize}px`,
                              height: `${layout.cluster.tokenSize}px`,
                              ['--token-index' as string]: String(unitIndex),
                            }}
                          />
                        ))}
                        {item.overflowBadge ? (
                          <span
                            className="board-region-overflow-badge"
                            style={{
                              left: `${item.width / 2 + item.overflowBadge.x}px`,
                              top: `${item.height / 2 + item.overflowBadge.y}px`,
                            }}
                          >
                            {item.overflowBadge.label}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })
            : null}
        </div>

        {debugLayout && regionLayouts ? (
          <div className="board-region-debug-overlay" aria-hidden="true">
            {regionIds.map((regionId) => {
              const layout = regionLayouts[regionId];
              const vectorLength = Math.hypot(layout.resolvedOffset.x, layout.resolvedOffset.y);
              const vectorAngle = Math.atan2(layout.resolvedOffset.y, layout.resolvedOffset.x);

              return (
                <div key={`debug-${regionId}`}>
                  <span
                    className="board-region-debug-radius"
                    style={{
                      left: `${layout.anchor.snappedX}px`,
                      top: `${layout.anchor.snappedY}px`,
                      width: `${layout.cluster.radius * 2}px`,
                      height: `${layout.cluster.radius * 2}px`,
                    }}
                  />
                  <span
                    className="board-region-debug-anchor"
                    style={{
                      left: `${layout.anchor.snappedX}px`,
                      top: `${layout.anchor.snappedY}px`,
                    }}
                  />
                  <span
                    className="board-region-debug-crosshair"
                    style={{
                      left: `${layout.anchor.snappedX}px`,
                      top: `${layout.anchor.snappedY}px`,
                    }}
                  />
                  {vectorLength > 0 ? (
                    <span
                      className="board-region-debug-vector"
                      style={{
                        left: `${layout.anchor.snappedX}px`,
                        top: `${layout.anchor.snappedY}px`,
                        width: `${vectorLength}px`,
                        transform: `translateY(-50%) rotate(${vectorAngle}rad)`,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
