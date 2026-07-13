"use client";

import Link from "next/link";
import { useState } from "react";

import { useMapVisits } from "./useMapVisits";

/**
 * Logged-out landing overlay on the home globe: tagline + login CTA.
 * The wrapper ignores pointer events so the idle-rotating globe stays
 * fully explorable (hover, zoom, pan) around the card; "Just explore"
 * dismisses it for the session.
 */
export function LandingHero() {
  const { ready, isLoggedIn } = useMapVisits();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || isLoggedIn || dismissed) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22dvh] z-10 flex justify-center px-4">
      <div
        data-testid="landing-hero"
        className="animate-rise pointer-events-auto max-w-md rounded-2xl border border-edge bg-surface p-6 text-center shadow-2xl backdrop-blur-xl"
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Every country you’ve been, on one globe.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Mark your travels, watch your stats grow and share your map with
          friends.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/login"
            data-testid="landing-cta"
            className="min-h-11 content-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 ease-out hover:bg-accent-strong"
          >
            Start your map
          </Link>
          <button
            type="button"
            data-testid="landing-dismiss"
            onClick={() => setDismissed(true)}
            className="min-h-11 rounded-full px-3 text-sm text-muted transition-colors duration-200 ease-out hover:text-foreground"
          >
            Just explore
          </button>
        </div>
      </div>
    </div>
  );
}
