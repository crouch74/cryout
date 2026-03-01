import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { getAvailableRegions, type CompiledContent, type EngineState, type RegionId } from '../../engine/index.ts';
import {
  formatNumber,
  localizeBeaconField,
  localizeDomainField,
  localizeRegionField,
  t,
} from '../i18n/index.ts';
import {
  BOARD_REGION_MAP_MANIFEST,
  getBoardRegionAnchorPathIds,
  getBoardRegionInteractionPathIds,
  WORLD_MAP_SVG_METADATA,
} from './worldMapSvgManifest.ts';
import { computeRegionAnchorPercentages } from './svgPathCentroid.ts';

interface WorldMapBoardProps {
  state: EngineState;
  content: CompiledContent;
  selectedRegionId: RegionId | null;
  onSelectRegion: (regionId: RegionId) => void;
}

function getPressureLevel(extractionTokens: number) {
  if (extractionTokens >= 6) {
    return 'critical';
  }
  if (extractionTokens >= 4) {
    return 'high';
  }
  if (extractionTokens >= 2) {
    return 'medium';
  }
  return 'low';
}

function getDominantVulnerabilities(state: EngineState, regionId: RegionId) {
  return Object.entries(state.regions[regionId].vulnerability)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([domainId]) => domainId);
}

function getCoverageByRegion() {
  return Object.fromEntries(
    getAvailableRegions().map((regionId) => [regionId, getBoardRegionAnchorPathIds(regionId)]),
  ) as Record<RegionId, string[]>;
}

export function WorldMapBoard({
  state,
  content,
  selectedRegionId,
  onSelectRegion,
}: WorldMapBoardProps) {
  const [cardVisible, setCardVisible] = useState(true);
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [computedAnchors, setComputedAnchors] = useState<Partial<Record<RegionId, { x: string; y: string }>>>({});
  const [cardStyle, setCardStyle] = useState<CSSProperties>({ opacity: 0 });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Partial<Record<RegionId, HTMLButtonElement | null>>>({});
  const regionIds = getAvailableRegions();
  const activeRegionId = selectedRegionId
    ?? regionIds.slice().sort((left, right) => state.regions[right].extractionTokens - state.regions[left].extractionTokens)[0];
  const activeRegion = state.regions[activeRegionId];
  const activeRegionMeta = content.regions[activeRegionId];
  const activeRegionLayout = BOARD_REGION_MAP_MANIFEST[activeRegionId];
  const activePressure = getPressureLevel(activeRegion.extractionTokens);
  const visibleBodies = state.players
    .map((player) => ({
      seat: player.seat,
      count: activeRegion.bodiesPresent[player.seat] ?? 0,
    }))
    .filter((entry) => entry.count > 0);
  const activeBeaconSummary = state.mode === 'SYMBOLIC'
    ? state.activeBeaconIds.map((beaconId) => ({
        id: beaconId,
        title: localizeBeaconField(beaconId, 'title', content.beacons[beaconId].title),
        complete: state.beacons[beaconId]?.complete ?? false,
      }))
    : [];
  const highlightedRegionIds = useMemo(() => {
    const ids = new Set<RegionId>();
    if (cardVisible) {
      ids.add(activeRegionId);
    }
    if (hoveredRegionId) {
      ids.add(hoveredRegionId);
    }
    return ids;
  }, [activeRegionId, cardVisible, hoveredRegionId]);

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
    setComputedAnchors(computeRegionAnchorPercentages(svgMarkup, getCoverageByRegion()));
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
        const target = rootSvg.querySelector<SVGElement>(`#${id}`);
        if (!target) {
          continue;
        }
        target.classList.add('map-region-hit');
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
      setCardVisible(true);
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

    const allCoverageIds = new Set(
      regionIds.flatMap((regionId) => BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage),
    );

    for (const id of allCoverageIds) {
      const target = rootSvg.querySelector(`#${id}`);
      if (!target) {
        continue;
      }
      target.classList.remove('map-region-fill-active', 'map-region-fill-hover');
    }

    const hoveredIds = hoveredRegionId ? BOARD_REGION_MAP_MANIFEST[hoveredRegionId].svgCoverage : [];
    for (const id of hoveredIds) {
      const target = rootSvg.querySelector(`#${id}`);
      if (target) {
        target.classList.add('map-region-fill-hover');
      }
    }

    for (const regionId of highlightedRegionIds) {
      for (const id of BOARD_REGION_MAP_MANIFEST[regionId].svgCoverage) {
        const target = rootSvg.querySelector(`#${id}`);
        if (target) {
          target.classList.add('map-region-fill-active');
        }
      }
    }
  }, [highlightedRegionIds, hoveredRegionId, regionIds, svgMarkup]);

  useLayoutEffect(() => {
    if (!cardVisible || !boardRef.current || !cardRef.current || !markerRefs.current[activeRegionId]) {
      return;
    }

    const boardRect = boardRef.current.getBoundingClientRect();
    const markerRect = markerRefs.current[activeRegionId]!.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    const markerCenterX = markerRect.left - boardRect.left + markerRect.width / 2;
    const markerCenterY = markerRect.top - boardRect.top + markerRect.height / 2;
    const margin = 14;
    const gap = 18;

    let left = markerCenterX + gap;
    let top = markerCenterY - cardRect.height / 2;

    if (left + cardRect.width + margin > boardRect.width) {
      left = markerCenterX - cardRect.width - gap;
    }
    if (left < margin) {
      left = Math.min(Math.max(markerCenterX - cardRect.width / 2, margin), boardRect.width - cardRect.width - margin);
    }

    if (top < margin) {
      top = markerCenterY + gap;
    }
    if (top + cardRect.height + margin > boardRect.height) {
      top = boardRect.height - cardRect.height - margin;
    }
    top = Math.max(margin, top);

    setCardStyle({
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      opacity: 1,
    });
  }, [activeRegionId, cardVisible, computedAnchors, hoveredRegionId]);

  return (
    <section className="board-map-theatre" onClick={() => setCardVisible(false)}>
      <div className="board-metric-cluster">
        <article className="printed-meter">
          <span className="engraved-eyebrow">{t('ui.map.viewport', 'World Map')}</span>
          <strong>{t('ui.map.viewportDetail', 'SVG board restored as a live state layer')}</strong>
          <span>{t('ui.map.viewportNote', 'Markers reflect extraction, defense, and bodies on the current six-region ruleset.')}</span>
        </article>
        <article className="printed-meter">
          <span className="engraved-eyebrow">{t('ui.map.selectedRegion', 'Selected Region')}</span>
          <strong>{localizeRegionField(activeRegionId, 'name', activeRegionMeta.name)}</strong>
          <span>{localizeRegionField(activeRegionId, 'strapline', activeRegionMeta.strapline)}</span>
        </article>
      </div>

      <div ref={boardRef} className="board-replica-grid">
        <div className="board-map-viewport">
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
              const regionMeta = content.regions[regionId];
              const layout = BOARD_REGION_MAP_MANIFEST[regionId];
              const totalBodies = state.players.reduce((sum, player) => sum + (region.bodiesPresent[player.seat] ?? 0), 0);
              const marker = computedAnchors[regionId] ?? layout.marker;

              return (
                <button
                  key={regionId}
                  ref={(element) => {
                    markerRefs.current[regionId] = element;
                  }}
                  type="button"
                  className={`region-map-marker ${activeRegionId === regionId ? 'is-active' : ''}`.trim()}
                  data-pressure={getPressureLevel(region.extractionTokens)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCardVisible(true);
                    onSelectRegion(regionId);
                  }}
                  onMouseEnter={() => setHoveredRegionId(regionId)}
                  onMouseLeave={() => setHoveredRegionId((current) => (current === regionId ? null : current))}
                  style={{
                    ['--map-point-x' as string]: marker.x,
                    ['--map-point-y' as string]: marker.y,
                    ['--label-offset-x' as string]: layout.labelOffset.x,
                    ['--label-offset-y' as string]: layout.labelOffset.y,
                    ['--territory-accent' as string]: layout.accent,
                  }}
                >
                  <span className="region-map-label">{localizeRegionField(regionId, 'name', regionMeta.name)}</span>
                  <span className="region-map-anchor" />
                  <span className="region-map-piece-cluster">
                    <span className="token-glyph token-glyph-disc">X{formatNumber(region.extractionTokens)}</span>
                    <span className="token-glyph token-glyph-cube">D{formatNumber(region.defenseRating)}</span>
                    <span className="token-glyph token-glyph-bar">B{formatNumber(totalBodies)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {cardVisible ? (
          <article
            ref={cardRef}
            className="printed-territory is-floating"
            data-pressure={activePressure}
            onClick={(event) => event.stopPropagation()}
            style={{
              ...cardStyle,
              ['--territory-tilt' as string]: activeRegionLayout.territoryTilt,
              ['--territory-accent' as string]: activeRegionLayout.accent,
            }}
          >
            <div className="printed-territory-button">
              <div className="printed-territory-header">
                <span className="printed-territory-caption">{localizeRegionField(activeRegionId, 'strapline', activeRegionMeta.strapline)}</span>
                <button
                  type="button"
                  className="printed-territory-close"
                  onClick={() => setCardVisible(false)}
                  aria-label={t('ui.regionDrawer.close', 'Close')}
                >
                  ×
                </button>
              </div>

              <div className="region-state-tooltip">
                <h3>{localizeRegionField(activeRegionId, 'name', activeRegionMeta.name)}</h3>
                <p>{localizeRegionField(activeRegionId, 'description', activeRegionMeta.description)}</p>
              </div>

              <div className="territory-token-cluster">
                <span className="token-glyph token-glyph-disc">
                  {t('ui.game.extractionShort', 'X')} {formatNumber(activeRegion.extractionTokens)}
                </span>
                <span className="token-glyph token-glyph-cube">
                  {t('ui.game.defenseShort', 'D')} {formatNumber(activeRegion.defenseRating)}
                </span>
                <span className="token-glyph token-glyph-bar">
                  {t('ui.game.vulnerability', 'Vulnerability')} {formatNumber(Math.max(...Object.values(activeRegion.vulnerability), 0))}
                </span>
              </div>

              <div className="region-tooltip-ledger">
                <span>
                  {t('ui.map.dominantDomains', 'Pressure line')}: {getDominantVulnerabilities(state, activeRegionId)
                    .map((domainId) => localizeDomainField(domainId, 'name', content.domains[domainId as keyof typeof content.domains].name))
                    .join(', ')}
                </span>
                <span>
                  {t('ui.map.bodiesPresent', 'Bodies present')}: {visibleBodies.length === 0
                    ? t('ui.debug.none', 'none')
                    : visibleBodies.map((entry) => `${t('ui.game.seatShort', 'S')}${formatNumber(entry.seat + 1)}:${formatNumber(entry.count)}`).join(' • ')}
                </span>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <div className="board-metric-cluster">
        <article className="printed-meter">
          <span className="engraved-eyebrow">{t('ui.game.currentObjective', 'Current Objective')}</span>
          <strong>
            {state.mode === 'LIBERATION'
              ? t('ui.mode.liberationSummary', 'End Resolution with every region at 1 Extraction or less.')
              : t('ui.mode.symbolicSummary', 'Complete all three active Beacons.')}
          </strong>
          <span>
            {state.mode === 'LIBERATION'
              ? t('ui.mode.liberationProgress', '{{count}} regions already sit at the threshold.', {
                  count: regionIds.filter((regionId) => state.regions[regionId].extractionTokens <= 1).length,
                })
              : t('ui.mode.symbolicProgress', '{{count}} of {{total}} active Beacons are complete.', {
                  count: activeBeaconSummary.filter((beacon) => beacon.complete).length,
                  total: activeBeaconSummary.length,
                })}
          </span>
        </article>

        <article className="printed-meter">
          <span className="engraved-eyebrow">{t('ui.game.liveBeaconStatus', 'Beacon / threshold status')}</span>
          {state.mode === 'LIBERATION' ? (
            <span>{t('ui.mode.liberationStatus', 'Keep every theatre below the breach line while preserving all secret mandates.')}</span>
          ) : (
            <div className="region-tooltip-ledger">
              {activeBeaconSummary.map((beacon) => (
                <span key={beacon.id}>{beacon.complete ? '✓' : '•'} {beacon.title}</span>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
