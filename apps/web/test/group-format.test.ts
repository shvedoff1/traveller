import { type GroupDetail } from "@traveller/shared";
import { describe, expect, it } from "vitest";

import {
  countryByCode,
  groupMapLayers,
  inviteUrl,
  pluralize,
} from "../lib/groups/format";

const group: Pick<GroupDetail, "members" | "stats"> = {
  members: [
    {
      username: "ann",
      displayName: "Ann",
      avatarUrl: null,
      isOwner: true,
      countryCount: 2,
      uniqueCount: 1,
      countryCodes: ["FR", "JP"],
    },
    {
      username: "bob",
      displayName: "Bob",
      avatarUrl: null,
      isOwner: false,
      countryCount: 2,
      uniqueCount: 1,
      countryCodes: ["BR", "FR"],
    },
  ],
  stats: {
    countryCount: 3,
    worldPercent: 1.2,
    averageCount: 2,
    continents: {},
    countryCodes: ["BR", "FR", "JP"],
    sharedCodes: ["FR"],
    popular: [{ code: "FR", count: 2 }],
  },
};

describe("inviteUrl", () => {
  it("joins origin and code, tolerating a trailing slash", () => {
    expect(inviteUrl("https://t.example", "abc_DEF-123")).toBe(
      "https://t.example/join/abc_DEF-123",
    );
    expect(inviteUrl("https://t.example/", "abc")).toBe(
      "https://t.example/join/abc",
    );
  });
});

describe("groupMapLayers", () => {
  it("highlights the countries everyone has been to by default", () => {
    expect(groupMapLayers(group, null)).toEqual({
      visited: ["BR", "FR", "JP"],
      highlight: ["FR"],
      highlightLabel: "Everyone",
    });
  });

  it("highlights a focused member's map", () => {
    expect(groupMapLayers(group, "bob")).toEqual({
      visited: ["BR", "FR", "JP"],
      highlight: ["BR", "FR"],
      highlightLabel: "Bob",
    });
  });

  it("falls back to the default for an unknown member", () => {
    expect(groupMapLayers(group, "ghost").highlightLabel).toBe("Everyone");
  });
});

describe("small helpers", () => {
  it("looks countries up by code", () => {
    expect(countryByCode("FR")?.name).toBe("France");
    expect(countryByCode("XX")).toBeUndefined();
  });

  it("pluralizes", () => {
    expect(pluralize(1, "member")).toBe("1 member");
    expect(pluralize(3, "member")).toBe("3 members");
    expect(pluralize(2, "country", "countries")).toBe("2 countries");
  });
});
