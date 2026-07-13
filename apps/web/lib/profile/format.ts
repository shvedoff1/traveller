/** Pure formatting helpers for profile metadata + OG images — unit-tested. */

import { CONTINENTS, COUNTRIES, type UserStats } from "@traveller/shared";

import { type WorldStats } from "../stats";

/** "1 country" / "47 countries". */
export function formatCountryCount(count: number): string {
  return `${count} ${count === 1 ? "country" : "countries"}`;
}

/** "24%" — the API percent already carries at most one decimal. */
export function formatWorldPercent(percent: number): string {
  return `${percent}%`;
}

/**
 * Page/OG title, led by the nick so the browser tab shows "@john — 47
 * countries" rather than the (email-derived) display name.
 */
export function profileTitle(username: string, count: number): string {
  return `@${username} — ${formatCountryCount(count)}`;
}

/** Meta description with the world share. */
export function profileDescription(
  displayName: string,
  count: number,
  percent: number,
): string {
  return `${displayName} has visited ${formatCountryCount(count)} — ${formatWorldPercent(percent)} of the world. See the map on Traveller.`;
}

/** OG image subtitle: "47 countries · 24% of the world". */
export function ogSubtitle(count: number, percent: number): string {
  return `${formatCountryCount(count)} · ${formatWorldPercent(percent)} of the world`;
}

/**
 * Reshape the API's stats payload into the `WorldStats` shape the shared
 * StatsPanel renders, in canonical continent order.
 */
export function statsToWorldStats(stats: UserStats): WorldStats {
  return {
    visited: stats.countryCount,
    total: COUNTRIES.length,
    percent: stats.worldPercent,
    continents: CONTINENTS.map((continent) => ({
      continent,
      visited: stats.continents[continent]?.visited ?? 0,
      total: stats.continents[continent]?.total ?? 0,
    })),
  };
}
