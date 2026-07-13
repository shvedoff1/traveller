import { CONTINENTS, COUNTRIES } from "@traveller/shared";

import { computeCountryStats } from "./stats.logic";

describe("computeCountryStats", () => {
  it("returns zeros with all continent totals for no visits", () => {
    const stats = computeCountryStats([]);
    expect(stats.countryCount).toBe(0);
    expect(stats.worldPercent).toBe(0);
    expect(Object.keys(stats.continents).sort()).toEqual(
      [...CONTINENTS].sort(),
    );
    for (const continent of CONTINENTS) {
      expect(stats.continents[continent]!.visited).toBe(0);
      expect(stats.continents[continent]!.total).toBe(
        COUNTRIES.filter((c) => c.continent === continent).length,
      );
    }
    // Continent totals cover the whole canonical list.
    const totalSum = Object.values(stats.continents).reduce(
      (sum, { total }) => sum + total,
      0,
    );
    expect(totalSum).toBe(COUNTRIES.length);
  });

  it("counts visits per continent", () => {
    const stats = computeCountryStats(["FR", "IT", "JP", "US", "CA", "MX"]);
    expect(stats.countryCount).toBe(6);
    expect(stats.continents["Europe"]!.visited).toBe(2);
    expect(stats.continents["Asia"]!.visited).toBe(1);
    expect(stats.continents["North America"]!.visited).toBe(3);
    expect(stats.continents["Africa"]!.visited).toBe(0);
  });

  it("computes the world percent with one decimal", () => {
    const five = computeCountryStats(["US", "CA", "MX", "FR", "IT"]);
    expect(five.worldPercent).toBe(
      Math.round((5 / COUNTRIES.length) * 1000) / 10,
    );
    expect(five.worldPercent).toBe(2); // 5 / 249

    const one = computeCountryStats(["JP"]);
    expect(one.worldPercent).toBe(0.4); // 1 / 249 → 0.4016… → 0.4
  });

  it("ignores duplicates and unknown codes", () => {
    const stats = computeCountryStats(["FR", "FR", "XX", "ZZ", ""]);
    expect(stats.countryCount).toBe(1);
    expect(stats.continents["Europe"]!.visited).toBe(1);
  });
});
