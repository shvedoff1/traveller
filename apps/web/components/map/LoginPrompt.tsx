"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useMapStore } from "../../lib/stores/map-store";

const AUTO_HIDE_MS = 6000;

/**
 * Subtle bottom-center toast shown when a logged-out visitor tries to
 * mark a country. Auto-hides; the CTA links to the login page.
 */
export function LoginPrompt() {
  const visible = useMapStore((state) => state.loginPromptVisible);
  const hide = useMapStore((state) => state.hideLoginPrompt);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(hide, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [visible, hide]);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="login-prompt"
      className="animate-rise absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-edge bg-surface px-4 py-2 text-sm shadow-2xl backdrop-blur-xl max-md:w-[calc(100vw-2rem)] max-md:justify-between"
    >
      <span>Log in to save the countries you’ve visited</span>
      <Link
        href="/login"
        className="rounded-full bg-surface-strong px-3 py-1 font-medium transition-colors duration-200 ease-out hover:bg-edge-strong max-md:min-h-9 max-md:content-center"
        onClick={hide}
      >
        Log in
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={hide}
        className="rounded-full px-1 text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11 max-md:min-w-8"
      >
        ×
      </button>
    </div>
  );
}
