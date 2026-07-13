"use client";

import { useQuery } from "@tanstack/react-query";
import { type FollowUser } from "@traveller/shared";
import Link from "next/link";

import { api } from "../../lib/api-client";
import {
  useFollowMutation,
  useProfileQuery,
} from "../../lib/social/use-follow";

/**
 * Follow/unfollow toggle used on public profiles, search results and
 * friend cards. Optimistic: the label flips immediately (via the shared
 * caches updated in useFollowMutation) and rolls back on error.
 *
 * - hidden on your own profile
 * - logged out: a login CTA styled like the button
 * - `isFollowing` omitted (public profile page): resolved from the
 *   authenticated `['profile', username]` query.
 */
export function FollowButton({
  user,
  isFollowing,
}: {
  user: FollowUser;
  isFollowing?: boolean;
}) {
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });
  const isSelf = me?.username === user.username;
  const { data: profile } = useProfileQuery(
    user.username,
    isFollowing === undefined && Boolean(me) && !isSelf,
  );
  const followMutation = useFollowMutation();

  if (meLoading || isSelf) return null;

  if (!me) {
    return (
      <Link
        href="/login"
        data-testid="follow-button"
        className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
      >
        Follow
      </Link>
    );
  }

  const following = isFollowing ?? profile?.isFollowing ?? false;

  return (
    <button
      type="button"
      data-testid="follow-button"
      aria-pressed={following}
      onClick={() => followMutation.mutate({ user, follow: !following })}
      className={
        following
          ? "rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-muted hover:border-white/30 hover:text-foreground"
          : "rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
