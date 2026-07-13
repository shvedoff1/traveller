"use client";

import { MAP_COLORS } from "../../lib/map/map-style";
import { useMapStore } from "../../lib/stores/map-store";

/**
 * Bottom-right legend chip shown while comparing maps with a friend:
 * your color, their color and the overlap color, plus an exit button.
 */
export function CompareLegend({ myName }: { myName: string }) {
  const compareWith = useMapStore((state) => state.compareWith);
  const stopCompare = useMapStore((state) => state.stopCompare);

  if (!compareWith) return null;

  return (
    <div
      data-testid="compare-legend"
      className="absolute bottom-4 right-4 z-30 flex items-center gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs shadow-2xl backdrop-blur-xl"
    >
      <LegendSwatch color={MAP_COLORS.visited} label={myName} />
      <LegendSwatch
        color={MAP_COLORS.friend}
        label={compareWith.displayName}
        testId="compare-friend-name"
      />
      <LegendSwatch color={MAP_COLORS.overlap} label="Both" />
      <button
        type="button"
        aria-label="Exit compare mode"
        data-testid="compare-exit"
        onClick={stopCompare}
        className="text-muted hover:text-foreground"
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
