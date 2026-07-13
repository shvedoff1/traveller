import { type FollowUser, type PublicProfile } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  applyFollowToFollowingList,
  applyFollowToProfile,
  applyFollowToSearchResults,
} from "../lib/social/follow-cache";

const profile: PublicProfile = {
  username: "maria",
  displayName: "Maria Silva",
  avatarUrl: null,
  countryCodes: ["BR"],
  counts: { countries: 1, followers: 2, following: 5 },
  isFollowing: false,
};

const maria: FollowUser = {
  username: "maria",
  displayName: "Maria Silva",
  avatarUrl: null,
  countryCount: 1,
};

const kenji: FollowUser = {
  username: "kenji",
  displayName: "Kenji Watanabe",
  avatarUrl: null,
  countryCount: 3,
};

describe("applyFollowToProfile", () => {
  it("sets the flag and bumps the follower count", () => {
    const next = applyFollowToProfile(profile, true);
    expect(next?.isFollowing).toBe(true);
    expect(next?.counts.followers).toBe(3);
    // Untouched fields survive; the input is not mutated.
    expect(next?.countryCodes).toEqual(["BR"]);
    expect(profile.isFollowing).toBe(false);
    expect(profile.counts.followers).toBe(2);
  });

  it("clears the flag and drops the follower count, never below zero", () => {
    const next = applyFollowToProfile(profile, false);
    expect(next?.isFollowing).toBe(false);
    expect(next?.counts.followers).toBe(1);

    const zero = applyFollowToProfile(
      { ...profile, counts: { ...profile.counts, followers: 0 } },
      false,
    );
    expect(zero?.counts.followers).toBe(0);
  });

  it("passes undefined through (no cached profile)", () => {
    expect(applyFollowToProfile(undefined, true)).toBeUndefined();
  });
});

describe("applyFollowToSearchResults", () => {
  const results = [
    { ...maria, isFollowing: false },
    { ...kenji, isFollowing: true },
  ];

  it("flips only the matching row", () => {
    const next = applyFollowToSearchResults(results, "maria", true);
    expect(next).toEqual([
      { ...maria, isFollowing: true },
      { ...kenji, isFollowing: true },
    ]);
    expect(results[0]?.isFollowing).toBe(false); // input not mutated
  });

  it("passes undefined through", () => {
    expect(
      applyFollowToSearchResults(undefined, "maria", true),
    ).toBeUndefined();
  });
});

describe("applyFollowToFollowingList", () => {
  it("appends on follow (follow-date order)", () => {
    expect(applyFollowToFollowingList([kenji], maria, true)).toEqual([
      kenji,
      maria,
    ]);
  });

  it("is idempotent when already following", () => {
    const list = [maria, kenji];
    expect(applyFollowToFollowingList(list, maria, true)).toBe(list);
  });

  it("removes on unfollow, and tolerates missing rows", () => {
    expect(applyFollowToFollowingList([maria, kenji], maria, false)).toEqual([
      kenji,
    ]);
    expect(applyFollowToFollowingList([kenji], maria, false)).toEqual([kenji]);
  });

  it("passes undefined through", () => {
    expect(applyFollowToFollowingList(undefined, maria, true)).toBeUndefined();
  });
});
