import { COUNTRIES, GROUP_POPULAR_LIMIT } from "@traveller/shared";

import { type MemberInput, computeGroupStats } from "./group-stats.logic";

function member(
  username: string,
  countryCodes: string[],
  isOwner = false,
): MemberInput {
  return {
    username,
    displayName: username.toUpperCase(),
    avatarUrl: null,
    isOwner,
    countryCodes,
  };
}

describe("computeGroupStats", () => {
  it("aggregates the union, intersection, popularity and unique counts", () => {
    const { stats, members } = computeGroupStats([
      member("ann", ["FR", "IT", "JP"], true),
      member("bob", ["FR", "IT", "BR"]),
      member("cat", ["FR", "US"]),
    ]);

    expect(stats.countryCount).toBe(5);
    expect(stats.countryCodes).toEqual(["BR", "FR", "IT", "JP", "US"]);
    expect(stats.sharedCodes).toEqual(["FR"]);
    expect(stats.popular).toEqual([
      { code: "FR", count: 3 },
      { code: "IT", count: 2 },
    ]);
    expect(stats.averageCount).toBe(2.7); // 8 visits / 3 members
    expect(stats.worldPercent).toBe(
      Math.round((5 / COUNTRIES.length) * 1000) / 10,
    );
    expect(stats.continents["Europe"]!.visited).toBe(2);
    expect(stats.continents["Asia"]!.visited).toBe(1);

    // Most-travelled first; ties broken by username.
    expect(members.map((m) => m.username)).toEqual(["ann", "bob", "cat"]);
    expect(members.map((m) => m.uniqueCount)).toEqual([1, 1, 1]);
    expect(members[0]).toMatchObject({
      isOwner: true,
      countryCount: 3,
      countryCodes: ["FR", "IT", "JP"],
    });
  });

  it("has no shared countries for a one-person group", () => {
    const { stats, members } = computeGroupStats([member("solo", ["FR"], true)]);
    expect(stats.sharedCodes).toEqual([]);
    expect(stats.popular).toEqual([]);
    expect(members[0]!.uniqueCount).toBe(1);
  });

  it("ignores duplicates and unknown codes per member", () => {
    const { stats, members } = computeGroupStats([
      member("ann", ["FR", "FR", "XX"]),
      member("bob", ["FR", ""]),
    ]);
    expect(stats.countryCount).toBe(1);
    expect(stats.sharedCodes).toEqual(["FR"]);
    expect(members.map((m) => m.countryCount)).toEqual([1, 1]);
    expect(stats.averageCount).toBe(1);
  });

  it("caps the popular list", () => {
    const many = COUNTRIES.slice(0, GROUP_POPULAR_LIMIT + 5).map((c) => c.code);
    const { stats } = computeGroupStats([member("a", many), member("b", many)]);
    expect(stats.popular).toHaveLength(GROUP_POPULAR_LIMIT);
    expect(stats.sharedCodes).toHaveLength(many.length);
  });

  it("handles an empty group", () => {
    const { stats, members } = computeGroupStats([]);
    expect(stats.countryCount).toBe(0);
    expect(stats.averageCount).toBe(0);
    expect(members).toEqual([]);
  });
});
