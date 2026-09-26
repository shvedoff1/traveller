import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAY_START_HOUR,
  NIGHT_START_HOUR,
  THEME_INIT_SCRIPT,
  THEME_OVERRIDE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isTheme,
  isThemePreference,
  nextSwitchAt,
  oppositeTheme,
  parseOverride,
  readDomTheme,
  readPreference,
  resolvePreference,
  resolveTheme,
  themeForHour,
} from "../lib/theme";
import { useThemeStore } from "../lib/stores/theme-store";

/** A local-time Date on a fixed day at `hour:minute`. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 26, hour, minute, 0, 0);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  useThemeStore.setState({ theme: "dark", preference: "auto" });
});

describe("themeForHour", () => {
  it("is light by day and dark at night", () => {
    expect(themeForHour(DAY_START_HOUR - 1)).toBe("dark");
    expect(themeForHour(DAY_START_HOUR)).toBe("light");
    expect(themeForHour(13)).toBe("light");
    expect(themeForHour(NIGHT_START_HOUR - 1)).toBe("light");
    expect(themeForHour(NIGHT_START_HOUR)).toBe("dark");
    expect(themeForHour(0)).toBe("dark");
  });
});

describe("nextSwitchAt", () => {
  it("is this morning before dawn", () => {
    expect(nextSwitchAt(at(3, 15))).toBe(at(DAY_START_HOUR).getTime());
  });

  it("is this evening during the day", () => {
    expect(nextSwitchAt(at(DAY_START_HOUR))).toBe(
      at(NIGHT_START_HOUR).getTime(),
    );
    expect(nextSwitchAt(at(12, 30))).toBe(at(NIGHT_START_HOUR).getTime());
  });

  it("is tomorrow morning at night", () => {
    const tomorrowMorning = new Date(2026, 8, 27, DAY_START_HOUR).getTime();
    expect(nextSwitchAt(at(NIGHT_START_HOUR))).toBe(tomorrowMorning);
    expect(nextSwitchAt(at(23, 59))).toBe(tomorrowMorning);
  });
});

describe("preference + override parsing", () => {
  it("recognises themes and preferences", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isThemePreference("auto")).toBe(true);
    expect(isThemePreference("solarized")).toBe(false);
    expect(oppositeTheme("dark")).toBe("light");
    expect(oppositeTheme("light")).toBe("dark");
  });

  it("defaults unknown stored values to auto", () => {
    expect(resolvePreference(null)).toBe("auto");
    expect(resolvePreference("blue")).toBe("auto");
    expect(resolvePreference("light")).toBe("light");
  });

  it("drops malformed and expired overrides", () => {
    const now = at(12).getTime();
    expect(parseOverride(null, now)).toBeNull();
    expect(parseOverride("{nope", now)).toBeNull();
    expect(parseOverride('{"theme":"blue","until":1e15}', now)).toBeNull();
    expect(
      parseOverride(JSON.stringify({ theme: "dark", until: now - 1 }), now),
    ).toBeNull();
    expect(
      parseOverride(JSON.stringify({ theme: "dark", until: now + 1 }), now),
    ).toEqual({ theme: "dark", until: now + 1 });
  });
});

describe("resolveTheme", () => {
  it("honours an explicit preference at any hour", () => {
    expect(resolveTheme("dark", null, at(12))).toBe("dark");
    expect(resolveTheme("light", null, at(2))).toBe("light");
  });

  it("follows the clock in auto mode", () => {
    expect(resolveTheme("auto", null, at(12))).toBe("light");
    expect(resolveTheme("auto", null, at(22))).toBe("dark");
  });

  it("lets a live override win in auto mode, until it expires", () => {
    const override = { theme: "dark" as const, until: at(NIGHT_START_HOUR).getTime() };
    expect(resolveTheme("auto", override, at(12))).toBe("dark");
    expect(resolveTheme("auto", override, at(NIGHT_START_HOUR))).toBe("dark");
    expect(resolveTheme("auto", override, new Date(2026, 8, 27, 8))).toBe(
      "light",
    );
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function runInitScript(now: Date) {
    vi.setSystemTime(now);
    (0, eval)(THEME_INIT_SCRIPT);
    return document.documentElement.dataset.theme;
  }

  it("applies a stored explicit theme at any hour", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(runInitScript(at(23))).toBe("light");
  });

  it("matches resolveTheme for the auto clock", () => {
    for (const hour of [0, DAY_START_HOUR, 12, NIGHT_START_HOUR, 23]) {
      expect(runInitScript(at(hour))).toBe(resolveTheme("auto", null, at(hour)));
    }
  });

  it("applies a live override and ignores an expired one", () => {
    localStorage.setItem(
      THEME_OVERRIDE_STORAGE_KEY,
      JSON.stringify({ theme: "dark", until: at(NIGHT_START_HOUR).getTime() }),
    );
    expect(runInitScript(at(12))).toBe("dark");
    expect(runInitScript(new Date(2026, 8, 27, 12))).toBe("light");
  });
});

describe("DOM helpers", () => {
  it("readDomTheme defaults to dark when nothing is applied", () => {
    expect(readDomTheme()).toBe("dark");
  });

  it("readPreference reads storage, auto by default", () => {
    expect(readPreference()).toBe("auto");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readPreference()).toBe("dark");
  });
});

describe("useThemeStore", () => {
  it("toggle in auto mode overrides only until the next switch", () => {
    vi.setSystemTime(at(12));
    useThemeStore.setState({ theme: "light", preference: "auto" });

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(useThemeStore.getState().preference).toBe("auto");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(THEME_OVERRIDE_STORAGE_KEY)!),
    ).toEqual({ theme: "dark", until: at(NIGHT_START_HOUR).getTime() });

    // Still overridden later in the afternoon…
    useThemeStore.getState().syncAuto(at(18));
    expect(useThemeStore.getState().theme).toBe("dark");

    // …and auto resumes next morning, dropping the stale override.
    useThemeStore.getState().syncAuto(new Date(2026, 8, 27, 9));
    expect(useThemeStore.getState().theme).toBe("light");
    expect(localStorage.getItem(THEME_OVERRIDE_STORAGE_KEY)).toBeNull();
  });

  it("syncAuto follows the clock and leaves explicit choices alone", () => {
    useThemeStore.setState({ theme: "light", preference: "auto" });
    useThemeStore.getState().syncAuto(at(NIGHT_START_HOUR));
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    useThemeStore.setState({ theme: "light", preference: "light" });
    useThemeStore.getState().syncAuto(at(23));
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("setPreference persists an explicit theme and clears the override", () => {
    vi.setSystemTime(at(12));
    localStorage.setItem(
      THEME_OVERRIDE_STORAGE_KEY,
      JSON.stringify({ theme: "dark", until: at(NIGHT_START_HOUR).getTime() }),
    );
    useThemeStore.getState().setPreference("dark");
    expect(useThemeStore.getState()).toMatchObject({
      preference: "dark",
      theme: "dark",
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(localStorage.getItem(THEME_OVERRIDE_STORAGE_KEY)).toBeNull();

    // An explicit preference toggles permanently.
    useThemeStore.getState().toggleTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    // Back to auto: the clock decides (noon → light) and storage is cleared.
    useThemeStore.getState().setPreference("auto");
    expect(useThemeStore.getState().theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
