/**
 * Canonical country list — ISO-3166-1 alpha-2 codes everywhere (DB, API,
 * map join key, stats).
 *
 * Stub for now: ~10 entries. The full list arrives in task 02.
 */

export type Continent =
  | "Africa"
  | "Antarctica"
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America";

export interface Country {
  code: string;
  name: string;
  continent: Continent;
  emoji: string;
}

export const COUNTRIES: Country[] = [
  { code: "BR", name: "Brazil", continent: "South America", emoji: "🇧🇷" },
  { code: "CA", name: "Canada", continent: "North America", emoji: "🇨🇦" },
  { code: "EG", name: "Egypt", continent: "Africa", emoji: "🇪🇬" },
  { code: "FR", name: "France", continent: "Europe", emoji: "🇫🇷" },
  { code: "IN", name: "India", continent: "Asia", emoji: "🇮🇳" },
  { code: "IT", name: "Italy", continent: "Europe", emoji: "🇮🇹" },
  { code: "JP", name: "Japan", continent: "Asia", emoji: "🇯🇵" },
  { code: "KE", name: "Kenya", continent: "Africa", emoji: "🇰🇪" },
  { code: "NZ", name: "New Zealand", continent: "Oceania", emoji: "🇳🇿" },
  { code: "US", name: "United States", continent: "North America", emoji: "🇺🇸" },
];

export const COUNTRY_CODES: ReadonlySet<string> = new Set(
  COUNTRIES.map((c) => c.code),
);

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODES.has(value);
}
