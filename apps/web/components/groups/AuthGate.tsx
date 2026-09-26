"use client";

import { useQuery } from "@tanstack/react-query";
import { type MeResponse } from "@traveller/shared";
import Link from "next/link";
import { type ReactNode } from "react";

import { api } from "../../lib/api-client";
import { Skeleton } from "../ui/Skeleton";

/**
 * Renders `children(me)` for a logged-in user with a claimed handle;
 * otherwise a login (or claim-a-username) card. Groups show your handle,
 * so both are required.
 */
export function AuthGate({
  title,
  loggedOutText,
  children,
}: {
  title: string;
  loggedOutText: string;
  children: (me: MeResponse) => ReactNode;
}) {
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
  });

  if (isLoading) {
    return (
      <section
        aria-busy="true"
        data-testid="groups-skeleton"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-16 pt-20"
      >
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </section>
    );
  }

  if (!me || !me.username) {
    return (
      <section className="mx-auto mt-24 w-full max-w-md rounded-2xl border border-edge bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {me ? "Pick a username first — groups show it." : loggedOutText}
        </p>
        <Link
          href={me ? "/welcome" : "/login"}
          data-testid="groups-login-cta"
          className="mt-4 inline-block rounded-full bg-surface-strong px-4 py-1.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-edge-strong"
        >
          {me ? "Pick a username" : "Log in"}
        </Link>
      </section>
    );
  }

  return <>{children(me)}</>;
}
