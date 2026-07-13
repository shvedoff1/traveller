import { COUNTRIES } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import { computeStats } from "../lib/stats";

describe("computeStats", () => {
  it("returns zeros for an empty list", () => {
    const stats = computeStats([]);
    expect(stats.visited).toBe(0);
    expect(stats.total).toBe(COUNTRIES.length);
    expect(stats.percent).toBe(0);
    for (const continent of stats.continents) {
      expect(continent.visited).toBe(0);
      expect(continent.total).toBeGreaterThan(0);
    }
  });

  it("counts distinct valid codes and buckets them per continent", () => {
    const stats = computeStats(["FR", "DE", "JP", "BR"]);
    expect(stats.visited).toBe(4);

    const byName = Object.fromEntries(
      stats.continents.map((entry) => [entry.continent, entry.visited]),
    );
    expect(byName["Europe"]).toBe(2);
    expect(byName["Asia"]).toBe(1);
    expect(byName["South America"]).toBe(1);
    expect(byName["Africa"]).toBe(0);
  });

  it("ignores duplicates and unknown codes", () => {
    const stats = computeStats(["FR", "FR", "ZZ", "XK", ""]);
    expect(stats.visited).toBe(1);
  });

  it("computes the world percentage to one decimal", () => {
    const stats = computeStats(["FR"]);
    expect(stats.percent).toBe(
      Math.round((1 / COUNTRIES.length) * 1000) / 10,
    );
    expect(stats.percent).toBeCloseTo(0.4, 5);
  });

  it("reaches 100% when everything is visited", () => {
    const stats = computeStats(COUNTRIES.map((country) => country.code));
    expect(stats.visited).toBe(COUNTRIES.length);
    expect(stats.percent).toBe(100);
    for (const continent of stats.continents) {
      expect(continent.visited).toBe(continent.total);
    }
  });

  it("continent totals sum to the world total", () => {
    const stats = computeStats([]);
    const sum = stats.continents.reduce((acc, entry) => acc + entry.total, 0);
    expect(sum).toBe(COUNTRIES.length);
  });
});
