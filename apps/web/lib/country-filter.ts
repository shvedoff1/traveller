/** Client-side fuzzy country filtering for the panel search. */

import { CONTINENTS, type Continent, type Country } from "@traveller/shared";

/** Lowercase and strip diacritics: "Côte d'Ivoire" → "cote d'ivoire". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Normalized-`includes` filter over name and ISO code. An empty query
 * returns everything, in the given order.
 */
export function filterCountries(
  countries: readonly Country[],
  query: string,
): Country[] {
  const needle = normalize(query.trim());
  if (!needle) return [...countries];
  return countries.filter(
    (country) =>
      normalize(country.name).includes(needle) ||
      normalize(country.code).includes(needle),
  );
}

export interface ContinentGroup {
  continent: Continent;
  countries: Country[];
}

/**
 * Split a (possibly filtered) country list into continent sections, in
 * canonical continent order, dropping continents with no countries left.
 * Order within a section follows the input order.
 */
export function groupByContinent(
  countries: readonly Country[],
): ContinentGroup[] {
  const buckets = new Map<Continent, Country[]>();
  for (const country of countries) {
    const bucket = buckets.get(country.continent);
    if (bucket) bucket.push(country);
    else buckets.set(country.continent, [country]);
  }
  return CONTINENTS.flatMap((continent) => {
    const bucket = buckets.get(continent);
    return bucket ? [{ continent, countries: bucket }] : [];
  });
}
