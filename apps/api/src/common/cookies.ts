import { type CookieOptions, type Response } from "express";

import { type Env } from "../config/env";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
/**
 * Refresh cookie is only ever sent to the refresh endpoint. The API serves
 * under the `/api` global prefix, so this must match the browser-visible URL
 * (`/api/auth/refresh`) in both dev (Next rewrite) and prod (Caddy).
 */
export const REFRESH_COOKIE_PATH = "/api/auth/refresh";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function baseOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function accessCookieOptions(env: Env): CookieOptions {
  return { ...baseOptions(env), path: "/", maxAge: ACCESS_TOKEN_TTL_MS };
}

export function refreshCookieOptions(env: Env): CookieOptions {
  return {
    ...baseOptions(env),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

export function setAuthCookies(
  response: Response,
  env: Env,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions(env));
  response.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(env));
}

export function clearAuthCookies(response: Response, env: Env): void {
  const { maxAge: _a, ...access } = accessCookieOptions(env);
  const { maxAge: _r, ...refresh } = refreshCookieOptions(env);
  response.clearCookie(ACCESS_COOKIE, access);
  response.clearCookie(REFRESH_COOKIE, refresh);
}
