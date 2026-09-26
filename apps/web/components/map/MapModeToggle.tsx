"use client";

import { useCallback, useEffect } from "react";

import {
  type MapMode,
  isModeShortcut,
  nextMapMode,
  persistMapMode,
  readMapMode,
} from "../../lib/map/map-mode";
import { useMapStore } from "../../lib/stores/map-store";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * View / Edit segmented switch over the map. View (default) makes a click
 * just show the country; Edit makes a click toggle it visited. Restores
 * the saved mode on mount and flips on the `E` key.
 */
export function MapModeToggle() {
  const mode = useMapStore((state) => state.mode);
  const setMode = useMapStore((state) => state.setMode);

  const choose = useCallback(
    (next: MapMode) => {
      setMode(next);
      persistMapMode(browserStorage(), next);
    },
    [setMode],
  );

  // Restore after mount (storage is browser-only, keeps hydration clean).
  useEffect(() => {
    setMode(readMapMode(browserStorage()));
  }, [setMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModeShortcut(event)) return;
      choose(nextMapMode(useMapStore.getState().mode));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [choose]);

  return (
    <div
      role="radiogroup"
      aria-label="Map mode"
      data-testid="map-mode-toggle"
      data-mode={mode}
      className="absolute z-20 flex gap-1 rounded-full border border-edge bg-surface p-1 text-sm shadow-2xl backdrop-blur-xl max-md:bottom-4 max-md:left-4 md:left-1/2 md:top-4 md:-translate-x-1/2"
    >
      <ModeButton
        active={mode === "view"}
        onClick={() => choose("view")}
        testId="map-mode-view"
        title="View — tap a country to see it (E)"
      >
        <EyeIcon />
        View
      </ModeButton>
      <ModeButton
        active={mode === "edit"}
        onClick={() => choose("edit")}
        testId="map-mode-edit"
        title="Edit — tap a country to mark or unmark it (E)"
        accent
      >
        <PencilIcon />
        Edit
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  testId,
  title,
  accent = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const activeClass = accent
    ? "bg-accent text-on-accent"
    : "bg-surface-strong text-foreground";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={testId}
      title={title}
      onClick={onClick}
      className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 font-medium transition-colors duration-200 ease-out max-md:min-h-11 ${
        active ? activeClass : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
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
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
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
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
