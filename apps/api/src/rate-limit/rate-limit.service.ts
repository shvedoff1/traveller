import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
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
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** INCR the key (opening the window on first hit); returns the new count. */
  private async hit(key: string, rule: RateLimitRule): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, rule.windowSeconds);
    }
    return count;
  }

  /**
   * INCR the key and report whether it is still within budget. Returns
   * `false` once the rule's max is exceeded — for callers that want to skip
   * silently rather than 429.
   */
  async tryConsume(key: string, rule: RateLimitRule): Promise<boolean> {
    return (await this.hit(key, rule)) <= rule.max;
  }

  /**
   * Throws 429 (with the rule's message) when `key` exceeds the rule. With a
   * `label`, the first refusal of each window is logged as a warning — once
   * per window so a client hammering past the limit can't flood the logs.
   * The label ends up in logs verbatim: never put a raw email in it.
   */
  async consume(
    key: string,
    rule: RateLimitRule,
    label?: string,
  ): Promise<void> {
    const count = await this.hit(key, rule);
    if (count <= rule.max) return;
    if (label && count === rule.max + 1) {
      this.logger.warn(
        `rate limit exceeded: ${label} (max ${rule.max}/${rule.windowSeconds}s)`,
      );
    }
    throw new HttpException(rule.message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
