import { Global, Module } from "@nestjs/common";

import { loadEnv } from "../config/env";
import { RATE_LIMITS, buildRateLimits } from "./rate-limit.constants";
import { RateLimitService } from "./rate-limit.service";

/**
 * Shared rate limiting: the Redis-backed counter service plus the limits
 * config (a provider, so e2e tests can `overrideProvider(RATE_LIMITS)`
 * with tiny windows). The default value merges the magic-link anti-abuse
 * caps from the environment.
 */
@Global()
@Module({
  providers: [
    RateLimitService,
    { provide: RATE_LIMITS, useFactory: () => buildRateLimits(loadEnv()) },
  ],
  exports: [RateLimitService, RATE_LIMITS],
})
export class RateLimitModule {}
