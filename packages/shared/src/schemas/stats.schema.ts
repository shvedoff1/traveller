import { z } from "zod";

/**
 * GET /users/:username/stats response — public travel stats.
 *
 * `continents` is keyed by continent name (see `CONTINENTS`); follower
 * counts read from the Follow table (0 until following ships in task 05).
 */
export const userStatsSchema = z.object({
  countryCount: z.number().int().nonnegative(),
  /** Visited share of the world in percent, one decimal. */
  worldPercent: z.number().min(0).max(100),
  continents: z.record(
    z.string(),
    z.object({
      visited: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
});
export type UserStats = z.infer<typeof userStatsSchema>;
