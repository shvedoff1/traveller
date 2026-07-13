import { describe, expect, it } from "vitest";

import {
  publicProfileSchema,
  updateMeSchema,
  usernameSchema,
} from "./user.schema";

describe("usernameSchema", () => {
  it.each(["abc", "john_doe", "a1_", "x".repeat(30), "user123"])(
    "accepts %s",
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "ab", // too short
    "x".repeat(31), // too long
    "John", // uppercase
    "john-doe", // hyphen
    "john doe", // space
    "jöhn", // non-ascii
    "", // empty
  ])("rejects %j", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });
});

describe("updateMeSchema", () => {
  it("accepts a username claim", () => {
    expect(updateMeSchema.parse({ username: "maria" })).toEqual({
      username: "maria",
    });
  });

  it("accepts a displayName change and trims it", () => {
    expect(updateMeSchema.parse({ displayName: " Maria " })).toEqual({
      displayName: "Maria",
    });
  });

  it("rejects an empty object", () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(updateMeSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
  });

  it("rejects an invalid username", () => {
    expect(updateMeSchema.safeParse({ username: "No" }).success).toBe(false);
  });
});

describe("publicProfileSchema", () => {
  it("parses a full profile", () => {
    const profile = {
      username: "kenji",
      displayName: "Kenji",
      avatarUrl: null,
      countryCodes: ["JP", "FR"],
      counts: { countries: 2, followers: 1, following: 3 },
    };
    expect(publicProfileSchema.parse(profile)).toEqual(profile);
  });

  it("rejects malformed country codes", () => {
    expect(
      publicProfileSchema.safeParse({
        username: "kenji",
        displayName: "Kenji",
        avatarUrl: null,
        countryCodes: ["JPN"],
        counts: { countries: 1, followers: 0, following: 0 },
      }).success,
    ).toBe(false);
  });
});
