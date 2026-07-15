"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "../../lib/api-client";
import { pushSuccessToast } from "../../lib/stores/toast-store";
import { FollowButton } from "../social/FollowButton";
import { ProfileEditForm } from "./ProfileEditForm";

const COPIED_TOAST_MS = 2000;

/**
 * Floating profile card: avatar, display name, @username and a share
 * button that copies the public URL (with a subtle toast). When the
 * logged-in viewer is the owner, a pencil reveals an inline editor for the
 * display name and username (no trip to /settings); everyone else sees the
 * follow button (login CTA when logged out).
 */
export function ProfileHeader({
  username,
  displayName,
  avatarUrl,
  countryCount = 0,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  countryCount?: number;
}) {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const isOwner = me?.username === username;

  // Local mirror of the server-rendered identity so an inline edit reflects
  // instantly, before the revalidated page reaches us on the next navigation.
  const [name, setName] = useState(displayName);
  const [handle, setHandle] = useState(username);
  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => setHandle(username), [username]);

  const [editing, setEditing] = useState(false);

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
      className="animate-rise absolute left-4 top-16 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-edge bg-surface p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-strong text-lg font-semibold uppercase"
          >
            {name.slice(0, 1)}
          </span>
        )}
        {editing ? (
          <div className="min-w-0 flex-1">
            <ProfileEditForm
              current={{ displayName: name, username: handle }}
              onSaved={(updated) => {
                setName(updated.displayName);
                pushSuccessToast("Profile updated.");
                setEditing(false);
                if (updated.username && updated.username !== handle) {
                  // The handle changed → this URL is stale; go to the new one.
                  router.replace(`/${updated.username}`);
                } else {
                  router.refresh();
                }
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-1">
            <div className="min-w-0">
              <h1
                className="truncate text-lg font-semibold tracking-tight"
                data-testid="profile-name"
              >
                {name}
              </h1>
              <p
                className="truncate text-sm text-muted"
                data-testid="profile-username"
              >
                @{handle}
              </p>
            </div>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit name and username"
                data-testid="profile-edit-button"
                className="ml-auto shrink-0 rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:bg-surface-strong hover:text-foreground"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {editing ? null : (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            data-testid="share-button"
            className="rounded-full bg-surface-strong px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong max-md:min-h-11"
          >
            Share
          </button>
          {isOwner ? (
            <Link
              href="/"
              data-testid="edit-map-link"
              className="rounded-full px-3 py-1.5 text-sm text-muted underline-offset-4 transition-colors duration-200 ease-out hover:text-foreground hover:underline max-md:min-h-11 max-md:content-center"
            >
              Edit your map →
            </Link>
          ) : (
            <FollowButton
              user={{ username: handle, displayName: name, avatarUrl, countryCount }}
            />
          )}
        </div>
      )}

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
