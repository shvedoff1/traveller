/**
 * Theme resolution logic — pure and unit-testable. The persisted choice
 * (localStorage) wins; otherwise `prefers-color-scheme` decides; dark is
 * the default.
 */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "traveller-theme";
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** The theme to apply given the stored value and the OS preference. */
export function resolveInitialTheme(
  stored: string | null,
  prefersLight: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersLight ? "light" : DEFAULT_THEME;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Inline `<script>` body for layout.tsx — sets `data-theme` on <html>
 * before first paint so there is no flash of the wrong theme. Mirrors
 * `resolveInitialTheme` (it cannot import it, so keep the two in sync).
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
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

/** Apply a theme to <html> and persist the explicit choice. */
export function writeDomTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode) — the choice lasts the session.
  }
}
