/**
 * Pure builders for the MapLibre style, layer filters and idle-rotation
 * logic — extracted so they are unit-testable without WebGL.
 */

import type {
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";

import { type Theme } from "../theme";

export const COUNTRIES_SOURCE = "countries";
export const COUNTRIES_DATA_URL = "/geo/countries.geojson";

export const LAYER_FILL = "countries-fill";
export const LAYER_VISITED = "countries-visited";
export const LAYER_FRIEND = "countries-friend";
export const LAYER_OVERLAP = "countries-overlap";
export const LAYER_BORDER = "countries-border";
export const LAYER_SELECTED = "countries-selected";

export interface MapPalette {
  /** Space around the globe. */
  space: string;
  horizon: string;
  fog: string;
  /** Globe surface / oceans. */
  ocean: string;
  /** Unvisited country fill. */
  country: string;
  countryHover: string;
  /** Accent for visited countries (shared across themes). */
  visited: string;
  visitedHover: string;
  /** Compare mode: countries only the friend has visited. */
  friend: string;
  friendHover: string;
  /** Compare mode: countries you both visited. */
  overlap: string;
  overlapHover: string;
  border: string;
  selectedOutline: string;
}

/** Per-theme map palettes; the visited accent is the same in both. */
export const MAP_PALETTES: Record<Theme, MapPalette> = {
  dark: {
    space: "#05070d",
    horizon: "#1b2436",
    fog: "#0d1320",
    ocean: "#101624",
    country: "#242b3a",
    countryHover: "#3a4459",
    visited: "#0f9d84",
    visitedHover: "#16bda0",
    friend: "#8b5cf6",
    friendHover: "#a78bfa",
    overlap: "#d97706",
    overlapHover: "#f59e0b",
    border: "#0b0e14",
    selectedOutline: "#5eead4",
  },
  light: {
    space: "#dee5ee",
    horizon: "#c3d2e2",
    fog: "#d3deea",
    ocean: "#c9d9e8",
    country: "#f2f4f7",
    countryHover: "#dfe4ec",
    visited: "#0f9d84",
    visitedHover: "#0b8571",
    friend: "#7c3aed",
    friendHover: "#6d28d9",
    overlap: "#d97706",
    overlapHover: "#b45309",
    border: "#ffffff",
    selectedOutline: "#0f766e",
  },
};


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
 * Minimal self-contained style: no external tiles, a single GeoJSON
 * source, globe projection that flattens as you zoom in. The palette is
 * theme-dependent; layer/source structure is identical in both themes so
 * `map.setStyle` can diff-swap without losing filters or feature-state.
 */
export function buildMapStyle(theme: Theme = "dark"): StyleSpecification {
  const MAP_COLORS = MAP_PALETTES[theme];
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": MAP_COLORS.space,
      "horizon-color": MAP_COLORS.horizon,
      "fog-color": MAP_COLORS.fog,
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
        id: LAYER_FRIEND,
        type: "fill",
        source: COUNTRIES_SOURCE,
        filter: buildVisitedFilter([]),
        paint: {
          "fill-color": hoverableFill(
            MAP_COLORS.friend,
            MAP_COLORS.friendHover,
          ),
        },
      },
      {
        id: LAYER_OVERLAP,
        type: "fill",
        source: COUNTRIES_SOURCE,
        filter: buildVisitedFilter([]),
        paint: {
          "fill-color": hoverableFill(
            MAP_COLORS.overlap,
            MAP_COLORS.overlapHover,
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
