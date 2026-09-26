/** Pure helpers for the group screens — unit-tested. */

import { COUNTRIES, type Country, type GroupDetail } from "@traveller/shared";

const COUNTRY_BY_CODE: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((country) => [country.code, country]),
);

/** The canonical country for a code (undefined for unknown codes). */
export function countryByCode(code: string): Country | undefined {
  return COUNTRY_BY_CODE.get(code);
}

/** Absolute invite URL for sharing: `${origin}/join/${code}`. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/join/${encodeURIComponent(code)}`;
}

export interface GroupMapLayers {
  /** Everything anyone in the group visited. */
  visited: readonly string[];
  /** The highlighted subset: a focused member's map, or "everyone's been". */
  highlight: readonly string[];
  /** Legend label for the highlight colour. */
  highlightLabel: string;
}

/**
 * What the group map shows: the group's union, with a focused member's
 * countries (or, with nobody focused, the countries everyone has been to)
 * drawn in the highlight colour.
 */
export function groupMapLayers(
  group: Pick<GroupDetail, "members" | "stats">,
  focusedUsername: string | null,
): GroupMapLayers {
  const focused = focusedUsername
    ? group.members.find((member) => member.username === focusedUsername)
    : undefined;
  if (focused) {
    return {
      visited: group.stats.countryCodes,
      highlight: focused.countryCodes,
      highlightLabel: focused.displayName,
    };
  }
  return {
    visited: group.stats.countryCodes,
    highlight: group.stats.sharedCodes,
    highlightLabel: "Everyone",
  };
}

/** "3 members" / "1 member". */
export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
