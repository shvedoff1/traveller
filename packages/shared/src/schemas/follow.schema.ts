import { z } from "zod";

import { usernameSchema } from "./user.schema";

/**
 * A user row in following/followers lists
 * (`GET /me/following`, `GET /me/followers`).
 */
export const followUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  countryCount: z.number().int().nonnegative(),
});
export type FollowUser = z.infer<typeof followUserSchema>;

export const followUserListSchema = z.array(followUserSchema);

/**
 * `GET /users/search?q=` result row — a follow-list row plus whether the
 * searching user already follows them (search always runs authenticated).
 */
export const userSearchResultSchema = followUserSchema.extend({
  isFollowing: z.boolean(),
});
export type UserSearchResult = z.infer<typeof userSearchResultSchema>;

export const userSearchResultListSchema = z.array(userSearchResultSchema);

/** `GET /me/friends-map` entry — a followed user with their visited codes. */
export const friendMapEntrySchema = z.object({
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  countryCodes: z.array(z.string().length(2)),
});
export type FriendMapEntry = z.infer<typeof friendMapEntrySchema>;

export const friendsMapResponseSchema = z.array(friendMapEntrySchema);

/** `GET /me/friends-map` is capped to the first N follows by follow date. */
export const FRIENDS_MAP_LIMIT = 50;

/** `GET /users/search` returns at most this many rows. */
export const USER_SEARCH_LIMIT = 10;
