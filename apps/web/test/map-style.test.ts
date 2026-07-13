import { describe, expect, it } from "vitest";

import {
  buildMapStyle,
  buildSelectedFilter,
  buildVisitedFilter,
  COUNTRIES_DATA_URL,
  COUNTRIES_SOURCE,
  IDLE_ROTATION_DELAY_MS,
  IDLE_ROTATION_MAX_ZOOM,
  LAYER_BORDER,
  LAYER_FILL,
  LAYER_FRIEND,
  LAYER_OVERLAP,
  LAYER_SELECTED,
  LAYER_VISITED,
  shouldIdleRotate,
} from "../lib/map/map-style";

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
    expect(Object.keys(style.sources)).toEqual([COUNTRIES_SOURCE]);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
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
