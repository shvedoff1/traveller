/** Pure stats math for the StatsBar — unit-tested without React. */

import {
  CONTINENTS,
  COUNTRIES,
  COUNTRY_CODES,
  type Continent,
} from "@traveller/shared";

export interface ContinentStat {
  continent: Continent;
  visited: number;
  total: number;
}

export interface WorldStats {
  /** Number of distinct valid visited countries. */
  visited: number;
  /** Total countries in the canonical list. */
  total: number;
  /** Visited share of the world in percent, one decimal. */
  percent: number;
  /** Per-continent progress, in canonical continent order. */
  continents: ContinentStat[];
}

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
 * Aggregate visited codes into world/continent stats. Unknown codes and
 * duplicates are ignored so optimistic intermediate states stay safe.
 */
export function computeStats(visitedCodes: readonly string[]): WorldStats {
  const valid = new Set(
    visitedCodes.filter((code) => COUNTRY_CODES.has(code)),
  );

  const perContinent = new Map<Continent, number>();
  for (const code of valid) {
    const continent = CONTINENT_BY_CODE.get(code);
    if (continent) {
      perContinent.set(continent, (perContinent.get(continent) ?? 0) + 1);
    }
  }

  const total = COUNTRIES.length;
  return {
    visited: valid.size,
    total,
    percent: Math.round((valid.size / total) * 1000) / 10,
    continents: CONTINENTS.map((continent) => ({
      continent,
      visited: perContinent.get(continent) ?? 0,
      total: CONTINENT_TOTALS.get(continent) ?? 0,
    })),
  };
}
