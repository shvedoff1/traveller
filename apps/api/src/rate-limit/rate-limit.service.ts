import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";

import { REDIS_CLIENT } from "../redis/redis.module";
import { type RateLimitRule } from "./rate-limit.constants";

/**
 * Fixed-window rate limiting on Redis: INCR the key, set the expiry when
 * the window opens, 429 once the count exceeds the rule's max. One shared
 * implementation behind the global/IP guard and the per-feature throttles.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * INCR the key (opening the window on first hit) and report whether it is
   * still within budget. Returns `false` once the rule's max is exceeded —
   * for callers that want to skip silently rather than 429.
   */
  async tryConsume(key: string, rule: RateLimitRule): Promise<boolean> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, rule.windowSeconds);
    }
    return count <= rule.max;
  }

  /** Throws 429 (with the rule's message) when `key` exceeds the rule. */
  async consume(key: string, rule: RateLimitRule): Promise<void> {
    if (!(await this.tryConsume(key, rule))) {
      throw new HttpException(rule.message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
