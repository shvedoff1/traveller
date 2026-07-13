"use client";

import { type Projection } from "../../lib/map/projection";

/**
 * Bottom-right icon button toggling the map projection between globe and
 * flat (mercator). Theme-aware glassmorphism, aria-labeled with the action
 * it performs next.
 */
export function ProjectionToggle({
  projection,
  onToggle,
}: {
  projection: Projection;
  onToggle: () => void;
}) {
  const goingFlat = projection === "globe";
  return (
    <button
      type="button"
      data-testid="projection-toggle"
      data-projection={projection}
      aria-label={goingFlat ? "Switch to flat map" : "Switch to globe view"}
      title={goingFlat ? "Flat map" : "Globe view"}
      onClick={onToggle}
      className="absolute bottom-4 right-4 z-30 flex size-10 items-center justify-center rounded-full border border-edge bg-surface text-foreground shadow-2xl backdrop-blur-xl transition-colors duration-200 ease-out hover:bg-surface-strong max-md:size-11"
    >
      {goingFlat ? <FlatIcon /> : <GlobeIcon />}
    </button>
  );
}

/** Shown while on the globe: hints the flat map you'd switch to. */
function FlatIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 10h18M9 5v14M15 5v14" />
    </svg>
  );
}

/** Shown while flat: hints the globe you'd switch to. */
function GlobeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </svg>
  );
}
