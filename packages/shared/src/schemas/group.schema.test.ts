import { describe, expect, it } from "vitest";

import {
  GROUP_NAME_MAX,
  addGroupMemberSchema,
  groupDetailSchema,
  groupInvitePreviewSchema,
  groupListSchema,
  groupNameInputSchema,
} from "./group.schema";

const member = {
  username: "maria",
  displayName: "Maria Silva",
  avatarUrl: null,
  isOwner: true,
  countryCount: 2,
  uniqueCount: 1,
  countryCodes: ["BR", "PT"],
};

const detail = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Lisbon crew",
  createdAt: "2026-09-26T10:00:00.000Z",
  isOwner: true,
  inviteCode: "abc123",
  members: [member],
  stats: {
    countryCount: 2,
    worldPercent: 0.8,
    averageCount: 2,
    continents: { Europe: { visited: 1, total: 51 } },
    countryCodes: ["BR", "PT"],
    sharedCodes: [],
    popular: [],
  },
};

describe("groupNameInputSchema", () => {
  it("trims and accepts a sensible name", () => {
    expect(groupNameInputSchema.parse({ name: "  Crew  " })).toEqual({
      name: "Crew",
    });
  });

  it("rejects blank, too long and extra keys", () => {
    expect(groupNameInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      groupNameInputSchema.safeParse({ name: "x".repeat(GROUP_NAME_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      groupNameInputSchema.safeParse({ name: "ok", owner: "me" }).success,
    ).toBe(false);
  });
});

describe("addGroupMemberSchema", () => {
  it("requires a valid username", () => {
    expect(addGroupMemberSchema.parse({ username: "kenji" })).toEqual({
      username: "kenji",
    });
    expect(addGroupMemberSchema.safeParse({ username: "Bad Name" }).success).toBe(
      false,
    );
  });
});

describe("groupDetailSchema", () => {
  it("parses a full detail payload", () => {
    expect(groupDetailSchema.parse(detail)).toEqual(detail);
  });

  it("rejects malformed member country codes", () => {
    expect(
      groupDetailSchema.safeParse({
        ...detail,
        members: [{ ...member, countryCodes: ["BRA"] }],
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive popular counts", () => {
    expect(
      groupDetailSchema.safeParse({
        ...detail,
        stats: { ...detail.stats, popular: [{ code: "PT", count: 0 }] },
      }).success,
    ).toBe(false);
  });
});

describe("list + invite schemas", () => {
  it("parses summaries and invite previews", () => {
    expect(
      groupListSchema.parse([
        {
          id: detail.id,
          name: "Crew",
          memberCount: 3,
          countryCount: 12,
          isOwner: false,
        },
      ]),
    ).toHaveLength(1);
    expect(
      groupInvitePreviewSchema.parse({
        id: detail.id,
        name: "Crew",
        memberCount: 1,
        ownerDisplayName: "Maria",
        isMember: false,
      }).isMember,
    ).toBe(false);
  });
});
