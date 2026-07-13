/**
 * Final rate limits (task 06). All limits are fixed-window counters in
 * Redis (INCR + EXPIRE). Provided through the {@link RATE_LIMITS} token so
 * e2e tests can override them with tiny windows.
 */

export interface RateLimitRule {
  /** Requests allowed per window. */
  max: number;
  windowSeconds: number;
  /** 429 body message. */
  message: string;
}

export interface RateLimits {
  /** Every request, per client IP. */
  global: RateLimitRule;
  /** Magic-link emails, per address. */
  magicLink: RateLimitRule;
  /** User search, per user. */
  search: RateLimitRule;
  /** Visit upserts/deletes, per user. */
  visitsWrite: RateLimitRule;
}

export const RATE_LIMITS = "RATE_LIMITS";

export const DEFAULT_RATE_LIMITS: RateLimits = {
  global: {
    max: 100,
    windowSeconds: 60,
    message: "Too many requests, try again later",
  },
  magicLink: {
    max: 3,
    windowSeconds: 15 * 60,
    message: "Too many magic-link requests, try again later",
  },
  search: {
    max: 20,
    windowSeconds: 60,
    message: "Too many search requests, try again later",
  },
  visitsWrite: {
    max: 60,
    windowSeconds: 60,
    message: "Too many changes at once, try again later",
  },
};
