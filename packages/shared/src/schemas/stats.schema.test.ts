import { describe, expect, it } from "vitest";

import { userStatsSchema } from "./stats.schema";

const validStats = {
  countryCount: 5,
  worldPercent: 2,
  continents: {
    Europe: { visited: 2, total: 51 },
    "North America": { visited: 3, total: 41 },
  },
  followerCount: 1,
  followingCount: 2,
};

describe("userStatsSchema", () => {
  it("parses a full stats payload", () => {
    expect(userStatsSchema.parse(validStats)).toEqual(validStats);
  });

  it("accepts fractional world percents", () => {
    expect(
      userStatsSchema.safeParse({ ...validStats, worldPercent: 18.9 }).success,
    ).toBe(true);
  });

  it("rejects negative counts", () => {
    expect(
      userStatsSchema.safeParse({ ...validStats, countryCount: -1 }).success,
    ).toBe(false);
    expect(
      userStatsSchema.safeParse({ ...validStats, followerCount: -1 }).success,
    ).toBe(false);
  });

  it("rejects out-of-range percents", () => {
    expect(
      userStatsSchema.safeParse({ ...validStats, worldPercent: 101 }).success,
    ).toBe(false);
  });

  it("rejects malformed continent entries", () => {
    expect(
      userStatsSchema.safeParse({
        ...validStats,
        continents: { Europe: { visited: 2 } },
      }).success,
    ).toBe(false);
  });
});
