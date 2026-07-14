import { USERNAME_REGEX, type UpdateMeInput } from "@traveller/shared";

import { ApiError } from "../api-client";

/** Mirrors the shared `updateMeSchema` displayName bound (1–80 chars). */
export const DISPLAY_NAME_MAX = 80;

export const USERNAME_FORMAT_HINT =
  "3–30 characters: lowercase letters, digits and underscore.";

/** The current values as loaded from `['me']`. */
export interface ProfileFields {
  displayName: string;
  username: string;
}

/**
 * Validate the display name. Returns an inline error message, or null when
 * valid. Empty (after trimming) and over-long are the two failure modes.
 */
export function displayNameError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Display name can’t be empty.";
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  }
  return null;
}

/**
 * Validate the username against the shared regex. Returns an inline error
 * message, or null when valid.
 */
export function usernameError(value: string): string | null {
  if (value.length === 0) return "Username can’t be empty.";
  return USERNAME_REGEX.test(value) ? null : USERNAME_FORMAT_HINT;
}

/**
 * Build the minimal PATCH /me body: only the fields that actually changed,
 * so an unchanged username never triggers a needless 409 check. Returns
 * null when nothing changed (submit should be disabled).
 */
export function buildUpdate(
  current: ProfileFields,
  next: ProfileFields,
): UpdateMeInput | null {
  const body: { username?: string; displayName?: string } = {};
  const displayName = next.displayName.trim();
  if (displayName !== current.displayName) body.displayName = displayName;
  if (next.username !== current.username) body.username = next.username;
  if (body.username === undefined && body.displayName === undefined) {
    return null;
  }
  return body as UpdateMeInput;
}

/**
 * Map a failed PATCH /me to a user-facing message. 409 is the taken-username
 * case; 401 means the session lapsed; anything else is a generic retry.
 */
export function updateErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "That username is already taken.";
  }
  if (error instanceof ApiError && error.status === 401) {
    return "Your session expired — log in again.";
  }
  return "Something went wrong — try again.";
}
