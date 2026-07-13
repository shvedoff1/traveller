"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../lib/api-client";

/** Site header: wordmark plus login link or the logged-in user chip. */
export function Header() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
      <Link href="/" className="font-semibold tracking-tight">
        Traveller
      </Link>

      {isLoading ? null : me ? (
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
