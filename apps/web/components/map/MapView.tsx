"use client";

import { isCountryCode } from "@traveller/shared";
import { useCallback } from "react";

import { useMapStore } from "../../lib/stores/map-store";
import { LoginPrompt } from "./LoginPrompt";
import { MapCanvas } from "./MapCanvas";
import { useMapVisits } from "./useMapVisits";

/**
 * Wires the map to server + UI state: clicking a country selects it and
 * toggles its visited state through the optimistic mutation; logged-out
 * visitors get a login CTA instead.
 */
export function MapView() {
  const selected = useMapStore((state) => state.selected);
  const highlighted = useMapStore((state) => state.highlighted);
  const flyTo = useMapStore((state) => state.flyTo);
  const setSelected = useMapStore((state) => state.setSelected);
  const setHovered = useMapStore((state) => state.setHovered);
  const showLoginPrompt = useMapStore((state) => state.showLoginPrompt);

  const { visited, toggle, ready } = useMapVisits();

  const handleCountryClick = useCallback(
    (iso: string) => {
      // Ignore geometries outside the canonical list (e.g. Kosovo, which has
      // no official ISO-3166-1 code) — they can't be persisted.
      if (!isCountryCode(iso)) return;
      setSelected(iso);
      if (ready && !toggle(iso)) showLoginPrompt();
    },
    [setSelected, ready, toggle, showLoginPrompt],
  );

  return (
    <>
      <MapCanvas
        visited={visited}
        selected={selected}
        highlighted={highlighted}
        flyTo={flyTo}
        onCountryClick={handleCountryClick}
        onCountryHover={setHovered}
      />
      <LoginPrompt />
    </>
  );
}
