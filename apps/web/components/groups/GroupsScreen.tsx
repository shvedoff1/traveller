"use client";

import { GROUP_NAME_MAX } from "@traveller/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { pluralize } from "../../lib/groups/format";
import { useCreateGroup, useMyGroups } from "../../lib/groups/use-groups";
import { Skeleton } from "../ui/Skeleton";
import { AuthGate } from "./AuthGate";

/**
 * /groups: my groups (with members + countries-together counts) and a
 * one-field form to start a new one.
 */
export function GroupsScreen() {
  return (
    <AuthGate
      title="Groups"
      loggedOutText="Log in to put your friends' maps together."
    >
      {() => <GroupsList />}
    </AuthGate>
  );
}

function GroupsList() {
  const router = useRouter();
  const groups = useMyGroups(true);
  const create = useCreateGroup();
  const [name, setName] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (group) => {
        setName("");
        router.push(`/groups/${group.id}`);
      },
    });
  }

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-16 pt-20">
      <h1 className="text-xl font-semibold tracking-tight">Groups</h1>
      <p className="mt-1 text-sm text-muted">
        Put your friends’ maps together: where you’ve been as a crew, who’s
        been furthest, what everyone has in common.
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={GROUP_NAME_MAX}
          placeholder="New group name, e.g. “Uni friends”"
          aria-label="New group name"
          data-testid="group-name-input"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-edge bg-surface px-4 text-sm transition-colors duration-200 ease-out placeholder:text-muted focus:border-edge-strong focus:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          data-testid="group-create"
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 ease-out hover:bg-accent-strong disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <ul data-testid="groups-list" className="mt-6 space-y-2">
        {groups.isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : null}
        {(groups.data ?? []).map((group) => (
          <li key={group.id}>
            <Link
              href={`/groups/${group.id}`}
              data-testid={`group-card-${group.id}`}
              className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-4 transition-colors duration-200 ease-out hover:bg-surface-strong"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{group.name}</span>
                <span className="block text-xs text-muted">
                  {pluralize(group.memberCount, "member")}
                  {group.isOwner ? " · you run it" : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold tabular-nums">
                  {group.countryCount}
                </span>
                <span className="block text-[11px] text-muted">
                  countries together
                </span>
              </span>
            </Link>
          </li>
        ))}
        {groups.data?.length === 0 ? (
          <li className="px-2 py-4 text-sm text-muted" data-testid="groups-empty">
            No groups yet — name one above, then share its invite link.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
