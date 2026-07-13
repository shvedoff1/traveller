/** Client-side fuzzy country filtering for the panel search. */

import { type Country } from "@traveller/shared";

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
