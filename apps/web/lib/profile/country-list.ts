/** Pure helpers for the profile's country list — unit-tested. */

import { COUNTRIES, type Country } from "@traveller/shared";

import { type ContinentGroup, groupByContinent } from "../country-filter";

/** Which of the profile owner's countries to list. */
export type ProfileListFilter = "all" | "shared" | "new";

export interface ProfileCountryList {
  groups: ContinentGroup[];
  counts: Record<ProfileListFilter, number>;
}

/**
 * The profile owner's countries, grouped by continent (canonical order)
 * and sorted by name within each. With the viewer's own codes, the list
 * can narrow to countries you share (`shared`) or ones you haven't been
 * to yet (`new`); without them (logged out / own profile) only `all`
 * makes sense and the other counts are 0.
 */
export function buildProfileCountryList(
  theirCodes: readonly string[],
  myCodes: readonly string[] | null,
  filter: ProfileListFilter,
): ProfileCountryList {
  const theirs = new Set(theirCodes);
  const mine = new Set(myCodes ?? []);
  const countries = COUNTRIES.filter((country) => theirs.has(country.code));
  const shared = myCodes
    ? countries.filter((country) => mine.has(country.code))
    : [];
  const fresh = myCodes
    ? countries.filter((country) => !mine.has(country.code))
    : [];

  const picked: Country[] =
    filter === "shared" ? shared : filter === "new" ? fresh : countries;
  const byName = [...picked].sort((a, b) => a.name.localeCompare(b.name));

  return {
    groups: groupByContinent(byName),
    counts: {
      all: countries.length,
      shared: shared.length,
      new: fresh.length,
    },
  };
}
