"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type UpsertVisitInput, type Visit } from "@traveller/shared";

import { api } from "../api-client";
import {
  VISITS_QUERY_KEY,
  applyDelete,
  applyUpsert,
} from "./visits-cache";

/** The current user (shared cache with the header). */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.getMe });
}

/** The authenticated user's visits; disabled (empty) while logged out. */
export function useVisitsQuery(enabled: boolean) {
  return useQuery({
    queryKey: VISITS_QUERY_KEY,
    queryFn: api.getMyVisits,
    enabled,
  });
}

interface UpsertVariables {
  countryCode: string;
  input: UpsertVisitInput;
}

/**
 * PUT mutation with an optimistic cache update: the map/panel recolor
 * instantly, roll back on error, and reconcile with the server on settle.
 */
export function useUpsertVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ countryCode, input }: UpsertVariables) =>
      api.upsertVisit(countryCode, input),
    onMutate: async ({ countryCode, input }: UpsertVariables) => {
      await queryClient.cancelQueries({ queryKey: VISITS_QUERY_KEY });
      const previous = queryClient.getQueryData<Visit[]>(VISITS_QUERY_KEY);
      queryClient.setQueryData<Visit[]>(VISITS_QUERY_KEY, (old) =>
        applyUpsert(old, countryCode, input),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(VISITS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: VISITS_QUERY_KEY }),
  });
}

/** DELETE mutation, optimistic like `useUpsertVisit`. */
export function useDeleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (countryCode: string) => api.deleteVisit(countryCode),
    onMutate: async (countryCode: string) => {
      await queryClient.cancelQueries({ queryKey: VISITS_QUERY_KEY });
      const previous = queryClient.getQueryData<Visit[]>(VISITS_QUERY_KEY);
      queryClient.setQueryData<Visit[]>(VISITS_QUERY_KEY, (old) =>
        applyDelete(old, countryCode),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(VISITS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: VISITS_QUERY_KEY }),
  });
}
