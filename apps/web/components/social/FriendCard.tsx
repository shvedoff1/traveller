"use client";

import { type FollowUser } from "@traveller/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMapStore } from "../../lib/stores/map-store";
import { FollowButton } from "./FollowButton";

/**
 * One row in the friends lists (and search results): avatar, name linking
 * to the public profile, country count, follow toggle and — for people I
 * follow — a "View on map" shortcut that enters compare mode on the main
 * map.
 */
export function FriendCard({
  user,
  isFollowing,
  showViewOnMap = false,
}: {
  user: FollowUser;
  isFollowing: boolean;
  showViewOnMap?: boolean;
}) {
  const router = useRouter();
  const startCompare = useMapStore((state) => state.startCompare);

  function viewOnMap() {
    startCompare({ username: user.username, displayName: user.displayName });
    router.push("/");
  }

  return (
    <li
      data-testid={`friend-card-${user.username}`}
      className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-3"
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="size-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-sm font-semibold uppercase"
        >
          {user.displayName.slice(0, 1)}
        </span>
      )}

      <Link href={`/${user.username}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.displayName}</p>
        <p className="truncate text-xs text-muted">
          @{user.username} ·{" "}
          <span data-testid="friend-country-count">{user.countryCount}</span>{" "}
          {user.countryCount === 1 ? "country" : "countries"}
        </p>
      </Link>

      {showViewOnMap ? (
        <button
          type="button"
          data-testid={`view-on-map-${user.username}`}
          onClick={viewOnMap}
          className="rounded-full border border-edge px-3 py-1.5 text-sm text-muted transition-colors duration-200 ease-out hover:border-edge-strong hover:text-foreground max-md:min-h-11"
        >
          View on map
        </button>
      ) : null}
      <FollowButton user={user} isFollowing={isFollowing} />
    </li>
  );
}
