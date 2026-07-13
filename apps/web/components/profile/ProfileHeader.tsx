"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "../../lib/api-client";

const COPIED_TOAST_MS = 2000;

/**
 * Floating profile card: avatar, display name, @username and a share
 * button that copies the public URL (with a subtle toast). When the
 * logged-in viewer is the owner, an "Edit your map" link points home;
 * everyone else sees the follow placeholder (wired up in task 05).
 */
export function ProfileHeader({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const isOwner = me?.username === username;

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — no toast.
    }
  }

  return (
    <section
      aria-label="Profile"
      data-testid="profile-header"
      className="absolute left-4 top-16 z-20 w-72 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-white/15 text-lg font-semibold uppercase"
          >
            {displayName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h1
            className="truncate text-lg font-semibold tracking-tight"
            data-testid="profile-name"
          >
            {displayName}
          </h1>
          <p className="truncate text-sm text-muted" data-testid="profile-username">
            @{username}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={share}
          data-testid="share-button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          Share
        </button>
        {isOwner ? (
          <Link
            href="/"
            data-testid="edit-map-link"
            className="rounded-full px-3 py-1.5 text-sm text-muted underline-offset-4 hover:underline"
          >
            Edit your map →
          </Link>
        ) : (
          // Placeholder until following ships (task 05).
          <button
            type="button"
            disabled
            title="Coming soon"
            data-testid="follow-button"
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-muted opacity-60"
          >
            Follow
          </button>
        )}
      </div>

      {copied ? (
        <p
          role="status"
          data-testid="share-toast"
          className="mt-3 text-xs text-muted"
        >
          Link copied to clipboard
        </p>
      ) : null}
    </section>
  );
}
