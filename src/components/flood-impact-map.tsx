import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { riverPath } from "@/lib/geo";
import { slugify, stopLabelNe, storyStartIndex } from "@/lib/flood-after-scenes";
import { flowBearingDownDeg, nearestPointOnPath, pathLengthKm, pointAlongPath, shortestArcDeg, subPathBetween } from "@/lib/flood-geometry";
import { buildPrefetchUrls, coverageRangesFromTileIndex, prefetchUrls, tileIndexBounds, type CoverageRange } from "@/lib/flood-prefetch";
import type { FloodAfterScenesData, FloodAfterTilesMeta, FloodFrame, FloodManifest } from "@/lib/flood-manifest";
import type { Language } from "@/lib/types";

maplibregl.setMaxParallelImageRequests(48);

const BASEMAP_SOURCE = "flood-basemap";
const BASEMAP_LAYER = "flood-basemap";
const AFTER_SOURCE = "flood-after";
const AFTER_LAYER = "flood-after";
const AOI_SOURCE = "flood-aoi";
const AOI_FILL_LAYER = "flood-aoi-fill";
const AOI_LINE_LAYER = "flood-aoi-line";
const RIVER_SOURCE = "flood-river";
const RIVER_LAYER = "flood-river";
const WAYPOINT_SOURCE = "flood-waypoints";
const WAYPOINT_LAYER = "flood-waypoints";
const CURSOR_SOURCE = "flood-cursor";
const CURSOR_LAYER = "flood-cursor";
const BASEMAP_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DRIVE_SPEED_M_PER_S = 300;
const SEEK_EASE_MS = 400;
const SKIP_EASE_MS = 600;
// Rolling prefetch: URLs are in route order, so once the first fifth is warm the drive can
// start while the rest keeps loading ahead of the point. The cap only guards a stalled network.
const PREFETCH_WAIT_MS = 30000;
const PREFETCH_START_FRACTION = 0.2;

type LngLat = [number, number];
type MapColors = { primary: string; destructive: string; background: string };
type DividerPosition = { position: number; containerHeight: number };
type StopLabel = { key: string; primary: string; secondary?: string };

function mapIsRemoved(map: maplibregl.Map): boolean {
  return map._removed;
}

function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      [BASEMAP_SOURCE]: {
        type: "raster",
        tiles: [BASEMAP_TILES],
        tileSize: 256,
        maxzoom: 17, // Esri has no z18+ tiles in rural Nepal; overzoom z17 instead of showing blanks
      },
    },
    layers: [{ id: BASEMAP_LAYER, type: "raster", source: BASEMAP_SOURCE }],
  };
}

function readMapColors(): MapColors {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => {
    const token = styles.getPropertyValue(name).trim();
    return token ? `rgb(${token})` : fallback;
  };

  return {
    primary: color("--primary", "rgb(0 56 147)"),
    destructive: color("--destructive", "rgb(184 32 32)"),
    background: color("--background", "rgb(255 255 255)"),
  };
}

function mapBounds(bounds: NonNullable<FloodFrame["bounds"]>): [LngLat, LngLat] {
  const [[south, west], [north, east]] = bounds;
  return [
    [west, south],
    [east, north],
  ];
}

function toLngLat(position: [number, number]): LngLat {
  return [position[1], position[0]];
}

function makeAoiData(aoi: FloodManifest["aoi"]): GeoJSON.GeoJSON {
  if (aoi.type === "Feature" || aoi.type === "FeatureCollection") return aoi as unknown as GeoJSON.GeoJSON;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: aoi.type,
      coordinates: aoi.coordinates,
    },
  } as unknown as GeoJSON.Feature;
}

function makeRiverData(): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: riverPath.map(([lat, lng]) => [lng, lat]),
    },
  };
}

function makeWaypointData(frames: FloodFrame[], snappedPositions: [number, number][]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: frames.map((frame, index) => ({
      type: "Feature",
      properties: { index, label: frame.location.label },
      geometry: { type: "Point", coordinates: toLngLat(snappedPositions[index]) },
    })),
  };
}

function makeCursorData(position: [number, number] | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: position ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: toLngLat(position) } }] : [],
  };
}

function addSharedLayers(
  map: maplibregl.Map,
  aoiData: GeoJSON.GeoJSON,
  riverData: GeoJSON.Feature<GeoJSON.LineString>,
  waypointData: GeoJSON.FeatureCollection<GeoJSON.Point>,
  colors: MapColors,
  activeIndex: number,
) {
  map.addSource(AOI_SOURCE, { type: "geojson", data: aoiData });
  map.addLayer({
    id: AOI_FILL_LAYER,
    type: "fill",
    source: AOI_SOURCE,
    paint: { "fill-color": colors.primary, "fill-opacity": 0.05 },
  });
  map.addLayer({
    id: AOI_LINE_LAYER,
    type: "line",
    source: AOI_SOURCE,
    paint: { "line-color": colors.primary, "line-opacity": 0.6, "line-width": 1.5 },
  });

  map.addSource(RIVER_SOURCE, { type: "geojson", data: riverData });
  map.addLayer({
    id: RIVER_LAYER,
    type: "line",
    source: RIVER_SOURCE,
    paint: { "line-color": "#38bdf8", "line-width": 3 },
  });

  map.addSource(WAYPOINT_SOURCE, { type: "geojson", data: waypointData });
  map.addLayer({
    id: WAYPOINT_LAYER,
    type: "circle",
    source: WAYPOINT_SOURCE,
    paint: {
      "circle-radius": ["case", ["==", ["get", "index"], activeIndex], 7, 5],
      "circle-color": colors.primary,
      "circle-stroke-color": colors.background,
      "circle-stroke-width": ["case", ["==", ["get", "index"], activeIndex], 3, 2],
    },
  });
  map.addSource(CURSOR_SOURCE, { type: "geojson", data: makeCursorData(null) });
  map.addLayer({
    id: CURSOR_LAYER,
    type: "circle",
    source: CURSOR_SOURCE,
    paint: {
      "circle-radius": 7,
      "circle-color": colors.destructive,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });
}

function addAfterLayer(map: maplibregl.Map, afterTiles: { baseUrl: string; meta: FloodAfterTilesMeta } | null) {
  if (!afterTiles || map.getSource(AFTER_SOURCE)) return;
  const bounds = tileIndexBounds(afterTiles.meta.tileIndex);
  if (!bounds) return;
  map.addSource(AFTER_SOURCE, {
    type: "raster",
    tiles: [`${afterTiles.baseUrl}{z}/{x}/{y}.png`],
    bounds,
    tileSize: 256,
    minzoom: 12,
    maxzoom: 16,
    scheme: "xyz",
  });
  map.addLayer({ id: AFTER_LAYER, type: "raster", source: AFTER_SOURCE, paint: { "raster-opacity": 1 } }, AOI_FILL_LAYER);
}

function setCursorPosition(map: maplibregl.Map, position: [number, number] | null) {
  const source = map.getSource(CURSOR_SOURCE);
  if (source?.type === "geojson") (source as maplibregl.GeoJSONSource).setData(makeCursorData(position));
}

function setCursorOnMaps(maps: maplibregl.Map[], position: [number, number] | null) {
  for (const map of maps) {
    if (!mapIsRemoved(map)) setCursorPosition(map, position);
  }
}

function updateWaypointStyle(map: maplibregl.Map, activeIndex: number, colors: MapColors) {
  if (!map.getLayer(WAYPOINT_LAYER)) return;
  map.setPaintProperty(WAYPOINT_LAYER, "circle-radius", ["case", ["==", ["get", "index"], activeIndex], 7, 5]);
  map.setPaintProperty(WAYPOINT_LAYER, "circle-color", colors.primary);
  map.setPaintProperty(WAYPOINT_LAYER, "circle-stroke-width", ["case", ["==", ["get", "index"], activeIndex], 3, 2]);
}

function waypointIndex(event: MapLayerMouseEvent): number | null {
  const value = event.features?.[0]?.properties?.index;
  const index = Number(value);
  return Number.isInteger(index) ? index : null;
}

function attachWaypointInteractions(map: maplibregl.Map, frames: FloodFrame[], onSelect: (index: number) => void) {
  let popup: maplibregl.Popup | null = null;
  const handleClick = (event: MapLayerMouseEvent) => {
    const index = waypointIndex(event);
    if (index !== null && index >= 0 && index < frames.length) onSelect(index);
  };
  const handleEnter = (event: MapLayerMouseEvent) => {
    const index = waypointIndex(event);
    if (index === null || !frames[index]) return;
    map.getCanvas().style.cursor = "pointer";
    popup?.remove();
    popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "180px" })
      .setLngLat(event.lngLat)
      .setText(frames[index].location.label)
      .addTo(map);
  };
  const handleLeave = () => {
    map.getCanvas().style.cursor = "";
    popup?.remove();
    popup = null;
  };

  map.on("click", WAYPOINT_LAYER, handleClick);
  map.on("mouseenter", WAYPOINT_LAYER, handleEnter);
  map.on("mouseleave", WAYPOINT_LAYER, handleLeave);

  return () => {
    popup?.remove();
    map.getCanvas().style.cursor = "";
    map.off("click", WAYPOINT_LAYER, handleClick);
    map.off("mouseenter", WAYPOINT_LAYER, handleEnter);
    map.off("mouseleave", WAYPOINT_LAYER, handleLeave);
  };
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function StopLabelLines({ label, className }: { label: StopLabel; className?: string }) {
  return (
    <div className={`translate-y-[6px] ${className ?? ""}`}>
      <p className="[text-shadow:0_1px_2px_rgba(0,0,0,.8),0_0_12px_rgba(0,0,0,.6)] text-xl font-bold text-white sm:text-2xl">{label.primary}</p>
      {label.secondary ? (
        <p className="[text-shadow:0_1px_2px_rgba(0,0,0,.8),0_0_12px_rgba(0,0,0,.6)] text-xs font-medium text-white/90 sm:text-sm">
          {label.secondary}
        </p>
      ) : null}
    </div>
  );
}

export function FloodImpactMap({
  frames,
  activeIndex,
  onSelect,
  aoi,
  afterTiles,
  sceneData,
  playing,
  language,
  onPlaybackEnd,
  preparingImagery,
  speedMultiplier,
  seekRequest,
  noDataStretchLabel,
  skipAheadLabel,
  className,
}: {
  frames: FloodFrame[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPlaybackEnd: () => void;
  aoi: FloodManifest["aoi"];
  afterTiles: { baseUrl: string; meta: FloodAfterTilesMeta } | null;
  sceneData: FloodAfterScenesData;
  playing: boolean;
  language: Language;
  preparingImagery: string;
  speedMultiplier: number;
  seekRequest: { id: number; offsetMeters: number } | null;
  noDataStretchLabel: string;
  skipAheadLabel: string;
  className?: string;
}) {
  const activeFrame = frames[activeIndex];
  const activeFrameLabelNe = activeFrame ? stopLabelNe(slugify(activeFrame.location.label), sceneData) : undefined;
  const primaryStopLabel = language === "ne" && activeFrameLabelNe ? activeFrameLabelNe : activeFrame?.location.label;
  const secondaryStopLabel = language === "ne" ? activeFrame?.location.label : activeFrameLabelNe;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const beforeContainerRef = useRef<HTMLDivElement>(null);
  const afterContainerRef = useRef<HTMLDivElement>(null);
  const beforeMapRef = useRef<maplibregl.Map | null>(null);
  const afterMapRef = useRef<maplibregl.Map | null>(null);
  const colorsRef = useRef<MapColors | null>(null);
  const afterTilesRef = useRef(afterTiles);
  const sceneDataRef = useRef(sceneData);
  const playingRef = useRef(playing);
  const activeIndexRef = useRef(activeIndex);
  const speedMultiplierRef = useRef(speedMultiplier);
  const reducedMotionRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  const previousLabelRef = useRef<StopLabel | null>(null);
  const playbackEndedRef = useRef(false);
  const destroyedRef = useRef(false);
  const cursorPositionRef = useRef<[number, number] | null>(null);
  const driveStopIndexRef = useRef<number | null>(null);
  const loadedMapsRef = useRef({ before: false, after: false });
  const syncingRef = useRef(false);
  const cameraEasingRef = useRef(false);
  const prefetchDoneRef = useRef(false);
  const prefetchReleasedRef = useRef(false);
  const prefetchControllerRef = useRef<AbortController | null>(null);
  const seekPlaybackRef = useRef<(offsetMeters: number) => void>(() => {});
  const skipNoDataRef = useRef<() => void>(() => {});
  const seekToStopRef = useRef<(index: number) => void>(() => {});
  const startLoopRef = useRef<() => void>(() => {});
  const stopLoopRef = useRef<() => void>(() => {});
  const [mapsReady, setMapsReady] = useState(false);
  const [divider, setDivider] = useState<DividerPosition | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [prefetchReady, setPrefetchReady] = useState(false);
  const prefetchReadyRef = useRef(false);
  const [prefetching, setPrefetching] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState(0);
  const [noDataStretch, setNoDataStretch] = useState<CoverageRange | null>(null);
  const [previousLabel, setPreviousLabel] = useState<StopLabel | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  afterTilesRef.current = afterTiles;
  sceneDataRef.current = sceneData;
  playingRef.current = playing;
  activeIndexRef.current = activeIndex;
  speedMultiplierRef.current = speedMultiplier;
  reducedMotionRef.current = prefersReducedMotion;
  prefetchReadyRef.current = prefetchReady;
  onSelectRef.current = onSelect;
  onPlaybackEndRef.current = onPlaybackEnd;

  const snappedPositions = useMemo(
    () =>
      frames.map((frame) => {
        const snapped = nearestPointOnPath([frame.location.lat, frame.location.lng], riverPath);
        return snapped?.point ?? ([frame.location.lat, frame.location.lng] as [number, number]);
      }),
    [frames],
  );
  const activePosition = snappedPositions[activeIndex] ?? riverPath[0] ?? [27, 85];
  const aoiData = useMemo(() => makeAoiData(aoi), [aoi]);
  const riverData = useMemo(() => makeRiverData(), []);
  const waypointData = useMemo(() => makeWaypointData(frames, snappedPositions), [frames, snappedPositions]);
  const initialCenterRef = useRef<LngLat>(toLngLat(activePosition));
  const storyStart = storyStartIndex(frames, sceneData);
  const prefetchStops = useMemo(() => snappedPositions.slice(storyStart), [snappedPositions, storyStart]);
  const prefetchRoutePath = useMemo(() => {
    const start = prefetchStops[0];
    const end = prefetchStops[prefetchStops.length - 1];
    if (!start || !end) return [];
    const route = subPathBetween(riverPath, start, end);
    return route.length > 0 ? route : [start, end];
  }, [prefetchStops]);

  const currentStopLabel = useMemo<StopLabel | null>(() => {
    if (!primaryStopLabel) return null;
    return {
      key: JSON.stringify([primaryStopLabel, secondaryStopLabel]),
      primary: primaryStopLabel,
      secondary: secondaryStopLabel,
    };
  }, [primaryStopLabel, secondaryStopLabel]);

  useEffect(() => {
    const previous = previousLabelRef.current;
    previousLabelRef.current = currentStopLabel;
    if (!previous || !currentStopLabel || previous.key === currentStopLabel.key) {
      setPreviousLabel(null);
      return;
    }

    setPreviousLabel(previous);
    const timeoutId = window.setTimeout(() => {
      setPreviousLabel((visiblePrevious) => (visiblePrevious?.key === previous.key ? null : visiblePrevious));
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [currentStopLabel]);

  const updateClip = useCallback(() => {
    if (destroyedRef.current) return;
    const wrapper = wrapperRef.current;
    const afterMap = afterMapRef.current;
    if (!afterTilesRef.current || !wrapper || !afterMap || mapIsRemoved(afterMap)) {
      setDivider(null);
      return;
    }

    const { height } = wrapper.getBoundingClientRect();
    if (height <= 0) return;
    const cursorPosition = cursorPositionRef.current;
    if (!cursorPosition) {
      setDivider(null);
      return;
    }
    let nextDividerY = afterMap.project(toLngLat(cursorPosition)).y;
    nextDividerY = Math.max(0, Math.min(height, nextDividerY));

    setDivider((previous) =>
      previous?.position === nextDividerY && previous.containerHeight === height
        ? previous
        : { position: nextDividerY, containerHeight: height },
    );
  }, []);

  useEffect(() => {
    setPortalHost(wrapperRef.current);
  }, []);

  useEffect(
    () => () => {
      prefetchControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const beforeContainer = beforeContainerRef.current;
    const afterContainer = afterContainerRef.current;
    if (!wrapper || !beforeContainer || !afterContainer) return;

    destroyedRef.current = false;
    loadedMapsRef.current = { before: false, after: false };
    const colors = (colorsRef.current ??= readMapColors());
    const beforeMap = new maplibregl.Map({
      container: beforeContainer,
      style: createMapStyle(),
      center: initialCenterRef.current,
      zoom: 16,
      attributionControl: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    const afterMap = new maplibregl.Map({
      container: afterContainer,
      style: createMapStyle(),
      center: initialCenterRef.current,
      zoom: 16,
      attributionControl: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    beforeMapRef.current = beforeMap;
    afterMapRef.current = afterMap;

    const syncMaps = (source: maplibregl.Map, target: maplibregl.Map) => {
      if (destroyedRef.current || mapIsRemoved(source) || mapIsRemoved(target) || syncingRef.current || cameraEasingRef.current) return;
      syncingRef.current = true;
      try {
        target.jumpTo({ center: source.getCenter(), zoom: source.getZoom(), bearing: source.getBearing() });
      } finally {
        syncingRef.current = false;
      }
    };
    const handleBeforeMove = () => syncMaps(beforeMap, afterMap);
    const handleAfterMove = () => syncMaps(afterMap, beforeMap);
    const handleMapResize = () => {
      if (destroyedRef.current) return;
      if (!mapIsRemoved(beforeMap)) beforeMap.resize();
      if (!mapIsRemoved(afterMap)) afterMap.resize();
      updateClip();
    };
    beforeMap.on("move", handleBeforeMove);
    afterMap.on("move", handleAfterMove);
    beforeMap.on("move", updateClip);
    afterMap.on("move", updateClip);
    beforeMap.on("resize", updateClip);
    afterMap.on("resize", updateClip);

    const interactionCleanups: Array<() => void> = [];
    const onLoaded = (map: maplibregl.Map, kind: "before" | "after") => {
      if (destroyedRef.current || mapIsRemoved(map)) return;
      addSharedLayers(map, aoiData, riverData, waypointData, colors, activeIndex);
      if (kind === "after") addAfterLayer(map, afterTiles);
      interactionCleanups.push(attachWaypointInteractions(map, frames, (index) => onSelectRef.current(index)));
      loadedMapsRef.current[kind] = true;
      if (loadedMapsRef.current.before && loadedMapsRef.current.after) setMapsReady(true);
      updateClip();
    };
    const handleBeforeLoad = () => onLoaded(beforeMap, "before");
    const handleAfterLoad = () => onLoaded(afterMap, "after");
    beforeMap.on("load", handleBeforeLoad);
    afterMap.on("load", handleAfterLoad);

    const resizeObserver = new ResizeObserver(handleMapResize);
    resizeObserver.observe(wrapper);
    handleMapResize();

    return () => {
      destroyedRef.current = true;
      cameraEasingRef.current = false;
      resizeObserver.disconnect();
      interactionCleanups.forEach((cleanup) => cleanup());
      beforeMap.off("load", handleBeforeLoad);
      afterMap.off("load", handleAfterLoad);
      beforeMap.off("move", handleBeforeMove);
      afterMap.off("move", handleAfterMove);
      beforeMap.off("move", updateClip);
      afterMap.off("move", updateClip);
      beforeMap.off("resize", updateClip);
      afterMap.off("resize", updateClip);
      if (!mapIsRemoved(beforeMap)) beforeMap.remove();
      if (!mapIsRemoved(afterMap)) afterMap.remove();
      if (beforeMapRef.current === beforeMap) beforeMapRef.current = null;
      if (afterMapRef.current === afterMap) afterMapRef.current = null;
      loadedMapsRef.current = { before: false, after: false };
      setMapsReady(false);
    };
    // The maps are initialized once for this component; the drive engine below owns the camera state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing || frames.length === 0) {
      if (!prefetchReleasedRef.current) {
        prefetchControllerRef.current?.abort();
        prefetchControllerRef.current = null;
        setPrefetchReady(false);
        setPrefetching(false);
        setPrefetchProgress(0);
      }
      return;
    }
    if (prefetchDoneRef.current || prefetchReleasedRef.current) {
      setPrefetchReady(true);
      return;
    }

    const controller = new AbortController();
    prefetchControllerRef.current = controller;
    let releasedByTimeout = false;
    setPrefetchReady(false);
    setPrefetching(true);
    setPrefetchProgress(0);

    const urls = buildPrefetchUrls({
      routePath: prefetchRoutePath,
      tileIndex: afterTiles?.meta.tileIndex ?? {},
      basemapTemplate: BASEMAP_TILES,
      afterTilesTemplate: afterTiles ? `${afterTiles.baseUrl}{z}/{x}/{y}.png` : null,
    });
    const timeoutId = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      releasedByTimeout = true;
      prefetchReleasedRef.current = true;
      setPrefetchReady(true);
      setPrefetching(false);
    }, PREFETCH_WAIT_MS);

    void prefetchUrls(urls, {
      signal: controller.signal,
      onProgress: (completed, total) => {
        setPrefetchProgress(total > 0 ? Math.round((completed / total) * 100) : 100);
        if (!releasedByTimeout && total > 0 && completed / total >= PREFETCH_START_FRACTION) {
          releasedByTimeout = true; // the rest keeps loading in the background
          prefetchReleasedRef.current = true;
          window.clearTimeout(timeoutId);
          setPrefetchReady(true);
          setPrefetching(false);
        }
      },
    })
      .then(() => {
        if (controller.signal.aborted) return;
        prefetchDoneRef.current = true;
        setPrefetchProgress(100);
        setPrefetchReady(true);
        if (!releasedByTimeout) setPrefetching(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPrefetchReady(true);
        setPrefetching(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      if (!prefetchReleasedRef.current) controller.abort();
      if (prefetchControllerRef.current === controller) prefetchControllerRef.current = null;
    };
  }, [afterTiles, frames.length, playing, prefetchRoutePath, prefetchStops]);

  useEffect(() => {
    if (!mapsReady || frames.length === 0) return;

    const afterMap = afterMapRef.current;
    if (!afterMap || mapIsRemoved(afterMap)) return;
    const maps = [beforeMapRef.current, afterMap].filter((map): map is maplibregl.Map => !!map && !mapIsRemoved(map));
    const firstPosition = snappedPositions[0];
    const lastPosition = snappedPositions[snappedPositions.length - 1];
    if (!firstPosition || !lastPosition) return;

    const route = subPathBetween(riverPath, firstPosition, lastPosition);
    const path = route.length > 0 ? route : [firstPosition, lastPosition];
    const routeDistanceM = pathLengthKm(path) * 1000;
    const stopDistancesM = snappedPositions.map((stop) => (nearestPointOnPath(stop, path)?.distanceAlongKm ?? 0) * 1000);
    const storyStartStopIndex = Math.max(0, Math.min(frames.length - 1, storyStartIndex(frames, sceneDataRef.current)));
    const storyStartFrame = frames[storyStartStopIndex];
    const coverageRanges = afterTiles ? coverageRangesFromTileIndex(path, afterTiles.meta.tileIndex) : [];

    const driveZoom = (() => {
      if (!storyStartFrame?.bounds) return 15;
      const startBearing = flowBearingDownDeg([storyStartFrame.location.lat, storyStartFrame.location.lng], riverPath);
      const camera = afterMap.cameraForBounds(mapBounds(storyStartFrame.bounds), { bearing: startBearing, padding: 16 });
      return camera?.zoom ?? 15;
    })();

    let cancelled = false;
    let travelFrameId = 0;
    let loopRunning = false;
    let distanceM = Math.max(0, Math.min(routeDistanceM, stopDistancesM[activeIndexRef.current] ?? 0));
    let bearing = flowBearingDownDeg(pointAlongPath(path, routeDistanceM > 0 ? distanceM / routeDistanceM : 0), riverPath);
    let lastFrameAt = performance.now();
    let cameraEaseUntil = 0;
    let cameraEaseTimer = 0;
    let finishAfterCameraEase = false;
    let stopLoop = () => {};

    const clampDistance = (value: number) => Math.max(0, Math.min(routeDistanceM, value));
    const positionAtDistance = (distanceMValue: number) => pointAlongPath(path, routeDistanceM > 0 ? distanceMValue / routeDistanceM : 0);
    const stopIndexAtDistance = (distanceMValue: number) => {
      let index = 0;
      for (let stopIndex = 0; stopIndex < stopDistancesM.length; stopIndex += 1) {
        if (distanceMValue >= stopDistancesM[stopIndex]) index = stopIndex;
        else break;
      }
      return index;
    };

    const updateNoDataStretch = (distanceMValue: number) => {
      const rangeIndex = coverageRanges.findIndex(
        (range, index) => distanceMValue >= range.fromM && (distanceMValue < range.toM || index === coverageRanges.length - 1),
      );
      const range = rangeIndex >= 0 ? coverageRanges[rangeIndex] : null;
      const visibleRange = range && !range.covered && range.toM - range.fromM > 1000 ? range : null;
      setNoDataStretch((previous) => (previous === visibleRange ? previous : visibleRange));
    };

    const render = (distanceMValue: number, moveCamera = true) => {
      const position = positionAtDistance(distanceMValue);
      cursorPositionRef.current = position;
      if (moveCamera) afterMap.jumpTo({ center: toLngLat(position), zoom: driveZoom, bearing });
      setCursorOnMaps(maps, position);

      const nextStopIndex = stopIndexAtDistance(distanceMValue);
      if (nextStopIndex !== driveStopIndexRef.current) {
        driveStopIndexRef.current = nextStopIndex;
        onSelectRef.current(nextStopIndex);
      }
      updateNoDataStretch(distanceMValue);
      updateClip();
    };

    const easeCameraToDistance = (distanceMValue: number, duration: number) => {
      const position = positionAtDistance(distanceMValue);
      const targetBearing = flowBearingDownDeg(position, riverPath);
      bearing = targetBearing;
      window.clearTimeout(cameraEaseTimer);
      cameraEasingRef.current = duration > 0;
      if (duration > 0) {
        cameraEaseTimer = window.setTimeout(() => {
          cameraEasingRef.current = false;
        }, duration);
      }
      for (const target of maps) {
        const camera = { center: toLngLat(position), zoom: driveZoom, bearing: targetBearing };
        if (duration > 0) target.easeTo({ ...camera, duration });
        else target.jumpTo(camera);
      }
    };

    const finishPlayback = () => {
      if (cancelled || destroyedRef.current || playbackEndedRef.current) return;
      distanceM = routeDistanceM;
      finishAfterCameraEase = false;
      cameraEaseUntil = 0;
      render(distanceM, true);
      setNoDataStretch(null);
      playbackEndedRef.current = true;
      stopLoop();
      onPlaybackEndRef.current();
    };

    const seekTo = (targetDistanceM: number, easeMs: number) => {
      if (cancelled || destroyedRef.current) return;
      distanceM = clampDistance(targetDistanceM);
      if (distanceM < routeDistanceM) playbackEndedRef.current = false;
      render(distanceM, false);
      const cameraDuration = reducedMotionRef.current ? 0 : easeMs;
      finishAfterCameraEase = playingRef.current && distanceM >= routeDistanceM;
      cameraEaseUntil = cameraDuration > 0 ? performance.now() + cameraDuration : 0;
      lastFrameAt = performance.now();
      easeCameraToDistance(distanceM, cameraDuration);
      if (cameraDuration === 0 && finishAfterCameraEase) finishPlayback();
    };

    const animate = (now: number) => {
      if (cancelled || destroyedRef.current || !loopRunning || !playingRef.current || mapIsRemoved(afterMap)) {
        stopLoop();
        return;
      }
      if (cameraEaseUntil > 0) {
        if (now < cameraEaseUntil) {
          lastFrameAt = now;
          travelFrameId = requestAnimationFrame(animate);
          return;
        }
        cameraEaseUntil = 0;
        lastFrameAt = now;
        if (finishAfterCameraEase) {
          finishPlayback();
          return;
        }
      }

      const elapsedMs = Math.max(0, now - lastFrameAt);
      lastFrameAt = now;
      const speed = Math.max(0, speedMultiplierRef.current);
      const remainingDistanceM = Math.max(0, routeDistanceM - distanceM);
      const remainingDurationMs = speed > 0 ? (remainingDistanceM / (DRIVE_SPEED_M_PER_S * speed)) * 1000 : Infinity;
      const distanceDeltaM = remainingDurationMs <= elapsedMs ? remainingDistanceM : (elapsedMs / 1000) * DRIVE_SPEED_M_PER_S * speed;
      distanceM = clampDistance(distanceM + distanceDeltaM);
      const position = positionAtDistance(distanceM);
      const targetBearing = flowBearingDownDeg(position, riverPath);
      bearing += shortestArcDeg(bearing, targetBearing) * 0.08;
      render(distanceM);

      if (distanceM >= routeDistanceM) {
        finishPlayback();
        return;
      }
      travelFrameId = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (cancelled || destroyedRef.current || loopRunning) return;
      if (distanceM >= routeDistanceM) {
        distanceM = clampDistance(stopDistancesM[storyStartStopIndex] ?? 0);
        bearing = flowBearingDownDeg(positionAtDistance(distanceM), riverPath);
        playbackEndedRef.current = false;
        render(distanceM, true);
      }

      loopRunning = true;
      window.clearTimeout(cameraEaseTimer);
      cameraEasingRef.current = false;
      cameraEaseUntil = 0;
      finishAfterCameraEase = false;
      lastFrameAt = performance.now();
      if (reducedMotionRef.current || routeDistanceM <= 0) {
        distanceM = routeDistanceM;
        render(distanceM);
        finishPlayback();
        return;
      }
      travelFrameId = requestAnimationFrame(animate);
    };

    stopLoop = () => {
      loopRunning = false;
      if (travelFrameId) cancelAnimationFrame(travelFrameId);
      travelFrameId = 0;
      window.clearTimeout(cameraEaseTimer);
      cameraEasingRef.current = false;
      cameraEaseUntil = 0;
      finishAfterCameraEase = false;
      for (const map of maps) {
        if (!mapIsRemoved(map)) map.stop();
      }
    };

    seekPlaybackRef.current = (offsetMeters) => seekTo(distanceM + offsetMeters, SEEK_EASE_MS);
    skipNoDataRef.current = () => {
      const range = coverageRanges.find(
        (candidate, index) =>
          distanceM >= candidate.fromM &&
          (distanceM < candidate.toM || index === coverageRanges.length - 1) &&
          !candidate.covered &&
          candidate.toM - candidate.fromM > 1000,
      );
      if (range) seekTo(range.toM, SKIP_EASE_MS);
    };
    startLoopRef.current = startLoop;
    stopLoopRef.current = stopLoop;
    seekToStopRef.current = (index) => {
      const stopDistanceM = stopDistancesM[index];
      if (stopDistanceM !== undefined) seekTo(stopDistanceM, 800);
    };

    playbackEndedRef.current = false;
    driveStopIndexRef.current = null;
    setNoDataStretch(null);
    render(distanceM);
    if (playingRef.current && prefetchReadyRef.current) startLoop();

    return () => {
      cancelled = true;
      stopLoop();
      seekPlaybackRef.current = () => {};
      skipNoDataRef.current = () => {};
      startLoopRef.current = () => {};
      stopLoopRef.current = () => {};
      seekToStopRef.current = () => {};
    };
  }, [afterTiles, frames, mapsReady, snappedPositions, updateClip]);

  useEffect(() => {
    if (playing && prefetchReady) startLoopRef.current();
    else stopLoopRef.current();
  }, [mapsReady, playing, prefetchReady]);

  useEffect(() => {
    if (!seekRequest) return;
    seekPlaybackRef.current(seekRequest.offsetMeters);
  }, [seekRequest?.id]);

  useEffect(() => {
    if (!mapsReady || activeIndex === driveStopIndexRef.current) return;
    seekToStopRef.current(activeIndex);
  }, [activeIndex, mapsReady]);

  useEffect(() => {
    const afterContainer = afterContainerRef.current;
    if (!afterContainer) return;
    afterContainer.style.clipPath = divider ? `inset(0 0 ${Math.max(0, divider.containerHeight - divider.position)}px 0)` : "";
  }, [divider]);

  useEffect(() => {
    if (!mapsReady) return;
    const maps = [beforeMapRef.current, afterMapRef.current];
    const colors = colorsRef.current;
    if (!colors) return;
    for (const map of maps) {
      if (!map || mapIsRemoved(map)) continue;
      updateWaypointStyle(map, activeIndex, colors);
    }
  }, [activeIndex, mapsReady]);

  return (
    <div ref={wrapperRef} className={`vn-flood-map relative h-full min-h-80 w-full overflow-hidden rounded-lg ${className ?? ""}`}>
      <div ref={beforeContainerRef} className="vn-flood-map absolute inset-0" />
      <div ref={afterContainerRef} className="vn-flood-map absolute inset-0" />

      {portalHost && prefetching
        ? createPortal(
            <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
              <div className="rounded-full bg-background/85 px-3 py-1.5 text-sm backdrop-blur">
                {preparingImagery} {prefetchProgress}%
              </div>
            </div>,
            portalHost,
          )
        : null}

      {portalHost && divider && noDataStretch
        ? createPortal(
            <div
              className="pointer-events-none absolute left-3 right-3 z-[1000] flex justify-center pt-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
              style={{ top: `${divider.position}px` }}
            >
              <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-background/85 px-3 py-1 text-xs shadow backdrop-blur sm:text-sm">
                <span className="min-w-0 truncate">{noDataStretchLabel}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 min-h-0 shrink-0 whitespace-nowrap px-2.5 text-xs sm:h-9 sm:min-h-9 sm:px-3 sm:text-sm"
                  onClick={() => skipNoDataRef.current()}
                >
                  {skipAheadLabel}
                </Button>
              </div>
            </div>,
            portalHost,
          )
        : null}

      {portalHost && divider && currentStopLabel
        ? createPortal(
            <div className="pointer-events-none absolute left-6 z-[1001] -translate-y-full pb-2" style={{ top: `${divider.position}px` }}>
              <div className="relative overflow-hidden">
                {previousLabel ? (
                  <StopLabelLines
                    key={`previous-${previousLabel.key}`}
                    label={previousLabel}
                    className="absolute inset-x-0 animate-out fade-out slide-out-to-top-2 fill-mode-forwards duration-500"
                  />
                ) : null}
                <StopLabelLines
                  key={`current-${currentStopLabel.key}`}
                  label={currentStopLabel}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                />
              </div>
            </div>,
            portalHost,
          )
        : null}

      {portalHost && afterTiles && divider && !noDataStretch
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-[1000] h-0.5 bg-white/95 shadow"
              style={{ top: `${divider.position}px` }}
            />,
            portalHost,
          )
        : null}

      <div className="pointer-events-none absolute bottom-0 right-0 z-[1000] max-w-full truncate bg-background/70 px-1 text-xs leading-tight text-foreground">
        Basemap © Esri, Maxar, Earthstar Geographics · Post-flood imagery Vantor Open Data (CC BY-NC 4.0) via OpenAerialMap · © MapLibre
      </div>
    </div>
  );
}
