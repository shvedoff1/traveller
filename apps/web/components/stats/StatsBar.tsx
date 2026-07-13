"use client";

import { useMemo } from "react";

import { computeStats } from "../../lib/stats";
import { useMapVisits } from "../map/useMapVisits";
import { StatsPanel } from "./StatsPanel";

/**
 * Floating bottom-left stats for the viewer's own map. Recomputes from
 * the optimistic visits cache, so it updates instantly on toggle.
 */
export function StatsBar() {
  const { visited } = useMapVisits();
  const stats = useMemo(() => computeStats(visited), [visited]);

  // Mobile: top-left under the header (the bottom edge belongs to the
  // search pill / bottom sheet); desktop: bottom-left.
  return (
    <StatsPanel
      stats={stats}
      className="absolute left-4 z-20 max-md:top-16 md:bottom-4"
    />
  );
}
