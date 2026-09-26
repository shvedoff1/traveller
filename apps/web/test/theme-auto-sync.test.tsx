import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeAutoSync } from "../components/ThemeAutoSync";
import { useThemeStore } from "../lib/stores/theme-store";
import { NIGHT_START_HOUR } from "../lib/theme";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  useThemeStore.setState({ theme: "dark", preference: "auto" });
});

describe("ThemeAutoSync", () => {
  it("flips the auto theme when the evening switch comes round", () => {
    vi.setSystemTime(new Date(2026, 8, 26, NIGHT_START_HOUR - 1, 59, 0));
    useThemeStore.setState({ theme: "light", preference: "auto" });
    render(<ThemeAutoSync />);
    expect(useThemeStore.getState().theme).toBe("light");

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("leaves an explicit preference alone", () => {
    vi.setSystemTime(new Date(2026, 8, 26, NIGHT_START_HOUR - 1, 59, 0));
    useThemeStore.setState({ theme: "light", preference: "light" });
    render(<ThemeAutoSync />);
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(useThemeStore.getState().theme).toBe("light");
  });
});
