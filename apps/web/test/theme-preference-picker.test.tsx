import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemePreferencePicker } from "../components/settings/ThemePreferencePicker";
import { useThemeStore } from "../lib/stores/theme-store";
import { THEME_STORAGE_KEY } from "../lib/theme";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  useThemeStore.setState({ theme: "dark", preference: "auto" });
});

describe("ThemePreferencePicker", () => {
  it("shows the active preference and switches it", () => {
    useThemeStore.setState({ theme: "dark", preference: "auto" });
    render(<ThemePreferencePicker />);

    expect(screen.getByTestId("theme-preference-auto")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("theme-preference")).toHaveTextContent(
      /Light from 07:00, dark from 20:00/,
    );

    fireEvent.click(screen.getByTestId("theme-preference-light"));
    expect(useThemeStore.getState().preference).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByTestId("theme-preference-light")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("theme-preference-auto")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
