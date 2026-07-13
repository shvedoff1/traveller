import { HttpException } from "@nestjs/common";
import type Redis from "ioredis";

import { type RateLimitRule } from "./rate-limit.constants";
import { RateLimitService } from "./rate-limit.service";

/** In-memory INCR/EXPIRE double for the ioredis client. */
class FakeRedis {
  counts = new Map<string, number>();
  expirations: Array<{ key: string; seconds: number }> = [];

  async incr(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expirations.push({ key, seconds });
    return 1;
  }
}

const RULE: RateLimitRule = {
  max: 3,
  windowSeconds: 60,
  message: "Too many requests, try again later",
};

describe("RateLimitService", () => {
  let redis: FakeRedis;
  let service: RateLimitService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new RateLimitService(redis as unknown as Redis);
  });

  it("allows up to `max` requests in a window", async () => {
    for (let i = 0; i < RULE.max; i += 1) {
      await expect(service.consume("k", RULE)).resolves.toBeUndefined();
    }
  });

  it("throws 429 with the rule message once the max is exceeded", async () => {
    for (let i = 0; i < RULE.max; i += 1) {
      await service.consume("k", RULE);
    }
    const error = await service.consume("k", RULE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).toBe(RULE.message);
  });

  it("sets the expiry exactly once, when the window opens", async () => {
    await service.consume("k", RULE);
    await service.consume("k", RULE);
    expect(redis.expirations).toEqual([{ key: "k", seconds: 60 }]);
  });

  it("tracks keys independently", async () => {
    for (let i = 0; i < RULE.max; i += 1) {
      await service.consume("a", RULE);
    }
    await expect(service.consume("b", RULE)).resolves.toBeUndefined();
    await expect(service.consume("a", RULE)).rejects.toThrow(RULE.message);
  });
});
