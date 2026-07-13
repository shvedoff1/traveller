import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { type AccessTokenPayload, type AuthenticatedRequest } from "./auth.types";

/**
 * Injects the verified access-token payload placed on the request by
 * `JwtAuthGuard` (or `undefined` under `OptionalAuthGuard` when anonymous).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
