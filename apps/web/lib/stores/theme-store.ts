import { create } from "zustand";

import {
  type Theme,
  oppositeTheme,
  readDomTheme,
  writeDomTheme,
} from "../theme";

export interface ThemeStoreState {
  /** Applied theme. Seeded from <html data-theme> (set pre-paint). */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Client theme state: the map palette and any JS consumers subscribe here,
 * while CSS reads `data-theme` directly. `setTheme` keeps DOM +
 * localStorage in sync.
 */
export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: readDomTheme(),
  setTheme: (theme) => {
    writeDomTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(oppositeTheme(get().theme)),
}));
