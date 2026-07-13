import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { type Request } from "express";

import { RATE_LIMITS, type RateLimits } from "./rate-limit.constants";
import { RateLimitService } from "./rate-limit.service";

/**
 * Global per-IP rate limit (100/min by default) applied to every route
 * except the health check (load balancers poll it). Registered as the
 * first APP_GUARD, so it runs before CSRF/auth.
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    @Inject(RATE_LIMITS) private readonly limits: RateLimits,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path === "/healthz") return true;

    // `req.ip` honours Express "trust proxy" (set in main.ts for
    // production deployments behind a reverse proxy).
    const ip = request.ip ?? request.socket?.remoteAddress ?? "unknown";
    await this.rateLimit.consume(`throttle:ip:${ip}`, this.limits.global);
    return true;
  }
}
