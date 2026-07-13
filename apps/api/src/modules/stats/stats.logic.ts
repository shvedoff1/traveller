/** Pure stats math for GET /users/:username/stats — unit-tested. */

import {
  CONTINENTS,
  COUNTRIES,
  COUNTRY_CODES,
  type Continent,
  type UserStats,
} from "@traveller/shared";

const CONTINENT_TOTALS: ReadonlyMap<Continent, number> = new Map(
  CONTINENTS.map((continent) => [
    continent,
    COUNTRIES.filter((country) => country.continent === continent).length,
  ]),
);

const CONTINENT_BY_CODE: ReadonlyMap<string, Continent> = new Map(
  COUNTRIES.map((country) => [country.code, country.continent]),
);

/**
 * Aggregate visited ISO codes into the country-count / world-percent /
 * per-continent portion of `UserStats`. Unknown codes and duplicates are
 * ignored; the percent has one decimal.
 */
export function computeCountryStats(
  visitedCodes: readonly string[],
): Pick<UserStats, "countryCount" | "worldPercent" | "continents"> {
  const valid = new Set(visitedCodes.filter((code) => COUNTRY_CODES.has(code)));

  const perContinent = new Map<Continent, number>();
  for (const code of valid) {
    const continent = CONTINENT_BY_CODE.get(code);
    if (continent) {
      perContinent.set(continent, (perContinent.get(continent) ?? 0) + 1);
    }
  }

  return {
    countryCount: valid.size,
    worldPercent: Math.round((valid.size / COUNTRIES.length) * 1000) / 10,
    continents: Object.fromEntries(
      CONTINENTS.map((continent) => [
        continent,
        {
          visited: perContinent.get(continent) ?? 0,
          total: CONTINENT_TOTALS.get(continent) ?? 0,
        },
      ]),
    ),
  };
}
