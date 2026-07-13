import { createHash } from "node:crypto";

/** The subset of a RefreshToken row the rotation decision depends on. */
export interface RefreshTokenState {
  expiresAt: Date;
  revokedAt: Date | null;
}

export type RefreshDecision =
  | { action: "rotate" }
  /** Token was already rotated/revoked — reuse: nuke the whole family. */
  | { action: "revoke_family" }
  | { action: "reject" };

/**
 * Pure decision function for refresh-token rotation.
 *
 * - unknown token → reject
 * - revoked (already rotated) token → reuse detected → revoke family
 * - expired token → reject
 * - live token → rotate
 */
export function decideRefresh(
  token: RefreshTokenState | null,
  now: Date = new Date(),
): RefreshDecision {
  if (!token) return { action: "reject" };
  if (token.revokedAt) return { action: "revoke_family" };
  if (token.expiresAt.getTime() <= now.getTime()) return { action: "reject" };
  return { action: "rotate" };
}

/** sha256 hex — how raw opaque tokens are stored at rest. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
