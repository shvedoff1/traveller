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
  /** Magic-link emails, per address (short window). */
  magicLink: RateLimitRule;
  /** Magic-link requests, per client IP (short window). */
  magicLinkIp: RateLimitRule;
  /** Magic-link emails, per address (daily cap). */
  magicLinkEmailDaily: RateLimitRule;
  /** Magic-link requests, per client IP (daily cap). */
  magicLinkIpDaily: RateLimitRule;
  /**
   * Magic-link sends across the whole service (daily). Protects the SMTP
   * provider quota — on exceed we silently skip the send (never a 429).
   */
  magicLinkGlobalDaily: RateLimitRule;
  /** User search, per user. */
  search: RateLimitRule;
  /** Visit upserts/deletes, per user. */
  visitsWrite: RateLimitRule;
}

export const RATE_LIMITS = "RATE_LIMITS";

const DAY_SECONDS = 24 * 60 * 60;
const FIFTEEN_MIN_SECONDS = 15 * 60;

/** Generic 429 body for every magic-link short/daily limit (non-enumerating). */
const MAGIC_LINK_LIMIT_MESSAGE = "Too many magic-link requests, try again later";

export const DEFAULT_RATE_LIMITS: RateLimits = {
  global: {
    max: 100,
    windowSeconds: 60,
    message: "Too many requests, try again later",
  },
  magicLink: {
    max: 3,
    windowSeconds: FIFTEEN_MIN_SECONDS,
    message: MAGIC_LINK_LIMIT_MESSAGE,
  },
  magicLinkIp: {
    max: 5,
    windowSeconds: FIFTEEN_MIN_SECONDS,
    message: MAGIC_LINK_LIMIT_MESSAGE,
  },
  magicLinkEmailDaily: {
    max: 10,
    windowSeconds: DAY_SECONDS,
    message: MAGIC_LINK_LIMIT_MESSAGE,
  },
  magicLinkIpDaily: {
    max: 20,
    windowSeconds: DAY_SECONDS,
    message: MAGIC_LINK_LIMIT_MESSAGE,
  },
  magicLinkGlobalDaily: {
    max: 200,
    windowSeconds: DAY_SECONDS,
    message: MAGIC_LINK_LIMIT_MESSAGE,
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

/**
 * Rate limits with the magic-link anti-abuse caps overridden from the
 * environment (the maxes ops most likely need to tune per SMTP provider).
 * Windows stay fixed. Falls back to {@link DEFAULT_RATE_LIMITS}.
 */
export function buildRateLimits(env: {
  MAGIC_LINK_IP_MAX: number;
  MAGIC_LINK_EMAIL_DAILY_MAX: number;
  MAGIC_LINK_IP_DAILY_MAX: number;
  MAGIC_LINK_GLOBAL_DAILY_MAX: number;
}): RateLimits {
  return {
    ...DEFAULT_RATE_LIMITS,
    magicLinkIp: {
      ...DEFAULT_RATE_LIMITS.magicLinkIp,
      max: env.MAGIC_LINK_IP_MAX,
    },
    magicLinkEmailDaily: {
      ...DEFAULT_RATE_LIMITS.magicLinkEmailDaily,
      max: env.MAGIC_LINK_EMAIL_DAILY_MAX,
    },
    magicLinkIpDaily: {
      ...DEFAULT_RATE_LIMITS.magicLinkIpDaily,
      max: env.MAGIC_LINK_IP_DAILY_MAX,
    },
    magicLinkGlobalDaily: {
      ...DEFAULT_RATE_LIMITS.magicLinkGlobalDaily,
      max: env.MAGIC_LINK_GLOBAL_DAILY_MAX,
    },
  };
}
