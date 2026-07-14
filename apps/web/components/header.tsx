"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../lib/api-client";
import { ThemeToggle } from "./theme-toggle";

/**
 * Floating site header: wordmark plus theme toggle and login link or the
 * logged-in user chip. It overlays the page (the map underneath stays
 * interactive around it).
 */
export function Header() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
      <Link
        href="/"
        className="pointer-events-auto flex min-h-9 items-center rounded-full bg-background/70 px-4 font-semibold tracking-tight backdrop-blur max-md:min-h-11"
      >
        Traveller
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {isLoading ? null : (
          <div className="pointer-events-auto flex min-h-9 items-center rounded-full bg-background/70 px-4 backdrop-blur max-md:min-h-11">
            {me ? (
              <UserChip
                displayName={me.displayName}
                username={me.username}
                avatarUrl={me.avatarUrl}
                onLoggedOut={() => {
                  queryClient.setQueryData(["me"], null);
                  router.push("/");
                }}
              />
            ) : (
              <Link
                href="/login"
                className="text-sm underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function UserChip({
  displayName,
  username,
  avatarUrl,
  onLoggedOut,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  onLoggedOut: () => void;
}) {
  const logout = useMutation({ mutationFn: api.logout, onSuccess: onLoggedOut });

  // Your name/avatar links to your public profile once a username is claimed;
  // before that, /welcome is where you claim one.
  const profileHref = username ? `/${username}` : "/welcome";

  return (
    <div className="flex items-center gap-3" data-testid="user-chip">
      <Link
        href="/friends"
        data-testid="friends-link"
        className="text-sm underline-offset-4 hover:underline"
      >
        Friends
      </Link>
      <Link
        href={profileHref}
        data-testid="profile-link"
        aria-label="Your profile"
        className="flex items-center gap-3 rounded-full underline-offset-4 hover:underline"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold uppercase"
          >
            {(username ?? displayName).slice(0, 1)}
          </span>
        )}
        <span className="max-w-40 truncate text-sm max-md:hidden">
          {username ? `@${username}` : displayName}
        </span>
      </Link>
      <Link
        href="/settings"
        data-testid="settings-link"
        aria-label="Settings"
        title="Settings"
        className="flex items-center text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11 max-md:min-w-8 max-md:justify-center"
      >
        <GearIcon />
      </Link>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="text-sm text-muted underline-offset-4 transition-colors duration-200 ease-out hover:underline disabled:opacity-50"
      >
        Log out
      </button>
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
