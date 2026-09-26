"use client";

import { isCountryCode } from "@traveller/shared";
import { useCallback } from "react";

import { useFriendsMap } from "../../lib/social/use-follow";
import { useMapStore } from "../../lib/stores/map-store";
import { CompareLegend } from "./CompareLegend";
import { LoginPrompt } from "./LoginPrompt";
import { MapCanvas } from "./MapCanvas";
import { MapModeToggle } from "./MapModeToggle";
import { useMapVisits } from "./useMapVisits";

/**
 * Wires the map to server + UI state. Clicking a country selects it (the
 * detail card opens); only in edit mode does the click also toggle its
 * visited state through the optimistic mutation — view mode is the
 * default so looking up a name never marks anything by accident.
 * Logged-out visitors get the card with a login CTA. In compare mode a friend's countries
 * (from the friends-map query) overlay mine, with a legend.
 */
export function MapView() {
  const selected = useMapStore((state) => state.selected);
  const highlighted = useMapStore((state) => state.highlighted);
  const flyTo = useMapStore((state) => state.flyTo);
  const compareWith = useMapStore((state) => state.compareWith);
  const setSelected = useMapStore((state) => state.setSelected);
  const setHovered = useMapStore((state) => state.setHovered);
  const showLoginPrompt = useMapStore((state) => state.showLoginPrompt);
  const mode = useMapStore((state) => state.mode);

  const { visited, toggle, ready, isLoggedIn } = useMapVisits();

  const comparing = compareWith !== null && isLoggedIn;
  const { data: friendsMap } = useFriendsMap(comparing);
  const friendVisited = comparing
    ? (friendsMap?.find((entry) => entry.username === compareWith.username)
        ?.countryCodes ?? [])
    : null;

  const handleCountryClick = useCallback(
    (iso: string) => {
      // Ignore geometries outside the canonical list (e.g. Kosovo, which has
      // no official ISO-3166-1 code) — they can't be persisted.
      if (!isCountryCode(iso)) return;
      setSelected(iso);
      if (mode !== "edit") return;
      if (ready && !toggle(iso)) showLoginPrompt();
    },
    [setSelected, mode, ready, toggle, showLoginPrompt],
  );

  return (
    <>
      <MapCanvas
        visited={visited}
        friendVisited={friendVisited}
        selected={selected}
        highlighted={highlighted}
        flyTo={flyTo}
        onCountryClick={handleCountryClick}
        onCountryHover={setHovered}
      />
      {isLoggedIn ? <MapModeToggle /> : null}
      {isLoggedIn && mode === "edit" ? (
        // Edit-mode cue: a soft accent frame around the whole map.
        <div
          aria-hidden
          data-testid="edit-mode-frame"
          className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_0_3px_var(--color-accent)] opacity-60"
        />
      ) : null}
      {comparing ? <CompareLegend myName="You" /> : null}
      <LoginPrompt />
    </>
  );
}
