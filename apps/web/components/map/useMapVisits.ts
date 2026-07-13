"use client";

import { type Visit } from "@traveller/shared";
import { useCallback, useMemo } from "react";

import {
  useDeleteVisit,
  useMe,
  useUpsertVisit,
  useVisitsQuery,
} from "../../lib/visits/use-visits";
import { findVisit, visitedCodes } from "../../lib/visits/visits-cache";

export interface MapVisits {
  /** True once we know whether a user is logged in. */
  ready: boolean;
  isLoggedIn: boolean;
  /** Full visit objects, sorted by country code (empty when logged out). */
  visits: Visit[];
  /** ISO codes for the map's visited filter / panel check state. */
  visited: string[];
  /** The visit for a code, or undefined. */
  visitOf: (iso: string) => Visit | undefined;
  /**
   * Toggle a country's visited state (optimistic). Returns false when
   * logged out so the caller can show a login CTA instead.
   */
  toggle: (iso: string) => boolean;
  /** Mark/update a visit with details (optimistic PUT). */
  save: (iso: string, input: { visitedYear?: number; note?: string }) => void;
  /** Unmark a country (optimistic DELETE). */
  unmark: (iso: string) => void;
}

/**
 * Bridges the `['visits','me']` query into the map and panel: exposes the
 * visited codes for MapCanvas's filter and optimistic toggle/save/unmark
 * mutations. Replaces the session-local zustand visited set from task 02.
 */
export function useMapVisits(): MapVisits {
  const { data: me, isLoading: meLoading } = useMe();
  const isLoggedIn = Boolean(me);
  const { data } = useVisitsQuery(isLoggedIn);
  const upsertVisit = useUpsertVisit();
  const deleteVisit = useDeleteVisit();

  const visits = useMemo(
    () => (isLoggedIn ? (data ?? []) : []),
    [isLoggedIn, data],
  );
  const visited = useMemo(() => visitedCodes(visits), [visits]);

  const visitOf = useCallback(
    (iso: string) => findVisit(visits, iso),
    [visits],
  );

  const save = useCallback(
    (iso: string, input: { visitedYear?: number; note?: string }) => {
      upsertVisit.mutate({ countryCode: iso, input });
    },
    [upsertVisit],
  );

  const unmark = useCallback(
    (iso: string) => {
      deleteVisit.mutate(iso);
    },
    [deleteVisit],
  );

  const toggle = useCallback(
    (iso: string): boolean => {
      if (!isLoggedIn) return false;
      if (findVisit(visits, iso)) {
        deleteVisit.mutate(iso);
      } else {
        upsertVisit.mutate({ countryCode: iso, input: {} });
      }
      return true;
    },
    [isLoggedIn, visits, deleteVisit, upsertVisit],
  );

  return {
    ready: !meLoading,
    isLoggedIn,
    visits,
    visited,
    visitOf,
    toggle,
    save,
    unmark,
  };
}
