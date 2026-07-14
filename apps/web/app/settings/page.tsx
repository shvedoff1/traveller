"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { SettingsForm } from "../../components/settings/SettingsForm";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api-client";

/**
 * Edit-profile settings. Auth-required — logged-out visitors get a login
 * CTA (client-gated on the cookie-backed `['me']` query).
 */
export default function SettingsPage() {
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  return (
    <main className="flex min-h-dvh w-full items-start justify-center px-6 pt-24">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        {isLoading ? (
          <div className="mt-6 space-y-5" data-testid="settings-skeleton">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : me ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Update how you appear across Traveller.
            </p>
            <SettingsForm me={me} />
          </>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted">
              Log in to edit your profile.
            </p>
            <Link
              href="/login"
              data-testid="settings-login-cta"
              className="inline-block rounded-full bg-surface-strong px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
