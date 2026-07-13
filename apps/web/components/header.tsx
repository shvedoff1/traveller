"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../lib/api-client";

/**
 * Floating site header: wordmark plus login link or the logged-in user chip.
 * It overlays the page (the map underneath stays interactive around it).
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
        className="pointer-events-auto rounded-full bg-background/70 px-4 py-1.5 font-semibold tracking-tight backdrop-blur"
      >
        Traveller
      </Link>

      {isLoading ? null : (
        <div className="pointer-events-auto rounded-full bg-background/70 px-4 py-1.5 backdrop-blur">
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

  return (
    <div className="flex items-center gap-3" data-testid="user-chip">
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
          className="flex size-7 items-center justify-center rounded-full bg-white/15 text-xs font-semibold uppercase"
        >
          {(username ?? displayName).slice(0, 1)}
        </span>
      )}
      <span className="text-sm">{username ? `@${username}` : displayName}</span>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="text-sm text-muted underline-offset-4 hover:underline disabled:opacity-50"
      >
        Log out
      </button>
    </div>
  );
}
