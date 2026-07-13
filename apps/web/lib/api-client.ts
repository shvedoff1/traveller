import {
  type AuthProviders,
  type MagicLinkResponse,
  type MeResponse,
  type PublicProfile,
  type UpdateMeInput,
  authProvidersSchema,
  magicLinkResponseSchema,
  meResponseSchema,
  publicProfileSchema,
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
 * Cookie-authenticated fetch. On a 401 it calls `/auth/refresh` once and,
 * if the refresh succeeds, retries the original request a single time.
 */
export async function apiFetch(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, buildInit(options));
  if (response.status !== 401 || path === "/auth/refresh") {
    return response;
  }

  const refreshed = await fetch(
    `${API_BASE}/auth/refresh`,
    buildInit({ method: "POST" }),
  );
  if (!refreshed.ok) {
    return response; // original 401 stands
  }
  return fetch(`${API_BASE}${path}`, buildInit(options));
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

  requestMagicLink: (email: string): Promise<MagicLinkResponse> =>
    requestJson(magicLinkResponseSchema, "/auth/magic-link", {
      method: "POST",
      body: { email },
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
};
