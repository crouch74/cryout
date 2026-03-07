import { useEffect, useMemo, useRef, useState } from 'react';
import { getAvailableRegions, type BoardRegionMapEntry, type CompiledContent, type DomainId, type EngineState, type RegionId } from '../../engine/index.ts';
import { formatNumber, localizeDomainField, localizeRegionField, t } from '../../i18n/index.ts';
import { getRegionDangerState } from '../presentation/gameUiHelpers.ts';
import { Icon } from '../../ui/icon/Icon.tsx';
import type { IconType } from '../../ui/icon/iconTypes.ts';
import { getFactionAccent } from '../../theme/factionAccents.ts';
import {
  extractSvgGeometry,
  getPathDataForId,
  parsePathToPolygons,
  type Point,
} from './svgPathCentroid.ts';
import { useTransientHighlightKeys } from '../presentation/useTransientHighlights.ts';
import { buildRegionCountSummary, buildRegionLayouts, type RegionTokenVisual } from './worldMapTokenLayout.ts';
import { buildFocusedMapViewport, getUnionBounds } from './worldMapViewport.ts';

interface WorldMapBoardProps {
  state: EngineState;
  content: CompiledContent;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId) => void;
  externalHighlightKeys?: ReadonlySet<string>;
  suspendHighlights?: boolean;
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
  RevolutionaryWave: 'frontWave',
  PatriarchalGrip: 'frontPatriarchy',
  UnfinishedJustice: 'frontJustice',
};

const REGION_TOKEN_ICON_BY_VISUAL: Record<RegionTokenVisual, IconType> = {
  extraction: 'extractionToken',
  defense: 'defense',
  comrades: 'comrades',
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

function getRegionGeometry(
  svgMarkup: string,
  regionIds: RegionId[],
  boardRegions: Partial<Record<RegionId, BoardRegionMapEntry>>,
) {
  const geometry = extractSvgGeometry(svgMarkup);
  if (!geometry.viewBox) {
    return {
      viewBox: null,
      regions: {} as Partial<Record<RegionId, RegionGeometryInfo>>,
    };
  }

  const regions: Partial<Record<RegionId, RegionGeometryInfo>> = {};

  for (const regionId of regionIds) {
    const manifest = boardRegions[regionId];
    if (!manifest) {
      continue;
    }
    const polygons = manifest.interactionCoverage
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
  if (!region) {
    return localizeRegionField(regionId, 'name', content.regions[regionId]?.name ?? regionId);
  }
  const totalComrades = state.players.reduce((sum, player) => sum + (region.comradesPresent[player.seat] ?? 0), 0);
  return `${localizeRegionField(regionId, 'name', content.regions[regionId].name)}. `
    + `${t('ui.game.extraction', 'Extraction')} ${formatNumber(region.extractionTokens)}. `
    + `${t('ui.game.defense', 'Defense')} ${formatNumber(region.defenseRating)}. `
    + `${t('ui.game.comrades', 'Comrades')} ${formatNumber(totalComrades)}.`;
}

function parseSvgLength(value: string | null, total: number, fallback: number) {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized.endsWith('%')) {
    return (Number.parseFloat(normalized) / 100) * total;
  }
  return Number.parseFloat(normalized);
}

function getControllingSeatForRegion(state: EngineState, regionId: RegionId): number | null {
  const region = state.regions[regionId];
  if (!region) {
    return null;
  }

  let controllingSeat: number | null = null;
  let highestComrades = 0;
  let isTie = false;

  for (const player of state.players) {
    const comrades = region.comradesPresent[player.seat] ?? 0;
    if (comrades <= 0) {
      continue;
    }
    if (comrades > highestComrades) {
      controllingSeat = player.seat;
      highestComrades = comrades;
      isTie = false;
      continue;
    }
    if (comrades === highestComrades) {
      isTie = true;
    }
  }

  return isTie ? null : controllingSeat;
}

export function WorldMapBoard({
  state,
  content,
  selectedRegionId,
  onSelectRegion,
  externalHighlightKeys,
  suspendHighlights = false,
}: WorldMapBoardProps) {
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const regionIds = useMemo(() => getAvailableRegions(content), [content]);
  const board = content.ruleset.board;
  const boardRegions = board.regions as Partial<Record<RegionId, BoardRegionMapEntry>>;
  const boardState = useMemo(() => ({
    warCritical: state.northernWarMachine >= 9,
    gazeElevated: state.globalGaze >= 15,
    regionCritical: regionIds.some((regionId) => (state.regions[regionId]?.extractionTokens ?? 0) >= 5),
  }), [regionIds, state.globalGaze, state.northernWarMachine, state.regions]);
  const cardRegionId = hoveredRegionId ?? selectedRegionId ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadSvg = async () => {
      const response = await fetch(board.assetPath);
      const markup = await response.text();
      if (!cancelled) {
        setSvgMarkup(markup);
      }
    };

    void loadSvg();
    return () => {
      cancelled = true;
    };
  }, [board.assetPath]);

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

  const geometry = useMemo(
    () => (svgMarkup ? getRegionGeometry(svgMarkup, regionIds, boardRegions) : { viewBox: null, regions: {} }),
    [boardRegions, regionIds, svgMarkup],
  );
  const focusRegionIds = useMemo(() => {
    const pressuredRegions = regionIds.filter((regionId) => {
      const region = state.regions[regionId];
      if (!region) return false;
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
      if (!region) return false;
      return state.players.some((player) => (region.comradesPresent[player.seat] ?? 0) > 0);
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
      defaultViewport: board.viewport,
      focusBounds,
      targetAspectRatio,
      focusBlend: focusRegionIds.length <= 1 ? 0.35 : 0.15,
      marginXRatio: 0.0,
      marginYRatio: 0.0,
      minWidthRatio: 1.0,
      minHeightRatio: 1.0,
    });
  }, [board.viewport, canvasSize.height, canvasSize.width, focusRegionIds, geometry]);
  const mapViewport = mapCamera?.viewport ?? board.viewport;

  const regionCounts = useMemo(() => Object.fromEntries(
    regionIds.map((regionId) => {
      const region = state.regions[regionId];
      if (!region) {
        return [regionId, buildRegionCountSummary(0, 0, 0)];
      }
      const totalComrades = state.players.reduce((sum, player) => sum + (region.comradesPresent[player.seat] ?? 0), 0);
      return [regionId, buildRegionCountSummary(region.extractionTokens, region.defenseRating, totalComrades)];
    }),
  ) as Record<RegionId, ReturnType<typeof buildRegionCountSummary>>, [regionIds, state.players, state.regions]);
  const regionChangeSignatures = useMemo(
    () => Object.fromEntries(
      regionIds.flatMap((regionId) => {
        const counts = regionCounts[regionId];
        return [
          [`region:${regionId}`, `${counts.extraction}-${counts.defense}-${counts.comrades}`],
          [`region:${regionId}:extraction`, counts.extraction],
          [`region:${regionId}:defense`, counts.defense],
          [`region:${regionId}:comrades`, counts.comrades],
        ];
      }),
    ),
    [regionCounts, regionIds],
  );
  const highlightedRegionKeys = useTransientHighlightKeys(regionChangeSignatures, 2800, suspendHighlights);
  const activeHighlightKeys = useMemo(
    () => new Set([...highlightedRegionKeys, ...(externalHighlightKeys ?? new Set<string>())]),
    [externalHighlightKeys, highlightedRegionKeys],
  );
  const seatAccentBySeat = useMemo(
    () => Object.fromEntries(
      state.players.map((player) => [player.seat, getFactionAccent(player.factionId, content.factions[player.factionId])]),
    ) as Record<number, string>,
    [content.factions, state.players],
  );
  const regionTerritoryAccentById = useMemo(
    () => Object.fromEntries(
      regionIds.map((regionId) => {
        const controllingSeat = getControllingSeatForRegion(state, regionId);
        const fallbackAccent = boardRegions[regionId]?.accent ?? 'var(--color-accent)';
        return [regionId, controllingSeat === null ? fallbackAccent : (seatAccentBySeat[controllingSeat] ?? fallbackAccent)];
      }),
    ) as Record<RegionId, string>,
    [boardRegions, regionIds, seatAccentBySeat, state],
  );

  const regionLayouts = useMemo(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0 || !mapCamera) {
      return null;
    }

    return buildRegionLayouts({
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      mapViewport,
      sourceViewBox: geometry.viewBox ? { width: geometry.viewBox[2], height: geometry.viewBox[3] } : undefined,
      svgFitMode: 'meet',
      defaultVisibleWorldWidth: mapCamera.defaultBounds.maxX - mapCamera.defaultBounds.minX,
      currentVisibleWorldWidth: mapCamera.bounds.maxX - mapCamera.bounds.minX,
      regionIds,
      selectedRegionId,
      regionCounts,
      manifest: board.regions,
    });
  }, [board.regions, canvasSize.height, canvasSize.width, geometry.viewBox, mapCamera, mapViewport, regionCounts, regionIds, selectedRegionId]);

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
    rootSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    rootSvg.style.background = 'transparent';
    const viewBox = rootSvg.viewBox.baseVal;
    const topLevelRects = rootSvg.querySelectorAll(':scope > rect');
    for (const rect of topLevelRects) {
      const rectWidth = parseSvgLength(rect.getAttribute('width'), viewBox.width, 0);
      const rectHeight = parseSvgLength(rect.getAttribute('height'), viewBox.height, 0);
      const rectX = parseSvgLength(rect.getAttribute('x'), viewBox.width, 0);
      const rectY = parseSvgLength(rect.getAttribute('y'), viewBox.height, 0);
      const coversCanvas = rectWidth >= viewBox.width * 0.98
        && rectHeight >= viewBox.height * 0.98
        && Math.abs(rectX - viewBox.x) <= 1
        && Math.abs(rectY - viewBox.y) <= 1;
      if (!coversCanvas) {
        continue;
      }
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('stroke', 'none');
      rect.setAttribute('aria-hidden', 'true');
    }
    const interactionRegionByPathId = new Map<string, RegionId>();

    for (const regionId of regionIds) {
      const manifest = boardRegions[regionId];
      if (!manifest) {
        continue;
      }
      for (const id of manifest.interactionCoverage) {
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
  }, [boardRegions, onSelectRegion, regionIds, svgMarkup]);

  useEffect(() => {
    if (!svgHostRef.current || !svgMarkup) {
      return;
    }

    const rootSvg = svgHostRef.current.querySelector('svg');
    if (!rootSvg) {
      return;
    }

    for (const regionId of regionIds) {
      const manifest = boardRegions[regionId];
      if (!manifest) {
        continue;
      }
      for (const id of manifest.svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`) as HTMLElement | null;
        if (!target) {
          continue;
        }
        target.style.setProperty('--territory-accent', regionTerritoryAccentById[regionId] ?? manifest.accent);
        target.classList.add('map-region-territory');
        target.classList.remove('map-region-fill-active', 'map-region-fill-hover');
      }
    }

    const activeRegionIds = [selectedRegionId].filter((entry): entry is RegionId => Boolean(entry));
    const hoverRegionIds = [hoveredRegionId].filter((entry): entry is RegionId => Boolean(entry));

    for (const regionId of activeRegionIds) {
      const manifest = boardRegions[regionId];
      if (!manifest) {
        continue;
      }
      for (const id of manifest.svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-active');
        }
      }
    }

    for (const regionId of hoverRegionIds) {
      const manifest = boardRegions[regionId];
      if (!manifest) {
        continue;
      }
      for (const id of manifest.svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-hover');
        }
      }
    }
  }, [boardRegions, hoveredRegionId, regionIds, regionTerritoryAccentById, selectedRegionId, svgMarkup]);

  return (
    <section
      className="board-map-shell"
      data-war-critical={boardState.warCritical}
      data-gaze-elevated={boardState.gazeElevated}
      data-region-critical={boardState.regionCritical}
    >
      {cardRegionId ? (
        <article className="board-region-sidecard">
          <span className="context-eyebrow">{t('ui.game.regionSummary', 'Region')}</span>
          <strong>{localizeRegionField(cardRegionId, 'name', content.regions[cardRegionId].name)}</strong>
          <p>{localizeRegionField(cardRegionId, 'strapline', content.regions[cardRegionId].strapline)}</p>
          <div className="board-region-sidecard-metrics">
            <span>
              <Icon type="extraction" size="sm" />
              {t('ui.game.extraction', 'Extraction')} {formatNumber(state.regions[cardRegionId]?.extractionTokens ?? 0)}
            </span>
            <span>
              <Icon type="defense" size="sm" />
              {t('ui.game.defense', 'Defense')} {formatNumber(state.regions[cardRegionId]?.defenseRating ?? 0)}
            </span>
            <span>
              <Icon type="comrades" size="sm" />
              {t('ui.game.comrades', 'Comrades')} {formatNumber(state.players.reduce((sum, p) => sum + (state.regions[cardRegionId]?.comradesPresent[p.seat] ?? 0), 0))}
            </span>
          </div>
          <div className="board-region-sidecard-fronts">
            {(Object.entries(state.regions[cardRegionId]?.vulnerability ?? {}) as Array<[DomainId, number]>)
              .sort((left, right) => right[1] - left[1])
              .slice(0, 3)
              .map(([domainId, value]) => (
                <span key={domainId}>
                  <Icon type={DOMAIN_ICON_BY_ID[domainId]} size="sm" />
                  {localizeDomainField(domainId, 'name', content.domains[domainId].name, content.id)} {formatNumber(value)}
                </span>
              ))}
          </div>
        </article>
      ) : null}

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

        <div className="board-region-clusters">
          {regionLayouts
            ? regionIds.map((regionId) => {
              const region = state.regions[regionId];
              if (!region || !regionLayouts[regionId]) {
                return null;
              }
              const danger = getRegionDangerState(region.extractionTokens);
              const layout = regionLayouts[regionId];
              const label = localizeRegionField(regionId, 'name', content.regions[regionId]?.name ?? regionId);
              const regionChanging = activeHighlightKeys.has(`region:${regionId}`);

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
                        className={`board-region-token-group board-region-token-group-${item.type} ${activeHighlightKeys.has(`region:${regionId}:${item.type}`) ? 'is-changing' : ''}`.trim()}
                        data-token-changing={activeHighlightKeys.has(`region:${regionId}:${item.type}`)}
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
                              ['--token-rotation' as string]: `${unit.rotationDeg}deg`,
                              ['--token-stack-order' as string]: String(unit.stackOrder),
                            }}
                          >
                            <Icon
                              type={REGION_TOKEN_ICON_BY_VISUAL[unit.type]}
                              size={Math.max(10, Math.round(layout.cluster.tokenSize * 0.78))}
                              strokeWidth={unit.type === 'extraction' ? 2.45 : 2.15}
                              ariaHidden
                              className="board-region-token-icon"
                            />
                          </span>
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
      </div>
    </section>
  );
}
