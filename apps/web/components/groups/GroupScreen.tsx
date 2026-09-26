"use client";

import {
  CONTINENTS,
  GROUP_NAME_MAX,
  type GroupDetail,
  type GroupMember,
  type MeResponse,
} from "@traveller/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { ApiError } from "../../lib/api-client";
import {
  countryByCode,
  groupMapLayers,
  inviteUrl,
  pluralize,
} from "../../lib/groups/format";
import {
  useAddGroupMember,
  useDeleteGroup,
  useGroup,
  useRemoveGroupMember,
  useRenameGroup,
  useRotateInvite,
} from "../../lib/groups/use-groups";
import { MAP_PALETTES } from "../../lib/map/map-style";
import { useFollowing } from "../../lib/social/use-follow";
import { useThemeStore } from "../../lib/stores/theme-store";
import { MapCanvas } from "../map/MapCanvas";
import { Skeleton } from "../ui/Skeleton";
import { AuthGate } from "./AuthGate";
import { Avatar } from "./Avatar";

/**
 * /groups/:id — the group's combined map and stats: headline numbers,
 * a leaderboard (click someone to light up their countries on the map),
 * what everyone has in common, the most popular countries and per-
 * continent coverage. Owners also rename, invite, add/remove and delete.
 */
export function GroupScreen({ id }: { id: string }) {
  return (
    <AuthGate title="Group" loggedOutText="Log in to see this group.">
      {(me) => <GroupContent id={id} me={me} />}
    </AuthGate>
  );
}

function GroupContent({ id, me }: { id: string; me: MeResponse }) {
  const group = useGroup(id, true);

  if (group.isLoading) {
    return (
      <section
        aria-busy="true"
        data-testid="group-skeleton"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-20"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-[40dvh] w-full rounded-2xl" />
      </section>
    );
  }

  if (!group.data) {
    const missing =
      group.error instanceof ApiError && group.error.status === 404;
    return (
      <section
        data-testid="group-missing"
        className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-edge bg-surface p-6 text-center"
      >
        <h1 className="text-lg font-semibold">
          {missing ? "Group not found" : "Couldn’t load the group"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {missing
            ? "It may have been deleted, or you’re not in it."
            : "Check your connection and try again."}
        </p>
        <Link
          href="/groups"
          className="mt-4 inline-block rounded-full bg-surface-strong px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong"
        >
          Your groups
        </Link>
      </section>
    );
  }

  return <GroupView group={group.data} me={me} />;
}

function GroupView({ group, me }: { group: GroupDetail; me: MeResponse }) {
  const [focused, setFocused] = useState<string | null>(null);
  const layers = groupMapLayers(group, focused);
  const theme = useThemeStore((state) => state.theme);
  const palette = MAP_PALETTES[theme];
  const { stats, members } = group;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-20">
      <Link
        href="/groups"
        className="text-sm text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-foreground hover:underline"
      >
        ← Groups
      </Link>
      <GroupTitle group={group} />

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="countries together"
          value={stats.countryCount}
          testId="group-stat-countries"
        />
        <StatTile
          label="of the world"
          value={`${stats.worldPercent}%`}
          testId="group-stat-percent"
        />
        <StatTile
          label="everyone’s been"
          value={members.length >= 2 ? stats.sharedCodes.length : "—"}
          testId="group-stat-shared"
        />
        <StatTile
          label="average each"
          value={stats.averageCount}
          testId="group-stat-average"
        />
      </dl>

      <div className="relative mt-4 h-[42dvh] min-h-72 overflow-hidden rounded-2xl border border-edge">
        <MapCanvas
          visited={layers.visited}
          friendVisited={layers.highlight}
          selected={null}
          readonly
        />
        <div
          data-testid="group-map-legend"
          className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs shadow-2xl backdrop-blur-xl"
        >
          <Swatch color={palette.visited} label="Someone’s been" />
          <Swatch color={palette.overlap} label={layers.highlightLabel} />
          {focused ? (
            <button
              type="button"
              aria-label="Show everyone"
              data-testid="group-map-unfocus"
              onClick={() => setFocused(null)}
              className="px-1 text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-9"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[3fr_2fr]">
        <Leaderboard
          group={group}
          meUsername={me.username}
          focused={focused}
          onFocus={(username) =>
            setFocused((current) => (current === username ? null : username))
          }
        />
        <div className="space-y-6">
          <CountryChips
            title="Everyone’s been"
            codes={members.length >= 2 ? stats.sharedCodes : []}
            empty={
              members.length < 2
                ? "Invite someone to see what you have in common."
                : "No country all of you have visited — yet."
            }
            testId="group-shared"
          />
          <Popular group={group} />
          <Continents continents={stats.continents} />
        </div>
      </div>

      <Invite group={group} />
      {group.isOwner ? <AddFromFollowing group={group} /> : null}
      <DangerZone group={group} meUsername={me.username} />
    </section>
  );
}

function GroupTitle({ group }: { group: GroupDetail }) {
  const rename = useRenameGroup(group.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const owner = group.members.find((member) => member.isOwner);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setEditing(false);
      return;
    }
    rename.mutate(trimmed, { onSuccess: () => setEditing(false) });
  }

  return (
    <header className="mt-3">
      {editing ? (
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={GROUP_NAME_MAX}
            aria-label="Group name"
            data-testid="group-rename-input"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-edge-strong bg-transparent px-3 text-lg font-semibold outline-none"
          />
          <button
            type="submit"
            data-testid="group-rename-save"
            disabled={rename.isPending}
            className="rounded-full bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(group.name);
              setEditing(false);
            }}
            className="px-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <h1
            className="truncate text-2xl font-semibold tracking-tight"
            data-testid="group-name"
          >
            {group.name}
          </h1>
          {group.isOwner ? (
            <button
              type="button"
              aria-label="Rename group"
              data-testid="group-rename"
              onClick={() => setEditing(true)}
              className="rounded-full p-1.5 text-muted transition-colors duration-200 ease-out hover:bg-surface-strong hover:text-foreground max-md:min-h-11 max-md:min-w-11"
            >
              ✎
            </button>
          ) : null}
        </div>
      )}
      <p className="mt-1 text-sm text-muted">
        {pluralize(group.members.length, "member")}
        {owner ? ` · run by ${owner.displayName}` : ""}
      </p>
    </header>
  );
}

function StatTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-3">
      <dd
        className="text-2xl font-semibold tabular-nums"
        data-testid={testId}
      >
        {value}
      </dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="max-w-32 truncate">{label}</span>
    </span>
  );
}

function Leaderboard({
  group,
  meUsername,
  focused,
  onFocus,
}: {
  group: GroupDetail;
  meUsername: string | null;
  focused: string | null;
  onFocus: (username: string) => void;
}) {
  const remove = useRemoveGroupMember(group.id);
  const top = Math.max(1, ...group.members.map((m) => m.countryCount));

  return (
    <section aria-labelledby="leaderboard-heading">
      <h2
        id="leaderboard-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Who’s been where
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Tap someone to light up their countries on the map.
      </p>
      <ol className="mt-3 space-y-1" data-testid="group-leaderboard">
        {group.members.map((member, index) => (
          <MemberRow
            key={member.username}
            member={member}
            rank={index + 1}
            top={top}
            isMe={member.username === meUsername}
            focused={focused === member.username}
            canRemove={group.isOwner && !member.isOwner}
            onFocus={() => onFocus(member.username)}
            onRemove={() => {
              if (window.confirm(`Remove ${member.displayName} from the group?`)) {
                remove.mutate(member.username);
              }
            }}
          />
        ))}
      </ol>
    </section>
  );
}

function MemberRow({
  member,
  rank,
  top,
  isMe,
  focused,
  canRemove,
  onFocus,
  onRemove,
}: {
  member: GroupMember;
  rank: number;
  top: number;
  isMe: boolean;
  focused: boolean;
  canRemove: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      data-testid={`group-member-${member.username}`}
      className={`flex items-center gap-2 rounded-xl pr-1 transition-colors duration-200 ease-out ${
        focused ? "bg-surface-strong" : "hover:bg-surface"
      }`}
    >
      <button
        type="button"
        aria-pressed={focused}
        data-testid={`group-member-focus-${member.username}`}
        onClick={onFocus}
        className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left max-md:min-h-11"
      >
        <span className="w-5 text-right text-xs tabular-nums text-muted">
          {rank}
        </span>
        <Avatar name={member.displayName} url={member.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="truncate font-medium">{member.displayName}</span>
            {isMe ? <span className="text-xs text-muted">(you)</span> : null}
            {member.isOwner ? (
              <span className="rounded-full bg-surface-strong px-1.5 text-[10px] uppercase tracking-wide text-muted">
                owner
              </span>
            ) : null}
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-strong">
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${(member.countryCount / top) * 100}%` }}
            />
          </span>
        </span>
        <span className="w-16 text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {member.countryCount}
          </span>
          {member.uniqueCount > 0 ? (
            <span
              className="block text-[10px] text-muted"
              title="Countries nobody else in the group has visited"
            >
              {member.uniqueCount} only them
            </span>
          ) : null}
        </span>
      </button>
      <Link
        href={`/${member.username}`}
        aria-label={`${member.displayName}’s profile`}
        className="rounded-full px-1.5 text-xs text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11 max-md:content-center"
      >
        ↗
      </Link>
      {canRemove ? (
        <button
          type="button"
          aria-label={`Remove ${member.displayName}`}
          data-testid={`group-member-remove-${member.username}`}
          onClick={onRemove}
          className="rounded-full px-1.5 text-muted transition-colors duration-200 ease-out hover:text-danger max-md:min-h-11 max-md:min-w-8"
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

function CountryChips({
  title,
  codes,
  empty,
  testId,
}: {
  title: string;
  codes: readonly string[];
  empty: string;
  testId: string;
}) {
  return (
    <section data-testid={testId}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {codes.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {codes.map((code) => {
            const country = countryByCode(code);
            return (
              <li
                key={code}
                className="rounded-full border border-edge bg-surface px-2.5 py-1 text-xs"
              >
                <span aria-hidden className="mr-1">
                  {country?.emoji}
                </span>
                {country?.name ?? code}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Popular({ group }: { group: GroupDetail }) {
  if (group.members.length < 2) return null;
  return (
    <section data-testid="group-popular">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Most visited
      </h2>
      {group.stats.popular.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No country has two visitors yet.
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {group.stats.popular.map(({ code, count }) => {
            const country = countryByCode(code);
            return (
              <li key={code} className="flex items-center gap-2 text-sm">
                <span aria-hidden>{country?.emoji}</span>
                <span className="min-w-0 flex-1 truncate">
                  {country?.name ?? code}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {count}/{group.members.length}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Continents({
  continents,
}: {
  continents: GroupDetail["stats"]["continents"];
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        By continent
      </h2>
      <ul className="mt-2 space-y-1.5" data-testid="group-continents">
        {CONTINENTS.map((continent) => {
          const entry = continents[continent];
          if (!entry || entry.total === 0) return null;
          return (
            <li key={continent} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-muted">{continent}</span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(entry.visited / entry.total) * 100}%` }}
                />
              </span>
              <span className="w-12 text-right tabular-nums text-muted">
                {entry.visited}/{entry.total}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Invite({ group }: { group: GroupDetail }) {
  const rotate = useRotateInvite(group.id);
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(
    typeof window === "undefined" ? "" : window.location.origin,
    group.inviteCode,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is selectable in the field.
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-edge bg-surface p-4">
      <h2 className="text-sm font-semibold">Invite friends</h2>
      <p className="mt-0.5 text-xs text-muted">
        Anyone with this link can join after logging in.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          data-testid="group-invite-link"
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-edge bg-transparent px-3 text-sm text-muted outline-none"
        />
        <button
          type="button"
          data-testid="group-invite-copy"
          onClick={() => void copy()}
          className="min-h-10 rounded-full bg-surface-strong px-4 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {group.isOwner ? (
        <button
          type="button"
          data-testid="group-invite-rotate"
          disabled={rotate.isPending}
          onClick={() => rotate.mutate()}
          className="mt-2 text-xs text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-foreground hover:underline disabled:opacity-50"
        >
          Reset link (the old one stops working)
        </button>
      ) : null}
    </section>
  );
}

function AddFromFollowing({ group }: { group: GroupDetail }) {
  const following = useFollowing(true);
  const add = useAddGroupMember(group.id);
  const candidates = useMemo(() => {
    const inGroup = new Set(group.members.map((member) => member.username));
    return (following.data ?? []).filter(
      (user) => !inGroup.has(user.username),
    );
  }, [following.data, group.members]);

  if (following.isLoading || (following.data ?? []).length === 0) return null;

  return (
    <section
      className="mt-4 rounded-2xl border border-edge bg-surface p-4"
      data-testid="group-add-following"
    >
      <h2 className="text-sm font-semibold">Add people you follow</h2>
      {candidates.length === 0 ? (
        <p className="mt-1 text-xs text-muted">
          Everyone you follow is already here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {candidates.map((user) => (
            <li key={user.username}>
              <button
                type="button"
                data-testid={`group-add-${user.username}`}
                disabled={add.isPending}
                onClick={() => add.mutate(user.username)}
                className="flex min-h-9 items-center gap-2 rounded-full border border-edge py-1 pl-1 pr-3 text-sm transition-colors duration-200 ease-out hover:border-edge-strong disabled:opacity-50 max-md:min-h-11"
              >
                <Avatar
                  name={user.displayName}
                  url={user.avatarUrl}
                  className="size-7 text-xs"
                />
                {user.displayName}
                <span aria-hidden className="text-muted">
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DangerZone({
  group,
  meUsername,
}: {
  group: GroupDetail;
  meUsername: string | null;
}) {
  const router = useRouter();
  const remove = useDeleteGroup(group.id);
  const leave = useRemoveGroupMember(group.id);

  return (
    <div className="mt-8 flex justify-end">
      {group.isOwner ? (
        <button
          type="button"
          data-testid="group-delete"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete “${group.name}” for everyone?`)) {
              remove.mutate(undefined, {
                onSuccess: () => router.push("/groups"),
              });
            }
          }}
          className="text-sm text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-danger hover:underline disabled:opacity-50"
        >
          Delete group
        </button>
      ) : meUsername ? (
        <button
          type="button"
          data-testid="group-leave"
          disabled={leave.isPending}
          onClick={() => {
            if (window.confirm(`Leave “${group.name}”?`)) {
              leave.mutate(meUsername, {
                onSuccess: () => router.push("/groups"),
              });
            }
          }}
          className="text-sm text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-danger hover:underline disabled:opacity-50"
        >
          Leave group
        </button>
      ) : null}
    </div>
  );
}
