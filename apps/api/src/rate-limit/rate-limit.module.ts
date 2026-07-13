import { Global, Module } from "@nestjs/common";

import { DEFAULT_RATE_LIMITS, RATE_LIMITS } from "./rate-limit.constants";
import { RateLimitService } from "./rate-limit.service";

/**
 * Shared rate limiting: the Redis-backed counter service plus the limits
 * config (a provider, so e2e tests can `overrideProvider(RATE_LIMITS)`
 * with tiny windows).
 */
@Global()
@Module({
  providers: [
    RateLimitService,
    { provide: RATE_LIMITS, useValue: DEFAULT_RATE_LIMITS },
  ],
  exports: [RateLimitService, RATE_LIMITS],
})
export class RateLimitModule {}
