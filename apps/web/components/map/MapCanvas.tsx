"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import {
  buildMapStyle,
  buildSelectedFilter,
  buildVisitedFilter,
  COUNTRIES_SOURCE,
  IDLE_ROTATION_DEG_PER_SEC,
  LAYER_FILL,
  LAYER_SELECTED,
  LAYER_VISITED,
  shouldIdleRotate,
} from "../../lib/map/map-style";

export interface MapCanvasProps {
  /** ISO codes rendered with the visited accent fill. */
  visited: readonly string[];
  /** ISO code rendered with the selected outline. */
  selected: string | null;
  onCountryClick?: (iso: string) => void;
  onCountryHover?: (iso: string | null) => void;
}

/**
 * Full-size MapLibre globe. Interaction model:
 * - hover highlights a country (feature-state) and shows a pointer cursor
 * - click resolves the country and reports its ISO code upward
 * - after 5 s without interaction (while zoomed out) the globe slowly spins
 */
export function MapCanvas({
  visited,
  selected,
  onCountryClick,
  onCountryHover,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Latest props, readable from map event handlers without re-initialising.
  const visitedRef = useRef(visited);
  visitedRef.current = visited;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onClickRef = useRef(onCountryClick);
  onClickRef.current = onCountryClick;
  const onHoverRef = useRef(onCountryHover);
  onHoverRef.current = onCountryHover;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: buildMapStyle(),
      center: [12, 25],
      zoom: 1.4,
      minZoom: 0.8,
      maxZoom: 8,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;

    const applyFilters = () => {
      if (!map.getLayer(LAYER_VISITED)) return;
      map.setFilter(LAYER_VISITED, buildVisitedFilter(visitedRef.current));
      map.setFilter(LAYER_SELECTED, buildSelectedFilter(selectedRef.current));
    };
    map.on("load", applyFilters);

    // --- hover highlight via feature-state -------------------------------
    let hoveredIso: string | null = null;
    const setHovered = (iso: string | null) => {
      if (iso === hoveredIso) return;
      if (hoveredIso !== null) {
        map.removeFeatureState(
          { source: COUNTRIES_SOURCE, id: hoveredIso },
          "hover",
        );
      }
      if (iso !== null) {
        map.setFeatureState(
          { source: COUNTRIES_SOURCE, id: iso },
          { hover: true },
        );
      }
      hoveredIso = iso;
      map.getCanvas().style.cursor = iso ? "pointer" : "";
      onHoverRef.current?.(iso);
    };

    const featureIso = (event: MapLayerMouseEvent): string | null => {
      const id = event.features?.[0]?.id;
      return typeof id === "string" && id.length === 2 ? id : null;
    };

    map.on("mousemove", LAYER_FILL, (event) => setHovered(featureIso(event)));
    map.on("mouseleave", LAYER_FILL, () => setHovered(null));
    map.on("click", LAYER_FILL, (event) => {
      const iso = featureIso(event);
      if (iso) onClickRef.current?.(iso);
    });

    // --- slow idle rotation ----------------------------------------------
    let lastInteractionAt = Date.now();
    const markInteraction = () => {
      lastInteractionAt = Date.now();
    };
    const interactionEvents = [
      "mousedown",
      "touchstart",
      "wheel",
      "dragstart",
      "zoomstart",
      "rotatestart",
      "pitchstart",
    ] as const;
    for (const event of interactionEvents) {
      map.on(event, markInteraction);
    }

    let frameHandle = 0;
    let previousFrameAt = performance.now();
    const spin = (frameAt: number) => {
      const deltaSeconds = (frameAt - previousFrameAt) / 1000;
      previousFrameAt = frameAt;
      if (shouldIdleRotate(map.getZoom(), Date.now() - lastInteractionAt)) {
        const center = map.getCenter();
        map.setCenter(
          [center.lng + IDLE_ROTATION_DEG_PER_SEC * deltaSeconds, center.lat],
          { idleRotation: true },
        );
      }
      frameHandle = requestAnimationFrame(spin);
    };
    frameHandle = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(frameHandle);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Keep layer filters in sync with props once the style is available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_VISITED)) return;
    map.setFilter(LAYER_VISITED, buildVisitedFilter(visited));
  }, [visited]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_SELECTED)) return;
    map.setFilter(LAYER_SELECTED, buildSelectedFilter(selected));
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Interactive world map"
      data-testid="map-canvas"
    />
  );
}
