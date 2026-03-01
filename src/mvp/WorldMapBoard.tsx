import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getAvailableRegions, type CompiledContent, type EngineState, type RegionId } from '../../engine/index.ts';
import { localizeRegionField } from '../i18n/index.ts';
import { RegionHoverCard } from './RegionHoverCard.tsx';
import { getRegionDangerState } from './gameUiHelpers.ts';
import {
  BOARD_REGION_MAP_MANIFEST,
  getBoardRegionAnchorPathIds,
  getBoardRegionInteractionPathIds,
  WORLD_MAP_SVG_METADATA,
} from './worldMapSvgManifest.ts';
import { computeRegionInteriorAnchorPercentages } from './svgPathCentroid.ts';

interface WorldMapBoardProps {
  state: EngineState;
  content: CompiledContent;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId) => void;
  onClearSelection?: () => void;
  selectedRegionPopup?: ReactNode;
}

function getCoverageByRegion() {
  return Object.fromEntries(
    getAvailableRegions().map((regionId) => [regionId, getBoardRegionAnchorPathIds(regionId)]),
  ) as Record<RegionId, string[]>;
}

function getStrainLabel(extractionTokens: number) {
  if (extractionTokens >= 6) {
    return 'Breach line';
  }
  if (extractionTokens >= 5) {
    return 'Near collapse';
  }
  if (extractionTokens >= 3) {
    return 'Strained';
  }
  return 'Holding';
}

function getMarkerPosition(regionId: RegionId, computed: { x: string; y: string } | undefined) {
  return computed ?? BOARD_REGION_MAP_MANIFEST[regionId].marker;
}

export function WorldMapBoard({
  state,
  content,
  selectedRegionId,
  onSelectRegion,
  onClearSelection,
  selectedRegionPopup,
}: WorldMapBoardProps) {
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [computedAnchors, setComputedAnchors] = useState<Partial<Record<RegionId, { x: string; y: string }>>>({});
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ opacity: 0 });
  const boardRef = useRef<HTMLElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLElement | null>(null);
  const markerRefs = useRef<Partial<Record<RegionId, HTMLButtonElement | null>>>({});
  const regionIds = getAvailableRegions();
  const activeRegionId = selectedRegionId
    ?? regionIds.slice().sort((left, right) => state.regions[right].extractionTokens - state.regions[left].extractionTokens)[0];

  const boardState = useMemo(() => ({
    warCritical: state.northernWarMachine >= 9,
    gazeElevated: state.globalGaze >= 15,
    regionCritical: regionIds.some((regionId) => state.regions[regionId].extractionTokens >= 5),
  }), [regionIds, state.globalGaze, state.northernWarMachine, state.regions]);

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

    setComputedAnchors(computeRegionInteriorAnchorPercentages(svgMarkup, getCoverageByRegion()));
  }, [svgMarkup]);

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

    const emphasized = new Set<RegionId>([activeRegionId]);
    if (hoveredRegionId) {
      emphasized.add(hoveredRegionId);
    }

    for (const regionId of emphasized) {
      for (const id of BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add(regionId === hoveredRegionId ? 'map-region-fill-hover' : 'map-region-fill-active');
        }
      }
    }
  }, [activeRegionId, hoveredRegionId, regionIds, svgMarkup]);

  const hoverRegionId = hoveredRegionId ?? activeRegionId;
  const hoverRegion = state.regions[hoverRegionId];
  const hoverBodies = state.players.reduce((sum, player) => sum + (hoverRegion.bodiesPresent[player.seat] ?? 0), 0);

  useLayoutEffect(() => {
    if (!selectedRegionId || !boardRef.current || !popupRef.current || !markerRefs.current[selectedRegionId]) {
      setPopupStyle({ opacity: 0 });
      return;
    }

    const boardRect = boardRef.current.getBoundingClientRect();
    const markerRect = markerRefs.current[selectedRegionId]!.getBoundingClientRect();
    const popupRect = popupRef.current.getBoundingClientRect();
    const markerCenterX = markerRect.left - boardRect.left + markerRect.width / 2;
    const markerCenterY = markerRect.top - boardRect.top + markerRect.height / 2;
    const gap = 16;
    const margin = 12;

    let left = markerCenterX + gap;
    let top = markerCenterY - popupRect.height / 2;

    if (left + popupRect.width + margin > boardRect.width) {
      left = markerCenterX - popupRect.width - gap;
    }

    if (left < margin) {
      left = Math.max(margin, Math.min(markerCenterX - popupRect.width / 2, boardRect.width - popupRect.width - margin));
    }

    if (top < margin) {
      top = markerCenterY + gap;
    }

    if (top + popupRect.height + margin > boardRect.height) {
      top = boardRect.height - popupRect.height - margin;
    }

    setPopupStyle({
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      opacity: 1,
    });
  }, [selectedRegionId, computedAnchors, hoveredRegionId]);

  return (
    <section
      ref={boardRef}
      className="board-map-shell"
      data-war-critical={boardState.warCritical}
      data-gaze-elevated={boardState.gazeElevated}
      data-region-critical={boardState.regionCritical}
    >
      <div
        className="board-map-canvas"
        style={{
          ['--map-canvas-width' as string]: WORLD_MAP_SVG_METADATA.viewport.canvasWidth,
          ['--map-canvas-height' as string]: WORLD_MAP_SVG_METADATA.viewport.canvasHeight,
          ['--map-canvas-left' as string]: WORLD_MAP_SVG_METADATA.viewport.canvasLeft,
          ['--map-canvas-top' as string]: WORLD_MAP_SVG_METADATA.viewport.canvasTop,
        }}
      >
        <div ref={svgHostRef} className="board-world-map" aria-hidden="true" />

        {regionIds.map((regionId) => {
          const region = state.regions[regionId];
          const danger = getRegionDangerState(region.extractionTokens);
          const marker = getMarkerPosition(regionId, computedAnchors[regionId]);
          const totalBodies = state.players.reduce((sum, player) => sum + (region.bodiesPresent[player.seat] ?? 0), 0);

          return (
            <button
              key={regionId}
              ref={(element) => {
                markerRefs.current[regionId] = element;
              }}
              type="button"
              className={`region-token-marker ${activeRegionId === regionId ? 'is-selected' : ''}`.trim()}
              data-region-tone={danger.tone}
              data-region-pulsing={danger.pulsing}
              onClick={() => onSelectRegion(regionId)}
              onMouseEnter={() => setHoveredRegionId(regionId)}
              onMouseLeave={() => setHoveredRegionId((current) => (current === regionId ? null : current))}
              style={{
                ['--map-point-x' as string]: marker.x,
                ['--map-point-y' as string]: marker.y,
                ['--region-tone' as string]: danger.color,
              }}
            >
              <span className="sr-only">{localizeRegionField(regionId, 'name', content.regions[regionId].name)}</span>
              <span className="region-token-ring" />
              <span className="region-token-stack">
                <span className="region-token-title">{localizeRegionField(regionId, 'name', content.regions[regionId].name)}</span>
                <span className="region-token-row">
                  <span className="region-token-count extraction-count">{region.extractionTokens}</span>
                  <span className="region-token-count defense-count">{region.defenseRating}</span>
                  <span className="region-token-count bodies-count">{totalBodies}</span>
                </span>
              </span>
            </button>
          );
        })}

        <div className="board-map-hover">
          {!selectedRegionId ? (
            <RegionHoverCard
              regionName={localizeRegionField(hoverRegionId, 'name', content.regions[hoverRegionId].name)}
              extraction={hoverRegion.extractionTokens}
              defense={hoverRegion.defenseRating}
              bodies={hoverBodies}
              strainLabel={getStrainLabel(hoverRegion.extractionTokens)}
            />
          ) : null}
        </div>

        {selectedRegionId && selectedRegionPopup ? (
          <article ref={popupRef} className="selected-region-popup" style={popupStyle}>
            {selectedRegionPopup}
            {onClearSelection ? (
              <button type="button" className="selected-region-popup-close" onClick={onClearSelection} aria-label="Close region panel">
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
