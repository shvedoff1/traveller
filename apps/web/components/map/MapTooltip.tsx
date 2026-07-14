"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { type CountryLabel, positionTooltip } from "../../lib/map/tooltip";

/**
 * Small glassmorphism chip that names the hovered country, following the
 * cursor. Positioned absolutely within the map container; pointer-events
 * are off so it never intercepts the pointer. Coordinates are relative to
 * the map container (the tooltip's positioned parent).
 */
export function MapTooltip({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: CountryLabel;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: x,
    top: y,
  });

  // Measure the chip and clamp it inside the container after each move.
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    setPos(
      positionTooltip({
        x,
        y,
        width: el?.offsetWidth ?? 0,
        height: el?.offsetHeight ?? 0,
        viewportWidth: parent?.clientWidth ?? el?.offsetWidth ?? 0,
        viewportHeight: parent?.clientHeight ?? el?.offsetHeight ?? 0,
      }),
    );
  }, [x, y, label.name]);

  return (
    <div
      ref={ref}
      data-testid="map-tooltip"
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-30 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium shadow-2xl backdrop-blur-xl"
      style={{ left: pos.left, top: pos.top }}
    >
      {label.flag ? (
        <span aria-hidden className="text-sm leading-none">
          {label.flag}
        </span>
      ) : null}
      <span data-testid="map-tooltip-name">{label.name}</span>
    </div>
  );
}
