"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "../../lib/api-client";
import {
  useFollowers,
  useFollowing,
  useUserSearch,
} from "../../lib/social/use-follow";
import { FriendCardSkeleton, Skeleton } from "../ui/Skeleton";
import { FriendCard } from "./FriendCard";

const SEARCH_DEBOUNCE_MS = 300;

type Tab = "following" | "followers";

/**
 * The /friends screen: debounced user search on top, following/followers
 * tabs below. Auth-required — logged-out visitors get a login CTA.
 */
export function FriendsScreen() {
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });
  const loggedIn = Boolean(me);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const search = useUserSearch(debouncedQuery, loggedIn);

  const [tab, setTab] = useState<Tab>("following");
  const following = useFollowing(loggedIn);
  const followers = useFollowers(loggedIn);

  /** Handles I follow — resolves follow state for followers rows. */
  const followingSet = useMemo(
    () => new Set((following.data ?? []).map((user) => user.username)),
    [following.data],
  );

  if (meLoading) {
    return (
      <section
        aria-busy="true"
        data-testid="friends-skeleton"
        className="mx-auto w-full max-w-xl px-4 pb-16 pt-20"
      >
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-4 h-10 w-full rounded-full" />
        <ul className="mt-5 space-y-2">
          <FriendCardSkeleton />
          <FriendCardSkeleton />
          <FriendCardSkeleton />
        </ul>
      </section>
    );
  }

  if (!me) {
    return (
      <section className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-edge bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Friends</h1>
        <p className="mt-2 text-sm text-muted">
          Log in to find friends and compare maps.
        </p>
        <Link
          href="/login"
          data-testid="friends-login-cta"
          className="mt-4 inline-block rounded-full bg-surface-strong px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong"
        >
          Log in
        </Link>
      </section>
    );
  }

  const searching = debouncedQuery.trim().length > 0;
  const activeList = tab === "following" ? following : followers;

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-16 pt-20">
      <h1 className="text-xl font-semibold tracking-tight">Friends</h1>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search travellers by name or @username"
        data-testid="friend-search"
        className="mt-4 min-h-11 w-full rounded-full border border-edge bg-surface px-4 py-2 text-sm transition-colors duration-200 ease-out placeholder:text-muted focus:border-edge-strong focus:outline-none"
      />

      {searching ? (
        <ul data-testid="search-results" className="mt-4 space-y-2">
          {search.isLoading ? <FriendCardSkeleton /> : null}
          {(search.data ?? []).map((row) => (
            <FriendCard
              key={row.username}
              user={row}
              isFollowing={row.isFollowing}
              showViewOnMap={row.isFollowing}
            />
          ))}
          {search.data?.length === 0 ? (
            <li className="px-2 py-4 text-sm text-muted">
              No travellers match “{debouncedQuery.trim()}”.
            </li>
          ) : null}
        </ul>
      ) : (
        <>
          <div role="tablist" className="mt-5 flex gap-2">
            <TabButton
              id="following"
              active={tab === "following"}
              count={following.data?.length}
              onSelect={setTab}
            >
              Following
            </TabButton>
            <TabButton
              id="followers"
              active={tab === "followers"}
              count={followers.data?.length}
              onSelect={setTab}
            >
              Followers
            </TabButton>
          </div>

          <ul data-testid={`${tab}-list`} className="mt-4 space-y-2">
            {activeList.isLoading ? (
              <>
                <FriendCardSkeleton />
                <FriendCardSkeleton />
              </>
            ) : null}
            {(activeList.data ?? []).map((user) => (
              <FriendCard
                key={user.username}
                user={user}
                isFollowing={
                  tab === "following" || followingSet.has(user.username)
                }
                showViewOnMap={
                  tab === "following" || followingSet.has(user.username)
                }
              />
            ))}
            {activeList.data?.length === 0 ? (
              <li className="px-2 py-4 text-sm text-muted">
                {tab === "following"
                  ? "You are not following anyone yet — search above to find friends."
                  : "No followers yet — share your profile to get some."}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </section>
  );
}

function TabButton({
  id,
  active,
  count,
  onSelect,
  children,
}: {
  id: Tab;
  active: boolean;
  count: number | undefined;
  onSelect: (tab: Tab) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`tab-${id}`}
      onClick={() => onSelect(id)}
      className={`min-h-9 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-out max-md:min-h-11 ${
        active ? "bg-surface-strong" : "text-muted hover:bg-surface"
      }`}
    >
      {children}
      {count !== undefined ? ` (${count})` : ""}
    </button>
  );
}

/** The value, trailing-debounced by `delayMs`. */
function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
