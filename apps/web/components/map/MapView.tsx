"use client";

import { isCountryCode } from "@traveller/shared";
import { useCallback } from "react";

import { useMapStore } from "../../lib/stores/map-store";
import { MapCanvas } from "./MapCanvas";

/**
 * Wires the map to the UI store: clicking a country selects it and toggles
 * it in the session-local visited set (real persistence lands in task 03).
 */
export function MapView() {
  const visited = useMapStore((state) => state.visited);
  const selected = useMapStore((state) => state.selected);
  const setSelected = useMapStore((state) => state.setSelected);
  const setHovered = useMapStore((state) => state.setHovered);
  const toggleVisited = useMapStore((state) => state.toggleVisited);

  const handleCountryClick = useCallback(
    (iso: string) => {
      // Ignore geometries outside the canonical list (e.g. Kosovo, which has
      // no official ISO-3166-1 code) — they can't be persisted later.
      if (!isCountryCode(iso)) return;
      setSelected(iso);
      toggleVisited(iso);
    },
    [setSelected, toggleVisited],
  );

  return (
    <MapCanvas
      visited={visited}
      selected={selected}
      onCountryClick={handleCountryClick}
      onCountryHover={setHovered}
    />
  );
}
