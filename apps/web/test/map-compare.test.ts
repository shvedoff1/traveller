import { describe, expect, it } from "vitest";

import {
  buildCompareLayerFilters,
  partitionCompare,
} from "../lib/map/compare";
import { buildVisitedFilter } from "../lib/map/map-style";

describe("partitionCompare", () => {
  it("splits codes into mine-only / theirs-only / both", () => {
    expect(partitionCompare(["FR", "JP", "BR"], ["BR", "AR"])).toEqual({
      mineOnly: ["FR", "JP"],
      theirsOnly: ["AR"],
      both: ["BR"],
    });
  });

  it("handles disjoint maps (no overlap)", () => {
    expect(partitionCompare(["FR"], ["JP"])).toEqual({
      mineOnly: ["FR"],
      theirsOnly: ["JP"],
      both: [],
    });
  });

  it("handles identical maps (everything overlaps)", () => {
    expect(partitionCompare(["FR", "JP"], ["JP", "FR"])).toEqual({
      mineOnly: [],
      theirsOnly: [],
      both: ["FR", "JP"],
    });
  });

  it("handles empty sides", () => {
    expect(partitionCompare([], ["JP"])).toEqual({
      mineOnly: [],
      theirsOnly: ["JP"],
      both: [],
    });
    expect(partitionCompare(["FR"], [])).toEqual({
      mineOnly: ["FR"],
      theirsOnly: [],
      both: [],
    });
    expect(partitionCompare([], [])).toEqual({
      mineOnly: [],
      theirsOnly: [],
      both: [],
    });
  });

  it("deduplicates repeated codes", () => {
    expect(partitionCompare(["FR", "FR"], ["FR", "JP", "JP"])).toEqual({
      mineOnly: [],
      theirsOnly: ["JP"],
      both: ["FR"],
    });
  });

  it("puts every code in exactly one bucket", () => {
    const mine = ["FR", "JP", "BR", "DE"];
    const theirs = ["BR", "DE", "AR", "CL"];
    const { mineOnly, theirsOnly, both } = partitionCompare(mine, theirs);
    const all = [...mineOnly, ...theirsOnly, ...both];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set([...mine, ...theirs]));
  });
});

describe("buildCompareLayerFilters", () => {
  it("outside compare mode: my full map, compare layers match nothing", () => {
    expect(buildCompareLayerFilters(["FR", "JP"], null)).toEqual({
      visited: buildVisitedFilter(["FR", "JP"]),
      friend: buildVisitedFilter([]),
      overlap: buildVisitedFilter([]),
    });
  });

  it("in compare mode: partitions across the three layers", () => {
    expect(buildCompareLayerFilters(["FR", "BR"], ["BR", "AR"])).toEqual({
      visited: buildVisitedFilter(["FR"]),
      friend: buildVisitedFilter(["AR"]),
      overlap: buildVisitedFilter(["BR"]),
    });
  });

  it("comparing with an empty friend map keeps mine intact", () => {
    expect(buildCompareLayerFilters(["FR"], [])).toEqual({
      visited: buildVisitedFilter(["FR"]),
      friend: buildVisitedFilter([]),
      overlap: buildVisitedFilter([]),
    });
  });
});
