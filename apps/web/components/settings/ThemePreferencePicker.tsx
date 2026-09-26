"use client";

import { useEffect, useState } from "react";

import { useThemeStore } from "../../lib/stores/theme-store";
import {
  DAY_START_HOUR,
  NIGHT_START_HOUR,
  type ThemePreference,
} from "../../lib/theme";

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * Appearance setting: Auto (light by day, dark at night) or a fixed
 * light/dark. Works logged-out too — it only touches localStorage.
 */
export function ThemePreferencePicker() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  // The stored preference only exists in the browser: render the server
  // markup (nothing checked) until mount so hydration matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted ? preference : null;

  return (
    <fieldset className="space-y-2" data-testid="theme-preference">
      <legend className="text-sm">Appearance</legend>
      <div
        role="radiogroup"
        className="flex gap-1 rounded-full border border-edge p-1"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active === option.value}
            data-testid={`theme-preference-${option.value}`}
            onClick={() => setPreference(option.value)}
            className={`min-h-8 flex-1 rounded-full px-3 text-sm transition-colors duration-200 ease-out max-md:min-h-11 ${
              active === option.value
                ? "bg-surface-strong font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        {active === null
          ? "\u00a0"
          : active === "auto"
          ? `Light from ${pad(DAY_START_HOUR)}, dark from ${pad(NIGHT_START_HOUR)} your time. The sun/moon button overrides it until the next switch.`
          : "Always this theme, whatever the time."}
      </p>
    </fieldset>
  );
}
