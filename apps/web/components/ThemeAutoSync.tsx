"use client";

import { useEffect } from "react";

import { useThemeStore } from "../lib/stores/theme-store";
import { nextSwitchAt } from "../lib/theme";

/** Fire slightly after the hour so the clock has definitely rolled over. */
const SWITCH_SLACK_MS = 1_000;

/**
 * Keeps the auto (time-of-day) theme current while a tab stays open: a
 * timer fires at the next day/night switch, and returning to the tab
 * re-checks (timers in background tabs get throttled or frozen). Renders
 * nothing; does nothing for an explicit light/dark preference.
 */
export function ThemeAutoSync() {
  const preference = useThemeStore((state) => state.preference);
  const syncAuto = useThemeStore((state) => state.syncAuto);

  useEffect(() => {
    if (preference !== "auto") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      const delay = nextSwitchAt(new Date()) - Date.now() + SWITCH_SLACK_MS;
      timer = setTimeout(() => {
        syncAuto();
        arm();
      }, delay);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      syncAuto();
      arm();
    };

    syncAuto();
    arm();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [preference, syncAuto]);

  return null;
}
