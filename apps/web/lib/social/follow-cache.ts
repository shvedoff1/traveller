/**
 * Pure cache updaters behind the optimistic follow/unfollow mutation —
 * extracted from the hook (like visits-cache.ts) so the partition of
 * "what changes where" is unit-testable.
 */

import {
  type FollowUser,
  type PublicProfile,
  type UserSearchResult,
} from "@traveller/shared";

/** Flip `isFollowing` on a cached public profile (undefined passes through). */
export function applyFollowToProfile(
  profile: PublicProfile | undefined,
  isFollowing: boolean,
): PublicProfile | undefined {
  if (!profile) return undefined;
  return {
    ...profile,
    isFollowing,
    counts: {
      ...profile.counts,
      followers: Math.max(0, profile.counts.followers + (isFollowing ? 1 : -1)),
    },
  };
}

/** Flip `isFollowing` on the matching row of a cached search result list. */
export function applyFollowToSearchResults(
  results: UserSearchResult[] | undefined,
  username: string,
  isFollowing: boolean,
): UserSearchResult[] | undefined {
  if (!results) return undefined;
  return results.map((row) =>
    row.username === username ? { ...row, isFollowing } : row,
  );
}

/**
 * Add/remove a row in the cached following list. Follows append at the
 * end (the list is ordered by follow date); duplicates and missing rows
 * are no-ops so the update is idempotent, like the API.
 */
export function applyFollowToFollowingList(
  list: FollowUser[] | undefined,
  user: FollowUser,
  isFollowing: boolean,
): FollowUser[] | undefined {
  if (!list) return undefined;
  if (!isFollowing) {
    return list.filter((row) => row.username !== user.username);
  }
  if (list.some((row) => row.username === user.username)) return list;
  return [...list, user];
}
