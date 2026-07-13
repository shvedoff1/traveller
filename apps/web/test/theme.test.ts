import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  oppositeTheme,
  readDomTheme,
  resolveInitialTheme,
  writeDomTheme,
} from "../lib/theme";
import { useThemeStore } from "../lib/stores/theme-store";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  useThemeStore.setState({ theme: DEFAULT_THEME });
  vi.unstubAllGlobals();
});

describe("resolveInitialTheme", () => {
  it("prefers the stored explicit choice", () => {
    expect(resolveInitialTheme("light", false)).toBe("light");
    expect(resolveInitialTheme("dark", true)).toBe("dark");
  });

  it("falls back to the OS preference", () => {
    expect(resolveInitialTheme(null, true)).toBe("light");
    expect(resolveInitialTheme(null, false)).toBe("dark");
  });

  it("ignores garbage stored values (dark default)", () => {
    expect(resolveInitialTheme("blue", false)).toBe("dark");
    expect(resolveInitialTheme("", true)).toBe("light");
  });
});

describe("isTheme / oppositeTheme", () => {
  it("recognises only the two themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("light")).toBe(true);
    expect(isTheme("solarized")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("flips between the two themes", () => {
    expect(oppositeTheme("dark")).toBe("light");
    expect(oppositeTheme("light")).toBe("dark");
  });
});

describe("DOM helpers", () => {
  it("readDomTheme defaults to dark when nothing is applied", () => {
    expect(readDomTheme()).toBe("dark");
  });

  it("writeDomTheme stamps <html> and persists to localStorage", () => {
    writeDomTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(readDomTheme()).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function runInitScript(prefersLight: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: prefersLight }),
    );
    (0, eval)(THEME_INIT_SCRIPT);
  }

  it("applies the stored theme before paint", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript(false);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("matches resolveInitialTheme for the OS preference", () => {
    runInitScript(true);
    expect(document.documentElement.dataset.theme).toBe(
      resolveInitialTheme(null, true),
    );
    runInitScript(false);
    expect(document.documentElement.dataset.theme).toBe(
      resolveInitialTheme(null, false),
    );
  });
});

describe("useThemeStore", () => {
  it("toggleTheme flips state, DOM and storage together", () => {
    useThemeStore.setState({ theme: "dark" });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
