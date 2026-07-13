import { create } from "zustand";

/**
 * UI state for the map. `visited` is a session-local stand-in until task 03
 * wires real persistence through the API.
 */
export interface MapStoreState {
  selected: string | null;
  hovered: string | null;
  visited: string[];
  setSelected: (iso: string | null) => void;
  setHovered: (iso: string | null) => void;
  toggleVisited: (iso: string) => void;
}

export const useMapStore = create<MapStoreState>((set) => ({
  selected: null,
  hovered: null,
  visited: [],
  setSelected: (iso) => set({ selected: iso }),
  setHovered: (iso) => set({ hovered: iso }),
  toggleVisited: (iso) =>
    set((state) => ({
      visited: state.visited.includes(iso)
        ? state.visited.filter((code) => code !== iso)
        : [...state.visited, iso],
    })),
}));
