/**
 * Server-side fetchers for public profile data (SSR page, metadata and
 * the OG image). Responses are cached by Next's data cache for 60s —
 * matching the API's own Redis TTL — and 404s resolve to null.
 */

import {
  type PublicProfile,
  type UserStats,
  publicProfileSchema,
  userStatsSchema,
} from "@traveller/shared";
import { type ZodType } from "zod";

/** The API origin as seen from the Next server (not the browser). */
const API_URL = process.env.API_URL ?? "http://localhost:4000";

export const PROFILE_REVALIDATE_SECONDS = 60;

async function fetchPublic<T>(
  path: string,
  schema: ZodType<T>,
): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, {
    next: { revalidate: PROFILE_REVALIDATE_SECONDS },
  });
  if (!response.ok) return null;
  return schema.parse(await response.json());
}

export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  return fetchPublic(
    `/users/${encodeURIComponent(username)}`,
    publicProfileSchema,
  );
}

export async function getPublicStats(
  username: string,
): Promise<UserStats | null> {
  return fetchPublic(
    `/users/${encodeURIComponent(username)}/stats`,
    userStatsSchema,
  );
}
