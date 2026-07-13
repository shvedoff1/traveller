"use client";

import { MAP_PALETTES } from "../../lib/map/map-style";
import { useMapStore } from "../../lib/stores/map-store";
import { useThemeStore } from "../../lib/stores/theme-store";

/**
 * Bottom-right legend chip shown while comparing maps with a friend:
 * your color, their color and the overlap color, plus an exit button.
 */
export function CompareLegend({ myName }: { myName: string }) {
  const compareWith = useMapStore((state) => state.compareWith);
  const stopCompare = useMapStore((state) => state.stopCompare);
  const theme = useThemeStore((state) => state.theme);

  if (!compareWith) return null;

  const palette = MAP_PALETTES[theme];
  return (
    <div
      data-testid="compare-legend"
      className="animate-rise absolute bottom-4 right-4 z-30 flex items-center gap-4 rounded-full border border-edge bg-surface px-4 py-2 text-xs shadow-2xl backdrop-blur-xl"
    >
      <LegendSwatch color={palette.visited} label={myName} />
      <LegendSwatch
        color={palette.friend}
        label={compareWith.displayName}
        testId="compare-friend-name"
      />
      <LegendSwatch color={palette.overlap} label="Both" />
      <button
        type="button"
        aria-label="Exit compare mode"
        data-testid="compare-exit"
        onClick={stopCompare}
        className="rounded-full px-1 text-muted transition-colors duration-200 ease-out hover:text-foreground max-md:min-h-11 max-md:min-w-8"
      >
        ×
      </button>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  testId,
}: {
  color: string;
  label: string;
  testId?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span data-testid={testId} className="max-w-32 truncate">
        {label}
      </span>
    </span>
  );
}
