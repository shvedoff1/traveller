/**
 * Pure helpers for the optimistic `['visits','me']` cache — extracted from
 * the mutation hooks so the cache math is unit-testable without React.
 */

import { type UpsertVisitInput, type Visit } from "@traveller/shared";

/** The TanStack Query key for the authenticated user's visits. */
export const VISITS_QUERY_KEY = ["visits", "me"] as const;

const byCountryCode = (a: Visit, b: Visit): number =>
  a.countryCode < b.countryCode ? -1 : a.countryCode > b.countryCode ? 1 : 0;

/** The visit for a code, or undefined. */
export function findVisit(
  visits: readonly Visit[] | undefined,
  countryCode: string,
): Visit | undefined {
  return visits?.find((visit) => visit.countryCode === countryCode);
}

/**
 * What the list looks like after `PUT /me/visits/:countryCode` succeeds:
 * PUT semantics — year/note are replaced, omitted fields clear; the
 * original `createdAt` is kept on update. Result stays sorted by code.
 */
export function applyUpsert(
  visits: readonly Visit[] | undefined,
  countryCode: string,
  input: UpsertVisitInput,
  now: string = new Date().toISOString(),
): Visit[] {
  const existing = findVisit(visits, countryCode);
  const next: Visit = {
    countryCode,
    visitedYear: input.visitedYear ?? null,
    note: input.note ? input.note : null,
    createdAt: existing?.createdAt ?? now,
  };
  return [
    ...(visits ?? []).filter((visit) => visit.countryCode !== countryCode),
    next,
  ].sort(byCountryCode);
}

/** What the list looks like after `DELETE /me/visits/:countryCode`. */
export function applyDelete(
  visits: readonly Visit[] | undefined,
  countryCode: string,
): Visit[] {
  return (visits ?? []).filter((visit) => visit.countryCode !== countryCode);
}

/** The ISO codes of a visit list — the map's visited join key. */
export function visitedCodes(visits: readonly Visit[] | undefined): string[] {
  return (visits ?? []).map((visit) => visit.countryCode);
}
