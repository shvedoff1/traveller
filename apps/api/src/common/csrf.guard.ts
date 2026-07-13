import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { type Request } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Custom-header CSRF protection: state-changing requests must carry
 * `X-Requested-With: fetch`. Browsers never add this header on their own
 * (form posts, top-level navigations), and cross-origin scripts can only
 * add it after a CORS preflight — which our CORS config rejects for
 * foreign origins.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.get("x-requested-with") !== "fetch") {
      throw new ForbiddenException("Missing X-Requested-With header");
    }
    return true;
  }
}
