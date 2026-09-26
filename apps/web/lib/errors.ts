import { ApiError, NETWORK_ERROR_MESSAGE } from "./api-client";

/**
 * A short, human error line for a failed mutation toast. Network failures
 * and rate limits get specific copy; anything else uses the fallback.
 */
export function describeMutationError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return NETWORK_ERROR_MESSAGE;
    if (error.status === 429) {
      return "Slow down a little — too many changes at once.";
    }
    if (error.status === 401) return "Your session expired — log in again.";
  }
  return fallback;
}

export const MAGIC_LINK_RATE_LIMITED_MESSAGE =
  "Too many sign-in attempts — wait 15 minutes and try again.";
export const MAGIC_LINK_FAILED_MESSAGE =
  "Couldn’t send the link — try again in a few minutes.";

/**
 * Error line under the magic-link form. A rate limit (429) gets its own
 * copy so users — and whoever reads their screenshot — can tell "slow down"
 * apart from "the email didn't go out".
 */
export function describeMagicLinkError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return NETWORK_ERROR_MESSAGE;
    if (error.status === 429) return MAGIC_LINK_RATE_LIMITED_MESSAGE;
  }
  return MAGIC_LINK_FAILED_MESSAGE;
}
