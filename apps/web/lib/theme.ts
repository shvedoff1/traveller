/**
 * Theme resolution logic — pure and unit-testable.
 *
 * Three preferences:
 * - `light` / `dark` — an explicit, permanent choice (Settings).
 * - `auto` (default) — follows the local clock: light by day
 *   ({@link DAY_START_HOUR}–{@link NIGHT_START_HOUR}), dark at night.
 *
 * In auto mode the header toggle is a soft override: it sticks until the
 * next scheduled day/night switch, then auto takes over again. That keeps
 * a quick "too bright right now" flip from disabling auto forever.
 */

export type Theme = "dark" | "light";
export type ThemePreference = Theme | "auto";

export const THEME_STORAGE_KEY = "traveller-theme";
export const THEME_OVERRIDE_STORAGE_KEY = "traveller-theme-override";
export const DEFAULT_THEME: Theme = "dark";

/** Local hour (inclusive) when auto switches to light. */
export const DAY_START_HOUR = 7;
/** Local hour (inclusive) when auto switches to dark. */
export const NIGHT_START_HOUR = 20;

/** A temporary auto-mode override; `until` is epoch ms. */
export interface ThemeOverride {
  theme: Theme;
  until: number;
}

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return isTheme(value) || value === "auto";
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** The auto theme for a local hour (0–23). */
export function themeForHour(hour: number): Theme {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? "light" : "dark";
}

/** Epoch ms of the next day/night switch strictly after `now` (local time). */
export function nextSwitchAt(now: Date): number {
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);
  const hour = now.getHours();
  if (hour < DAY_START_HOUR) {
    candidate.setHours(DAY_START_HOUR);
  } else if (hour < NIGHT_START_HOUR) {
    candidate.setHours(NIGHT_START_HOUR);
  } else {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(DAY_START_HOUR);
  }
  return candidate.getTime();
}

/** Parse the stored override; null when missing, malformed or expired. */
export function parseOverride(
  raw: string | null,
  now: number,
): ThemeOverride | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      isTheme((value as ThemeOverride).theme) &&
      typeof (value as ThemeOverride).until === "number" &&
      (value as ThemeOverride).until > now
    ) {
      return value as ThemeOverride;
    }
  } catch {
    // Garbage in storage — ignore it.
  }
  return null;
}

/** The stored preference, `auto` for anything unrecognised. */
export function resolvePreference(stored: string | null): ThemePreference {
  return isThemePreference(stored) ? stored : "auto";
}

/** The theme to apply for a preference, override and moment. */
export function resolveTheme(
  preference: ThemePreference,
  override: ThemeOverride | null,
  now: Date,
): Theme {
  if (preference !== "auto") return preference;
  if (override && override.until > now.getTime()) return override.theme;
  return themeForHour(now.getHours());
}

/**
 * Inline `<script>` body for layout.tsx — sets `data-theme` on <html>
 * before first paint so there is no flash of the wrong theme. Mirrors
 * `resolveTheme` (it cannot import it, so keep the two in sync).
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme;
    if (stored === "light" || stored === "dark") {
      theme = stored;
    } else {
      var now = new Date();
      var override = null;
      try {
        override = JSON.parse(
          localStorage.getItem(${JSON.stringify(THEME_OVERRIDE_STORAGE_KEY)}) || "null"
        );
      } catch (e) {}
      if (
        override &&
        (override.theme === "light" || override.theme === "dark") &&
        typeof override.until === "number" &&
        override.until > now.getTime()
      ) {
        theme = override.theme;
      } else {
        var hour = now.getHours();
        theme =
          hour >= ${DAY_START_HOUR} && hour < ${NIGHT_START_HOUR} ? "light" : "dark";
      }
    }
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

/** The theme currently applied to <html> (dark on the server). */
export function readDomTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const applied = document.documentElement.dataset.theme;
  return isTheme(applied) ? applied : DEFAULT_THEME;
}

/** Apply a theme to <html> (no persistence). */
export function applyDomTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The persisted preference (auto when nothing/unknown is stored). */
export function readPreference(): ThemePreference {
  try {
    return resolvePreference(storage()?.getItem(THEME_STORAGE_KEY) ?? null);
  } catch {
    return "auto";
  }
}

/** The persisted, still-valid auto-mode override. */
export function readOverride(now: number): ThemeOverride | null {
  try {
    return parseOverride(
      storage()?.getItem(THEME_OVERRIDE_STORAGE_KEY) ?? null,
      now,
    );
  } catch {
    return null;
  }
}

/** Persist a preference; any override is dropped with it. */
export function writePreference(preference: ThemePreference): void {
  try {
    const store = storage();
    if (!store) return;
    if (preference === "auto") store.removeItem(THEME_STORAGE_KEY);
    else store.setItem(THEME_STORAGE_KEY, preference);
    store.removeItem(THEME_OVERRIDE_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode) — the choice lasts the session.
  }
}

/** Persist (or clear, with null) the auto-mode override. */
export function writeOverride(override: ThemeOverride | null): void {
  try {
    const store = storage();
    if (!store) return;
    if (override) {
      store.setItem(THEME_OVERRIDE_STORAGE_KEY, JSON.stringify(override));
    } else {
      store.removeItem(THEME_OVERRIDE_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — the override lasts the session.
  }
}
