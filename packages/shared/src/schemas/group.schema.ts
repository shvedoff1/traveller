import { z } from "zod";

import { usernameSchema } from "./user.schema";
import { countryCodeSchema } from "./visit.schema";

/** Most members a group can hold (owner included). */
export const GROUP_MEMBER_LIMIT = 50;
/** Most groups one user can own. */
export const GROUPS_OWNED_LIMIT = 20;
/** Length cap for a group name. */
export const GROUP_NAME_MAX = 60;
/** How many "most visited in the group" countries the stats return. */
export const GROUP_POPULAR_LIMIT = 10;

export const groupNameSchema = z.string().trim().min(1).max(GROUP_NAME_MAX);

/** POST /groups and PATCH /groups/:id request body. */
export const groupNameInputSchema = z.object({ name: groupNameSchema }).strict();
export type GroupNameInput = z.infer<typeof groupNameInputSchema>;

/** POST /groups/:id/members request body (owner adds someone directly). */
export const addGroupMemberSchema = z
  .object({ username: usernameSchema })
  .strict();
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

/** GET /me/groups row. */
export const groupSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  memberCount: z.number().int().positive(),
  /** Distinct countries visited by anyone in the group. */
  countryCount: z.number().int().nonnegative(),
  isOwner: z.boolean(),
});
export type GroupSummary = z.infer<typeof groupSummarySchema>;
export const groupListSchema = z.array(groupSummarySchema);

/** One member in a group's detail, with their share of the group map. */
export const groupMemberSchema = z.object({
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isOwner: z.boolean(),
  countryCount: z.number().int().nonnegative(),
  /** Countries nobody else in the group has visited. */
  uniqueCount: z.number().int().nonnegative(),
  countryCodes: z.array(countryCodeSchema),
});
export type GroupMember = z.infer<typeof groupMemberSchema>;

/** Aggregate travel stats over every member's map. */
export const groupStatsSchema = z.object({
  /** Distinct countries covered by the group together. */
  countryCount: z.number().int().nonnegative(),
  /** That union's share of the world in percent, one decimal. */
  worldPercent: z.number().min(0).max(100),
  /** Mean countries per member, one decimal. */
  averageCount: z.number().nonnegative(),
  continents: z.record(
    z.string(),
    z.object({
      visited: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
  /** Every distinct code anyone visited (the group map). */
  countryCodes: z.array(countryCodeSchema),
  /** Countries every member has visited (empty for a one-person group). */
  sharedCodes: z.array(countryCodeSchema),
  /** Countries visited by 2+ members, most members first. */
  popular: z.array(
    z.object({
      code: countryCodeSchema,
      count: z.number().int().positive(),
    }),
  ),
});
export type GroupStats = z.infer<typeof groupStatsSchema>;

/** GET /groups/:id response — members see everything. */
export const groupDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  isOwner: z.boolean(),
  /** Code for the /join/:code invite link (any member may share it). */
  inviteCode: z.string(),
  /** Sorted by country count, most-travelled first. */
  members: z.array(groupMemberSchema),
  stats: groupStatsSchema,
});
export type GroupDetail = z.infer<typeof groupDetailSchema>;

/** GET /group-invites/:code response — what you'd be joining. */
export const groupInvitePreviewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  memberCount: z.number().int().positive(),
  ownerDisplayName: z.string(),
  isMember: z.boolean(),
});
export type GroupInvitePreview = z.infer<typeof groupInvitePreviewSchema>;

/** POST /group-invites/:code response. */
export const joinGroupResponseSchema = z.object({ id: z.string().uuid() });
export type JoinGroupResponse = z.infer<typeof joinGroupResponseSchema>;
