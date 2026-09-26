import { create } from "zustand";

import {
  type Theme,
  type ThemePreference,
  applyDomTheme,
  nextSwitchAt,
  oppositeTheme,
  readDomTheme,
  readOverride,
  readPreference,
  resolveTheme,
  writeOverride,
  writePreference,
} from "../theme";

export interface ThemeStoreState {
  /** Applied theme. Seeded from <html data-theme> (set pre-paint). */
  theme: Theme;
  /** Auto (by local time) or an explicit light/dark choice. */
  preference: ThemePreference;
  /** Permanent choice from Settings; clears any auto-mode override. */
  setPreference: (preference: ThemePreference) => void;
  /**
   * Header toggle. Explicit preference → flip it. Auto → override until
   * the next day/night switch, after which auto resumes.
   */
  toggleTheme: () => void;
  /** Re-evaluate auto mode (timer at the switch, tab refocus). */
  syncAuto: (now?: Date) => void;
}

/**
 * Client theme state: the map palette and any JS consumers subscribe here,
 * while CSS reads `data-theme` directly. Actions keep DOM + localStorage
 * in sync.
 */
export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: readDomTheme(),
  preference: readPreference(),
  setPreference: (preference) => {
    writePreference(preference);
    const theme = resolveTheme(preference, null, new Date());
    applyDomTheme(theme);
    set({ preference, theme });
  },
  toggleTheme: () => {
    const { preference, theme } = get();
    const next = oppositeTheme(theme);
    if (preference !== "auto") {
      get().setPreference(next);
      return;
    }
    const now = new Date();
    writeOverride({ theme: next, until: nextSwitchAt(now) });
    applyDomTheme(next);
    set({ theme: next });
  },
  syncAuto: (now = new Date()) => {
    const { preference, theme } = get();
    if (preference !== "auto") return;
    const override = readOverride(now.getTime());
    if (!override) writeOverride(null);
    const next = resolveTheme("auto", override, now);
    if (next === theme) return;
    applyDomTheme(next);
    set({ theme: next });
  },
}));
