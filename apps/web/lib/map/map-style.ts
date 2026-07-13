/**
 * Pure builders for the MapLibre style, layer filters and idle-rotation
 * logic — extracted so they are unit-testable without WebGL.
 */

import type {
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";

export const COUNTRIES_SOURCE = "countries";
export const COUNTRIES_DATA_URL = "/geo/countries.geojson";

export const LAYER_FILL = "countries-fill";
export const LAYER_VISITED = "countries-visited";
export const LAYER_BORDER = "countries-border";
export const LAYER_SELECTED = "countries-selected";

export const MAP_COLORS = {
  /** Space around the globe. */
  space: "#05070d",
  /** Globe surface / oceans. */
  ocean: "#101624",
  /** Unvisited country fill — desaturated dark gray. */
  country: "#242b3a",
  countryHover: "#3a4459",
  /** Accent for visited countries. */
  visited: "#0f9d84",
  visitedHover: "#16bda0",
  border: "#0b0e14",
  selectedOutline: "#5eead4",
} as const;

/** Filter matching the given visited ISO codes (empty list matches nothing). */
export function buildVisitedFilter(
  codes: readonly string[],
): FilterSpecification {
  return [
    "in",
    ["get", "iso"],
    ["literal", [...codes]],
  ] as FilterSpecification;
}

/** Filter matching the selected country outline (null matches nothing). */
export function buildSelectedFilter(
  iso: string | null,
): FilterSpecification {
  return ["==", ["get", "iso"], iso ?? ""] as FilterSpecification;
}

/** Fill color that lightens while hovered, via the `hover` feature-state. */
function hoverableFill(base: string, hover: string) {
  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    hover,
    base,
  ] as unknown as string;
}

/**
 * Minimal self-contained dark style: no external tiles, a single GeoJSON
 * source, globe projection that flattens as you zoom in.
 */
export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": MAP_COLORS.space,
      "horizon-color": "#1b2436",
      "fog-color": "#0d1320",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.85,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        0.8,
        5,
        0.8,
        7,
        0,
      ] as unknown as number,
    },
    sources: {
      [COUNTRIES_SOURCE]: {
        type: "geojson",
        data: COUNTRIES_DATA_URL,
        promoteId: "iso",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": MAP_COLORS.ocean },
      },
      {
        id: LAYER_FILL,
        type: "fill",
        source: COUNTRIES_SOURCE,
        paint: {
          "fill-color": hoverableFill(
            MAP_COLORS.country,
            MAP_COLORS.countryHover,
          ),
        },
      },
      {
        id: LAYER_VISITED,
        type: "fill",
        source: COUNTRIES_SOURCE,
        filter: buildVisitedFilter([]),
        paint: {
          "fill-color": hoverableFill(
            MAP_COLORS.visited,
            MAP_COLORS.visitedHover,
          ),
        },
      },
      {
        id: LAYER_BORDER,
        type: "line",
        source: COUNTRIES_SOURCE,
        paint: {
          "line-color": MAP_COLORS.border,
          "line-width": 0.75,
        },
      },
      {
        id: LAYER_SELECTED,
        type: "line",
        source: COUNTRIES_SOURCE,
        filter: buildSelectedFilter(null),
        paint: {
          "line-color": MAP_COLORS.selectedOutline,
          "line-width": 1.75,
        },
      },
    ],
  };
}

// --- Idle rotation -----------------------------------------------------------

export const IDLE_ROTATION_DELAY_MS = 5_000;
/** Slow spin: one revolution every ~2.5 minutes. */
export const IDLE_ROTATION_DEG_PER_SEC = 2.5;
/** Only rotate while zoomed out enough to look like a globe. */
export const IDLE_ROTATION_MAX_ZOOM = 3;

export function shouldIdleRotate(zoom: number, idleMs: number): boolean {
  return zoom < IDLE_ROTATION_MAX_ZOOM && idleMs >= IDLE_ROTATION_DELAY_MS;
}
