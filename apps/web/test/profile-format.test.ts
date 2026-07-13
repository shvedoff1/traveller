import { CONTINENTS, COUNTRIES, type UserStats } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  formatCountryCount,
  formatWorldPercent,
  ogSubtitle,
  profileDescription,
  profileTitle,
  statsToWorldStats,
} from "../lib/profile/format";

describe("formatCountryCount", () => {
  it("pluralizes", () => {
    expect(formatCountryCount(0)).toBe("0 countries");
    expect(formatCountryCount(1)).toBe("1 country");
    expect(formatCountryCount(47)).toBe("47 countries");
  });
});

describe("formatWorldPercent", () => {
  it("renders integers and one-decimal percents", () => {
    expect(formatWorldPercent(24)).toBe("24%");
    expect(formatWorldPercent(2.4)).toBe("2.4%");
    expect(formatWorldPercent(0)).toBe("0%");
  });
});

describe("profileTitle", () => {
  it("builds the page/OG title", () => {
    expect(profileTitle("John Carter", 47)).toBe("John Carter — 47 countries");
    expect(profileTitle("Solo", 1)).toBe("Solo — 1 country");
  });
});

describe("profileDescription", () => {
  it("mentions the count and world share", () => {
    expect(profileDescription("John Carter", 47, 18.9)).toBe(
      "John Carter has visited 47 countries — 18.9% of the world. See the map on Traveller.",
    );
  });
});

describe("ogSubtitle", () => {
  it("joins count and percent with a middot", () => {
    expect(ogSubtitle(47, 24)).toBe("47 countries · 24% of the world");
  });
});

describe("statsToWorldStats", () => {
  const apiStats: UserStats = {
    countryCount: 3,
    worldPercent: 1.2,
    continents: {
      Europe: { visited: 2, total: 51 },
      Asia: { visited: 1, total: 49 },
    },
    followerCount: 4,
    followingCount: 5,
  };

  it("maps to the StatsPanel shape in canonical continent order", () => {
    const world = statsToWorldStats(apiStats);
    expect(world.visited).toBe(3);
    expect(world.total).toBe(COUNTRIES.length);
    expect(world.percent).toBe(1.2);
    expect(world.continents.map((c) => c.continent)).toEqual([...CONTINENTS]);
    expect(
      world.continents.find((c) => c.continent === "Europe"),
    ).toEqual({ continent: "Europe", visited: 2, total: 51 });
  });

  it("zero-fills continents the API omitted", () => {
    const world = statsToWorldStats(apiStats);
    expect(
      world.continents.find((c) => c.continent === "Africa"),
    ).toEqual({ continent: "Africa", visited: 0, total: 0 });
  });
});
