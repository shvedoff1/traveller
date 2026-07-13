"use client";

import { useThemeStore } from "../lib/stores/theme-store";

/**
 * Sun/moon theme switch. The visible icon is driven purely by CSS
 * (`data-theme` on <html> via the `light:` variant), so the server-rendered
 * markup never mismatches whatever theme the pre-paint script applied.
 */
export function ThemeToggle() {
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-background/70 text-muted backdrop-blur transition-colors duration-200 ease-out hover:text-foreground max-md:size-11"
    >
      {/* Sun — shown in dark mode (click for light). */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="size-4.5 light:hidden"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
      </svg>
      {/* Moon — shown in light mode (click for dark). */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden size-4.5 light:block"
      >
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>
    </button>
  );
}
