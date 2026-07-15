import {
  type AuthProviders,
  type FollowUser,
  type FriendMapEntry,
  type MagicLinkResponse,
  type MeResponse,
  type PublicProfile,
  type UpdateMeInput,
  type UpsertVisitInput,
  type UserSearchResult,
  type Visit,
  authProvidersSchema,
  followUserListSchema,
  friendsMapResponseSchema,
  magicLinkResponseSchema,
  meResponseSchema,
  publicProfileSchema,
  userSearchResultListSchema,
  visitListSchema,
  visitSchema,
} from "@traveller/shared";
import { type ZodType } from "zod";

/** Base URL for the API. In dev, Next.js rewrites /api/* → :4000. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `API request failed with status ${status}`);
    this.name = "ApiError";
  }

  /** True when the request never reached the API (offline, DNS, CORS). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Can’t reach the server — check your connection and try again.";

/**
 * `fetch` that converts transport failures (offline, DNS, aborted) into a
 * typed ApiError with status 0, so callers never see a bare TypeError.
 */
async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

function buildInit(options: FetchOptions): RequestInit {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    // Custom-header CSRF token — the API rejects mutations without it.
    headers["X-Requested-With"] = "fetch";
  }
  const init: RequestInit = { method, headers, credentials: "include" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  return init;
}

/**
 * Backoff between refresh attempts. A failed refresh isn't necessarily a
 * logout — during a redeploy the API container is recreated (and Caddy
 * bounced), so `/auth/refresh` is briefly unreachable while the 30-day refresh
 * cookie is still perfectly valid. We retry through that window and only end
 * the session on a real 401/403 from the refresh endpoint.
 */
const REFRESH_RETRY_DELAYS_MS = [200, 600];

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cookie-authenticated fetch. On a 401 it calls `/auth/refresh` and, if the
 * refresh succeeds, retries the original request once. A refresh that fails
 * only transiently (network drop, or a 5xx from an API mid-restart) is retried
 * with short backoff so a deploy blip doesn't bounce a valid session to login;
 * a 401/403 from refresh is a genuine logout and stops immediately.
 */
export async function apiFetch(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const response = await safeFetch(`${API_BASE}${path}`, buildInit(options));
  if (response.status !== 401 || path === "/auth/refresh") {
    return response;
  }

  for (let attempt = 0; ; attempt++) {
    let refreshed: Response | null = null;
    try {
      refreshed = await safeFetch(
        `${API_BASE}/auth/refresh`,
        buildInit({ method: "POST" }),
      );
    } catch {
      // Transport failure (API unreachable) — treat as transient, fall through.
    }

    if (refreshed?.ok) {
      return safeFetch(`${API_BASE}${path}`, buildInit(options));
    }
    // A real 401/403 means the refresh token is dead — the session is over.
    if (refreshed && (refreshed.status === 401 || refreshed.status === 403)) {
      return response;
    }
    // Anything else (no response, or 5xx) is transient: back off and retry
    // until the attempts are exhausted, then let the original 401 stand.
    if (attempt >= REFRESH_RETRY_DELAYS_MS.length) {
      return response;
    }
    await delay(REFRESH_RETRY_DELAYS_MS[attempt]!);
  }
}

async function requestJson<T>(
  schema: ZodType<T>,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return schema.parse(await response.json());
}

export const api = {
  getProviders: (): Promise<AuthProviders> =>
    requestJson(authProvidersSchema, "/auth/providers"),

  requestMagicLink: (input: {
    email: string;
    /** Honeypot — real users leave this empty; forwarded for bot detection. */
    website?: string;
  }): Promise<MagicLinkResponse> =>
    requestJson(magicLinkResponseSchema, "/auth/magic-link", {
      method: "POST",
      body: { email: input.email, website: input.website ?? "" },
    }),

  /** Current user, or null when not logged in (after one refresh attempt). */
  getMe: async (): Promise<MeResponse | null> => {
    try {
      return await requestJson(meResponseSchema, "/auth/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  updateMe: (input: UpdateMeInput): Promise<MeResponse> =>
    requestJson(meResponseSchema, "/me", { method: "PATCH", body: input }),

  logout: async (): Promise<void> => {
    const response = await apiFetch("/auth/logout", { method: "POST" });
    if (!response.ok) throw new ApiError(response.status);
  },

  getProfile: (username: string): Promise<PublicProfile> =>
    requestJson(publicProfileSchema, `/users/${encodeURIComponent(username)}`),

  getMyVisits: (): Promise<Visit[]> =>
    requestJson(visitListSchema, "/me/visits"),

  upsertVisit: (countryCode: string, input: UpsertVisitInput): Promise<Visit> =>
    requestJson(visitSchema, `/me/visits/${encodeURIComponent(countryCode)}`, {
      method: "PUT",
      body: input,
    }),

  deleteVisit: async (countryCode: string): Promise<void> => {
    const response = await apiFetch(
      `/me/visits/${encodeURIComponent(countryCode)}`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new ApiError(response.status);
  },

  followUser: async (username: string): Promise<void> => {
    const response = await apiFetch(
      `/users/${encodeURIComponent(username)}/follow`,
      { method: "POST" },
    );
    if (!response.ok) throw new ApiError(response.status);
  },

  unfollowUser: async (username: string): Promise<void> => {
    const response = await apiFetch(
      `/users/${encodeURIComponent(username)}/follow`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new ApiError(response.status);
  },

  getFollowing: (): Promise<FollowUser[]> =>
    requestJson(followUserListSchema, "/me/following"),

  getFollowers: (): Promise<FollowUser[]> =>
    requestJson(followUserListSchema, "/me/followers"),

  getFriendsMap: (): Promise<FriendMapEntry[]> =>
    requestJson(friendsMapResponseSchema, "/me/friends-map"),

  searchUsers: (query: string): Promise<UserSearchResult[]> =>
    requestJson(
      userSearchResultListSchema,
      `/users/search?q=${encodeURIComponent(query)}`,
    ),
};
