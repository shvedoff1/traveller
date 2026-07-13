"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { buildCompareLayerFilters } from "../../lib/map/compare";
import {
  nextProjection,
  persistProjection,
  type Projection,
  readProjection,
} from "../../lib/map/projection";
import { type CountryLabel, countryLabel } from "../../lib/map/tooltip";
import {
  buildMapStyle,
  buildSelectedFilter,
  COUNTRIES_SOURCE,
  IDLE_ROTATION_DEG_PER_SEC,
  LAYER_FILL,
  LAYER_FRIEND,
  LAYER_OVERLAP,
  LAYER_SELECTED,
  LAYER_VISITED,
  shouldIdleRotate,
} from "../../lib/map/map-style";
import { useThemeStore } from "../../lib/stores/theme-store";
import { MapTooltip } from "./MapTooltip";
import { ProjectionToggle } from "./ProjectionToggle";

export interface FlyToRequest {
  center: [lng: number, lat: number];
  zoom: number;
  /** Changes on every request so repeat targets still animate. */
  id: number;
}

export interface MapCanvasProps {
  /** ISO codes rendered with the visited accent fill. */
  visited: readonly string[];
  /**
   * Compare mode: a friend's visited codes. When set, countries split into
   * mine-only (visited color) / theirs-only (friend color) / both (overlap
   * color). Null/undefined renders my map alone.
   */
  friendVisited?: readonly string[] | null;
  /** ISO code rendered with the selected outline. */
  selected: string | null;
  /** ISO code highlighted from outside the map (e.g. panel row hover). */
  highlighted?: string | null;
  /** One-shot camera move (e.g. picking a country in the panel). */
  flyTo?: FlyToRequest | null;
  /**
   * Read-only mode (public profiles): no click-to-toggle and no pointer
   * cursor, but hover highlight, zoom and pan stay enabled.
   */
  readonly?: boolean;
  /**
   * Render the globe ↔ flat projection toggle (bottom-right). Off by
   * default; the public profile map opts in. Choice persists per-tab.
   */
  showProjectionToggle?: boolean;
  onCountryClick?: (iso: string) => void;
  onCountryHover?: (iso: string | null) => void;
}

interface TooltipState {
  label: CountryLabel;
  x: number;
  y: number;
}

/**
 * Full-size MapLibre globe. Interaction model:
 * - hover highlights a country (feature-state) and shows a pointer cursor
 * - click resolves the country and reports its ISO code upward
 * - after 5 s without interaction (while zoomed out) the globe slowly spins
 */
export function MapCanvas({
  visited,
  friendVisited = null,
  selected,
  highlighted = null,
  flyTo = null,
  readonly: readOnly = false,
  showProjectionToggle = false,
  onCountryClick,
  onCountryHover,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [projection, setProjection] = useState<Projection>("globe");
  const projectionRef = useRef<Projection>(projection);
  projectionRef.current = projection;

  // Latest props, readable from map event handlers without re-initialising.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const visitedRef = useRef(visited);
  visitedRef.current = visited;
  const friendVisitedRef = useRef(friendVisited);
  friendVisitedRef.current = friendVisited;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onClickRef = useRef(onCountryClick);
  onClickRef.current = onCountryClick;
  const onHoverRef = useRef(onCountryHover);
  onHoverRef.current = onCountryHover;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const projectionToggleRef = useRef(showProjectionToggle);
  projectionToggleRef.current = showProjectionToggle;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: buildMapStyle(themeRef.current),
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
      applyCompareFilters(map, visitedRef.current, friendVisitedRef.current);
      map.setFilter(LAYER_SELECTED, buildSelectedFilter(selectedRef.current));
    };
    map.on("load", applyFilters);

    // Restore the per-tab projection choice (globe by default) once the
    // toggle capability is enabled.
    if (projectionToggleRef.current) {
      const stored = readProjection(
        typeof window === "undefined" ? null : window.sessionStorage,
      );
      if (stored !== "globe") {
        map.setProjection({ type: stored });
        setProjection(stored);
      }
    }

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
      map.getCanvas().style.cursor =
        iso && !readOnlyRef.current ? "pointer" : "";
      onHoverRef.current?.(iso);
    };

    const featureIso = (event: MapLayerMouseEvent): string | null => {
      const id = event.features?.[0]?.id;
      return typeof id === "string" && id.length === 2 ? id : null;
    };

    map.on("mousemove", LAYER_FILL, (event) => {
      const iso = featureIso(event);
      setHovered(iso);
      // Name chip that follows the (mouse) cursor. Touch never fires
      // mousemove, so this stays pointer-only.
      if (iso) {
        const featureName = event.features?.[0]?.properties?.name;
        const label = countryLabel(
          iso,
          typeof featureName === "string" ? featureName : undefined,
        );
        const point = event.point;
        setTooltip(
          label ? { label, x: point?.x ?? 0, y: point?.y ?? 0 } : null,
        );
      } else {
        setTooltip(null);
      }
    });
    map.on("mouseleave", LAYER_FILL, () => {
      setHovered(null);
      setTooltip(null);
    });
    map.on("click", LAYER_FILL, (event) => {
      if (readOnlyRef.current) return;
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

  // Swap palettes when the theme changes. The two styles share the same
  // source/layer structure, so MapLibre's setStyle diff only touches paint
  // properties — filters and hover feature-state survive the swap. Skip the
  // initial run (the map was created with the current theme already).
  const appliedThemeRef = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    map.setStyle(buildMapStyle(theme));
    // Belt and braces: re-assert the data-driven filters after the swap.
    if (map.getLayer(LAYER_VISITED)) {
      applyCompareFilters(map, visitedRef.current, friendVisitedRef.current);
      map.setFilter(LAYER_SELECTED, buildSelectedFilter(selectedRef.current));
    }
    // setStyle resets projection to the style's default (globe); restore
    // the active choice.
    if (projectionRef.current !== "globe") {
      map.setProjection({ type: projectionRef.current });
    }
  }, [theme]);

  // Keep layer filters in sync with props once the style is available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_VISITED)) return;
    applyCompareFilters(map, visited, friendVisited);
  }, [visited, friendVisited]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_SELECTED)) return;
    map.setFilter(LAYER_SELECTED, buildSelectedFilter(selected));
  }, [selected]);

  // External hover (panel rows) drives the same `hover` feature-state as
  // the mouse, so rows light countries up exactly like pointing at them.
  const previousHighlightedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const previous = previousHighlightedRef.current;
    if (previous !== null && previous !== highlighted) {
      map.removeFeatureState(
        { source: COUNTRIES_SOURCE, id: previous },
        "hover",
      );
    }
    if (highlighted !== null) {
      map.setFeatureState(
        { source: COUNTRIES_SOURCE, id: highlighted },
        { hover: true },
      );
    }
    previousHighlightedRef.current = highlighted;
  }, [highlighted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({ center: flyTo.center, zoom: flyTo.zoom, essential: true });
  }, [flyTo]);

  const toggleProjection = () => {
    const map = mapRef.current;
    const next = nextProjection(projectionRef.current);
    setProjection(next);
    map?.setProjection({ type: next });
    persistProjection(
      typeof window === "undefined" ? null : window.sessionStorage,
      next,
    );
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Interactive world map"
        data-testid="map-canvas"
      />
      {tooltip ? (
        <MapTooltip x={tooltip.x} y={tooltip.y} label={tooltip.label} />
      ) : null}
      {showProjectionToggle ? (
        <ProjectionToggle
          projection={projection}
          onToggle={toggleProjection}
        />
      ) : null}
    </div>
  );
}

/** Set the visited/friend/overlap fill filters from the two code lists. */
function applyCompareFilters(
  map: maplibregl.Map,
  visited: readonly string[],
  friendVisited: readonly string[] | null,
): void {
  const filters = buildCompareLayerFilters(visited, friendVisited);
  map.setFilter(LAYER_VISITED, filters.visited);
  map.setFilter(LAYER_FRIEND, filters.friend);
  map.setFilter(LAYER_OVERLAP, filters.overlap);
}
