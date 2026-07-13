import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { type AccessTokenPayload, type AuthenticatedRequest } from "./auth.types";

/** Reads the payload from the `access_token` cookie, or `undefined`. */
export function verifyAccessCookie(
  request: AuthenticatedRequest,
  jwtService: JwtService,
): AccessTokenPayload | undefined {
  const token = (request.cookies as Record<string, string> | undefined)
    ?.access_token;
  if (!token) return undefined;
  try {
    return jwtService.verify<AccessTokenPayload>(token);
  } catch {
    return undefined;
  }
}

/** Requires a valid `access_token` cookie; 401 otherwise. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = verifyAccessCookie(request, this.jwtService);
    if (!payload) throw new UnauthorizedException();
    request.user = payload;
    return true;
  }
}

/** Attaches the user when the cookie is valid, but never rejects. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = verifyAccessCookie(request, this.jwtService);
    return true;
  }
}
