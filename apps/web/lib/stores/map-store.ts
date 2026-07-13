import { COUNTRY_CENTROIDS } from "@traveller/shared";
import { create } from "zustand";

/** A one-shot camera request; `id` re-triggers repeats to the same target. */
export interface FlyToTarget {
  center: [lng: number, lat: number];
  zoom: number;
  id: number;
}

/**
 * UI state for the map. Visited countries are server state and live in
 * the `['visits','me']` TanStack Query cache (see useMapVisits) — this
 * store only holds ephemeral interaction state.
 */
export interface MapStoreState {
  /** Country whose detail sheet is open. */
  selected: string | null;
  /** Country under the mouse cursor on the map. */
  hovered: string | null;
  /** Country highlighted from the panel (row hover). */
  highlighted: string | null;
  /** Pending camera move, consumed by MapCanvas. */
  flyTo: FlyToTarget | null;
  /** Login CTA after a logged-out visitor tries to mark a country. */
  loginPromptVisible: boolean;
  setSelected: (iso: string | null) => void;
  setHovered: (iso: string | null) => void;
  setHighlighted: (iso: string | null) => void;
  /** Fly the camera to a country's centroid (no-op for unknown codes). */
  flyToCountry: (iso: string) => void;
  showLoginPrompt: () => void;
  hideLoginPrompt: () => void;
}

let nextFlyToId = 1;

export const useMapStore = create<MapStoreState>((set) => ({
  selected: null,
  hovered: null,
  highlighted: null,
  flyTo: null,
  loginPromptVisible: false,
  setSelected: (iso) => set({ selected: iso }),
  setHovered: (iso) => set({ hovered: iso }),
  setHighlighted: (iso) => set({ highlighted: iso }),
  flyToCountry: (iso) => {
    const centroid = COUNTRY_CENTROIDS[iso];
    if (!centroid) return;
    const [lng, lat, zoom] = centroid;
    set({ flyTo: { center: [lng, lat], zoom, id: nextFlyToId++ } });
  },
  showLoginPrompt: () => set({ loginPromptVisible: true }),
  hideLoginPrompt: () => set({ loginPromptVisible: false }),
}));
