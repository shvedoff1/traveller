import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";

import { REDIS_CLIENT } from "../../redis/redis.module";

/** TTL for cached public profiles and stats. */
export const PROFILE_CACHE_TTL_SECONDS = 60;

/**
 * Cache-aside store for the public read endpoints (`GET /users/:username`
 * and `GET /users/:username/stats`): JSON values under `profile:{username}`
 * / `stats:{username}` with a short TTL.
 *
 * Writes never go through the cache — mutations that change what a public
 * profile shows (visit PUT/DELETE, PATCH /me, follow changes in task 05)
 * call `invalidate` explicitly so readers see changes immediately.
 */
@Injectable()
export class ProfileCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  profileKey(username: string): string {
    return `profile:${username.toLowerCase()}`;
  }

  statsKey(username: string): string {
    return `stats:${username.toLowerCase()}`;
  }

  async read<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(value),
      "EX",
      PROFILE_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Drop the cached profile + stats for each username (nulls skipped —
   * users without a claimed username have nothing cached). Pass the old
   * username too when it changes.
   */
  async invalidate(
    ...usernames: Array<string | null | undefined>
  ): Promise<void> {
    const keys = [
      ...new Set(usernames.filter((name): name is string => Boolean(name))),
    ].flatMap((name) => [this.profileKey(name), this.statsKey(name)]);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
