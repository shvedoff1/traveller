"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError } from "../../lib/api-client";
import { pluralize } from "../../lib/groups/format";
import { useGroupInvite, useJoinGroup } from "../../lib/groups/use-groups";
import { Skeleton } from "../ui/Skeleton";
import { AuthGate } from "./AuthGate";

/** /join/:code — invite landing: what the group is, and a Join button. */
export function JoinGroupScreen({ code }: { code: string }) {
  return (
    <AuthGate
      title="Join a group"
      loggedOutText="Log in, then open this invite link again to join."
    >
      {() => <JoinCard code={code} />}
    </AuthGate>
  );
}

function JoinCard({ code }: { code: string }) {
  const router = useRouter();
  const invite = useGroupInvite(code, true);
  const join = useJoinGroup(code);

  const card =
    "mx-auto mt-24 w-full max-w-md rounded-2xl border border-edge bg-surface p-6 text-center";

  if (invite.isLoading) {
    return (
      <section aria-busy="true" className={card}>
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="mx-auto mt-3 h-4 w-56" />
      </section>
    );
  }

  if (!invite.data) {
    const missing =
      invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <section className={card} data-testid="invite-missing">
        <h1 className="text-lg font-semibold">
          {missing ? "This invite doesn’t work" : "Couldn’t open the invite"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {missing
            ? "The link may have been reset. Ask for a fresh one."
            : "Check your connection and try again."}
        </p>
      </section>
    );
  }

  const group = invite.data;
  return (
    <section className={card} data-testid="invite-card">
      <p className="text-xs uppercase tracking-wide text-muted">
        {group.ownerDisplayName} invites you to
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {group.name}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {pluralize(group.memberCount, "member")} · your map joins theirs
      </p>
      {group.isMember ? (
        <Link
          href={`/groups/${group.id}`}
          data-testid="invite-open"
          className="mt-5 inline-block min-h-11 content-center rounded-full bg-surface-strong px-5 text-sm font-medium"
        >
          You’re in — open the group
        </Link>
      ) : (
        <button
          type="button"
          data-testid="invite-join"
          disabled={join.isPending}
          onClick={() =>
            join.mutate(undefined, {
              onSuccess: ({ id }) => router.push(`/groups/${id}`),
            })
          }
          className="mt-5 min-h-11 rounded-full bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 ease-out hover:bg-accent-strong disabled:opacity-50"
        >
          Join group
        </button>
      )}
    </section>
  );
}
