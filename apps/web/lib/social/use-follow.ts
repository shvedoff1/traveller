"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FollowUser,
  type PublicProfile,
  type UserSearchResult,
} from "@traveller/shared";

import { api } from "../api-client";
import { describeMutationError } from "../errors";
import { pushErrorToast } from "../stores/toast-store";
import {
  applyFollowToFollowingList,
  applyFollowToProfile,
  applyFollowToSearchResults,
} from "./follow-cache";

export const FOLLOWING_QUERY_KEY = ["following"] as const;
export const FOLLOWERS_QUERY_KEY = ["followers"] as const;
export const FRIENDS_MAP_QUERY_KEY = ["friends-map"] as const;
export const USER_SEARCH_QUERY_KEY = ["user-search"] as const;

export function profileQueryKey(username: string) {
  return ["profile", username] as const;
}

export function useFollowing(enabled: boolean) {
  return useQuery({
    queryKey: FOLLOWING_QUERY_KEY,
    queryFn: api.getFollowing,
    enabled,
  });
}

export function useFollowers(enabled: boolean) {
  return useQuery({
    queryKey: FOLLOWERS_QUERY_KEY,
    queryFn: api.getFollowers,
    enabled,
  });
}

/** Visited codes for everyone I follow — drives the map compare overlay. */
export function useFriendsMap(enabled: boolean) {
  return useQuery({
    queryKey: FRIENDS_MAP_QUERY_KEY,
    queryFn: api.getFriendsMap,
    enabled,
  });
}

/** Debounce upstream — every distinct `query` here hits the API (20/min). */
export function useUserSearch(query: string, enabled: boolean) {
  const q = query.trim();
  return useQuery({
    queryKey: [...USER_SEARCH_QUERY_KEY, q],
    queryFn: () => api.searchUsers(q),
    enabled: enabled && q.length > 0,
  });
}

/** Public profile through the cookie-authed client (carries isFollowing). */
export function useProfileQuery(username: string, enabled: boolean) {
  return useQuery({
    queryKey: profileQueryKey(username),
    queryFn: () => api.getProfile(username),
    enabled,
  });
}

export interface FollowVariables {
  /** Target row — the full shape so the following list updates in place. */
  user: FollowUser;
  /** true = follow, false = unfollow. */
  follow: boolean;
}

interface FollowSnapshot {
  profile: PublicProfile | undefined;
  following: FollowUser[] | undefined;
  searches: Array<[readonly unknown[], UserSearchResult[] | undefined]>;
}

/**
 * Optimistic follow/unfollow. On mutate it updates every cache that shows
 * follow state — the target's profile, the following list and any search
 * results — then rolls all of them back on error and reconciles with the
 * server on settle.
 */
export function useFollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ user, follow }: FollowVariables) =>
      follow ? api.followUser(user.username) : api.unfollowUser(user.username),

    onMutate: async ({ user, follow }): Promise<FollowSnapshot> => {
      const profileKey = profileQueryKey(user.username);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileKey }),
        queryClient.cancelQueries({ queryKey: FOLLOWING_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: USER_SEARCH_QUERY_KEY }),
      ]);

      const snapshot: FollowSnapshot = {
        profile: queryClient.getQueryData<PublicProfile>(profileKey),
        following: queryClient.getQueryData<FollowUser[]>(FOLLOWING_QUERY_KEY),
        searches: queryClient.getQueriesData<UserSearchResult[]>({
          queryKey: USER_SEARCH_QUERY_KEY,
        }),
      };

      queryClient.setQueryData<PublicProfile>(profileKey, (old) =>
        applyFollowToProfile(old, follow),
      );
      queryClient.setQueryData<FollowUser[]>(FOLLOWING_QUERY_KEY, (old) =>
        applyFollowToFollowingList(old, user, follow),
      );
      queryClient.setQueriesData<UserSearchResult[]>(
        { queryKey: USER_SEARCH_QUERY_KEY },
        (old) => applyFollowToSearchResults(old, user.username, follow),
      );
      return snapshot;
    },

    onError: (error, { user, follow }, context) => {
      pushErrorToast(
        describeMutationError(
          error,
          follow
            ? `Couldn’t follow @${user.username} — undone.`
            : `Couldn’t unfollow @${user.username} — undone.`,
        ),
      );
      if (!context) return;
      queryClient.setQueryData(profileQueryKey(user.username), context.profile);
      queryClient.setQueryData(FOLLOWING_QUERY_KEY, context.following);
      for (const [key, data] of context.searches) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: (_data, _error, { user }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: profileQueryKey(user.username),
        }),
        queryClient.invalidateQueries({ queryKey: FOLLOWING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: FOLLOWERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: FRIENDS_MAP_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: USER_SEARCH_QUERY_KEY }),
      ]),
  });
}
