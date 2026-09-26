import { describe, expect, it } from "vitest";

import {
  buildMapStyle,
  buildSelectedFilter,
  buildVisitedFilter,
  COUNTRIES_DATA_URL,
  COUNTRIES_SOURCE,
  IDLE_ROTATION_DEG_PER_SEC,
  IDLE_ROTATION_DELAY_MS,
  IDLE_ROTATION_MAX_ZOOM,
  DAYLIGHT_SOURCE,
  LAYER_BORDER,
  LAYER_NIGHT,
  LAYER_FILL,
  LAYER_FRIEND,
  LAYER_OVERLAP,
  LAYER_SELECTED,
  LAYER_VISITED,
  MAP_PALETTES,
  idleRotationStep,
  nightLayerOpacity,
  shouldIdleRotate,
} from "../lib/map/map-style";
import { TWILIGHT_SHIFTS } from "../lib/map/daylight";

describe("buildVisitedFilter", () => {
  it("matches the given codes", () => {
    expect(buildVisitedFilter(["FR", "JP"])).toEqual([
      "in",
      ["get", "iso"],
      ["literal", ["FR", "JP"]],
    ]);
  });

  it("matches nothing when empty", () => {
    expect(buildVisitedFilter([])).toEqual(["in", ["get", "iso"], ["literal", []]]);
  });

  it("copies the input instead of aliasing it", () => {
    const codes = ["FR"];
    const filter = buildVisitedFilter(codes) as unknown[];
    codes.push("JP");
    expect((filter[2] as unknown[])[1]).toEqual(["FR"]);
  });
});

describe("buildSelectedFilter", () => {
  it("matches the selected iso", () => {
    expect(buildSelectedFilter("BR")).toEqual(["==", ["get", "iso"], "BR"]);
  });

  it("matches nothing for null (no country has an empty iso)", () => {
    expect(buildSelectedFilter(null)).toEqual(["==", ["get", "iso"], ""]);
  });
});

describe("buildMapStyle", () => {
  const style = buildMapStyle();

  it("uses globe projection", () => {
    expect(style.projection).toEqual({ type: "globe" });
  });

  it("declares the countries GeoJSON source promoted by iso", () => {
    expect(style.sources[COUNTRIES_SOURCE]).toMatchObject({
      type: "geojson",
      data: COUNTRIES_DATA_URL,
      promoteId: "iso",
    });
  });

  it("contains the expected layers, in paint order", () => {
    expect(style.layers.map((layer) => layer.id)).toEqual([
      "background",
      LAYER_FILL,
      LAYER_VISITED,
      LAYER_FRIEND,
      LAYER_OVERLAP,
      LAYER_NIGHT,
      LAYER_BORDER,
      LAYER_SELECTED,
    ]);
  });

  it("starts with no visited, compare or selected country", () => {
    const byId = new Map(style.layers.map((layer) => [layer.id, layer]));
    expect(byId.get(LAYER_VISITED)).toMatchObject({
      filter: buildVisitedFilter([]),
    });
    expect(byId.get(LAYER_FRIEND)).toMatchObject({
      filter: buildVisitedFilter([]),
    });
    expect(byId.get(LAYER_OVERLAP)).toMatchObject({
      filter: buildVisitedFilter([]),
    });
    expect(byId.get(LAYER_SELECTED)).toMatchObject({
      filter: buildSelectedFilter(null),
    });
  });

  it("is self-contained (no external tiles or glyphs)", () => {
    expect(Object.keys(style.sources)).toEqual([
      COUNTRIES_SOURCE,
      DAYLIGHT_SOURCE,
    ]);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
  });

  it("defaults to the dark palette", () => {
    expect(buildMapStyle()).toEqual(buildMapStyle("dark"));
  });
});

describe("theme palettes", () => {
  const dark = buildMapStyle("dark");
  const light = buildMapStyle("light");

  it("keeps the visited accent identical across themes", () => {
    expect(MAP_PALETTES.light.visited).toBe(MAP_PALETTES.dark.visited);
  });

  it("both themes share the exact layer/source structure (diffable swap)", () => {
    expect(light.layers.map((layer) => layer.id)).toEqual(
      dark.layers.map((layer) => layer.id),
    );
    expect(light.sources).toEqual(dark.sources);
    expect(light.projection).toEqual(dark.projection);
  });

  it("the light style actually uses the light palette", () => {
    const background = light.layers.find((layer) => layer.id === "background");
    expect(background).toMatchObject({
      paint: { "background-color": MAP_PALETTES.light.ocean },
    });
    expect(MAP_PALETTES.light.ocean).not.toBe(MAP_PALETTES.dark.ocean);
  });
});

describe("shouldIdleRotate", () => {
  it("rotates only when zoomed out and idle long enough", () => {
    expect(shouldIdleRotate(1, IDLE_ROTATION_DELAY_MS)).toBe(true);
    expect(shouldIdleRotate(1, IDLE_ROTATION_DELAY_MS - 1)).toBe(false);
    expect(shouldIdleRotate(IDLE_ROTATION_MAX_ZOOM, IDLE_ROTATION_DELAY_MS)).toBe(
      false,
    );
    expect(shouldIdleRotate(8, 60_000)).toBe(false);
  });
});

describe("idleRotationStep", () => {
  it("spins like the Earth: west → east, so the center longitude decreases", () => {
    expect(idleRotationStep(10, 1)).toBeCloseTo(10 - IDLE_ROTATION_DEG_PER_SEC);
    expect(idleRotationStep(10, 2)).toBeLessThan(idleRotationStep(10, 1));
  });

  it("wraps across the antimeridian", () => {
    expect(idleRotationStep(-179, 1)).toBeCloseTo(
      181 - IDLE_ROTATION_DEG_PER_SEC,
    );
    expect(idleRotationStep(0, 0)).toBe(0);
  });
});

describe("night shading layer", () => {
  it("sits over the fills and under the borders, fed by the daylight source", () => {
    for (const theme of ["dark", "light"] as const) {
      const style = buildMapStyle(theme);
      const ids = style.layers.map((layer) => layer.id);
      expect(ids.indexOf(LAYER_NIGHT)).toBeGreaterThan(ids.indexOf(LAYER_OVERLAP));
      expect(ids.indexOf(LAYER_NIGHT)).toBeLessThan(ids.indexOf(LAYER_BORDER));
      const night = style.layers.find((layer) => layer.id === LAYER_NIGHT);
      expect(night).toMatchObject({ type: "fill", source: DAYLIGHT_SOURCE });
      // Empty until MapCanvas sets real data (keeps the style time-free).
      expect(style.sources[DAYLIGHT_SOURCE]).toEqual({
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
  });

  it("splits the target darkness across the stacked twilight copies", () => {
    const per = nightLayerOpacity(0.5);
    expect(1 - Math.pow(1 - per, TWILIGHT_SHIFTS.length)).toBeCloseTo(0.5, 10);
    expect(per).toBeGreaterThan(0);
    expect(per).toBeLessThan(0.5);
  });
});
