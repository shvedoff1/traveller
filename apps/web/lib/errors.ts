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
