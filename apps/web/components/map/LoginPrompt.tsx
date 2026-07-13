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
      className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm shadow-2xl backdrop-blur-xl"
    >
      <span>Log in to save the countries you’ve visited</span>
      <Link
        href="/login"
        className="rounded-full bg-white/10 px-3 py-1 font-medium hover:bg-white/20"
        onClick={hide}
      >
        Log in
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={hide}
        className="text-muted hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
