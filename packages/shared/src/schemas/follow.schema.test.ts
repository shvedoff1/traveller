import { describe, expect, it } from "vitest";

import {
  followUserListSchema,
  followUserSchema,
  friendMapEntrySchema,
  friendsMapResponseSchema,
  userSearchResultSchema,
} from "./follow.schema";
import { publicProfileSchema } from "./user.schema";

const validFollowUser = {
  username: "maria",
  displayName: "Maria Silva",
  avatarUrl: null,
  countryCount: 6,
};

describe("followUserSchema", () => {
  it("parses a follow-list row", () => {
    expect(followUserSchema.parse(validFollowUser)).toEqual(validFollowUser);
  });

  it("parses lists of rows", () => {
    expect(followUserListSchema.parse([validFollowUser])).toHaveLength(1);
    expect(followUserListSchema.parse([])).toEqual([]);
  });

  it("rejects invalid usernames and negative counts", () => {
    expect(
      followUserSchema.safeParse({ ...validFollowUser, username: "Bad-Name" })
        .success,
    ).toBe(false);
    expect(
      followUserSchema.safeParse({ ...validFollowUser, countryCount: -1 })
        .success,
    ).toBe(false);
  });
});

describe("userSearchResultSchema", () => {
  it("requires the isFollowing flag", () => {
    expect(
      userSearchResultSchema.parse({ ...validFollowUser, isFollowing: true })
        .isFollowing,
    ).toBe(true);
    expect(userSearchResultSchema.safeParse(validFollowUser).success).toBe(
      false,
    );
  });
});

describe("friendMapEntrySchema", () => {
  const entry = {
    username: "kenji",
    displayName: "Kenji Watanabe",
    avatarUrl: "https://example.com/kenji.png",
    countryCodes: ["JP", "KR"],
  };

  it("parses an entry with alpha-2 codes", () => {
    expect(friendMapEntrySchema.parse(entry)).toEqual(entry);
    expect(friendsMapResponseSchema.parse([entry])).toHaveLength(1);
  });

  it("rejects malformed country codes", () => {
    expect(
      friendMapEntrySchema.safeParse({ ...entry, countryCodes: ["JPN"] })
        .success,
    ).toBe(false);
  });
});

describe("publicProfileSchema.isFollowing", () => {
  const profile = {
    username: "maria",
    displayName: "Maria Silva",
    avatarUrl: null,
    countryCodes: ["BR"],
    counts: { countries: 1, followers: 0, following: 0 },
  };

  it("stays optional for anonymous reads", () => {
    expect(publicProfileSchema.parse(profile).isFollowing).toBeUndefined();
  });

  it("accepts the flag for authenticated reads", () => {
    expect(
      publicProfileSchema.parse({ ...profile, isFollowing: true }).isFollowing,
    ).toBe(true);
    expect(
      publicProfileSchema.safeParse({ ...profile, isFollowing: "yes" })
        .success,
    ).toBe(false);
  });
});
