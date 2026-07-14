import {
  type ExecutionContext,
  ForbiddenException,
  Controller,
  Get,
  Injectable,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard, type IAuthModuleOptions } from "@nestjs/passport";
import { type User } from "@prisma/client";
import { type Request, type Response } from "express";

import { setAuthCookies } from "../../common/cookies";
import { loadEnv } from "../../config/env";
import { TokenService } from "./token.service";

const OAUTH_STATE_COOKIE = "oauth_state";
// Scoped to the browser-visible OAuth path (served under the `/api` prefix)
// so the state cookie is sent back on `/api/auth/google/callback`.
const STATE_COOKIE_PATH = "/api/auth/google";

/** Kicks off the Google redirect with a signed `state` in a short-lived cookie. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const response = context.switchToHttp().getResponse<Response>();
    const state = this.jwtService.sign(
      { purpose: "oauth-state" },
      { expiresIn: "10m" },
    );
    response.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: loadEnv().NODE_ENV === "production",
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    return { state };
  }
}

/** Verifies the returned `state` against the signed cookie before passport runs. */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard("google") {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const state = request.query.state;
    const cookie = (request.cookies as Record<string, string> | undefined)?.[
      OAUTH_STATE_COOKIE
    ];
    if (typeof state !== "string" || !cookie || state !== cookie) {
      throw new ForbiddenException("OAuth state mismatch");
    }
    try {
      this.jwtService.verify(state);
    } catch {
      throw new ForbiddenException("OAuth state expired");
    }
    return (await super.canActivate(context)) as boolean;
  }
}

/** Registered by AuthModule only when GOOGLE_CLIENT_ID is set. */
@Controller("auth/google")
export class GoogleController {
  constructor(private readonly tokenService: TokenService) {}

  @Get()
  @UseGuards(GoogleAuthGuard)
  signIn(): void {
    // The guard redirects to Google's consent screen.
  }

  @Get("callback")
  @UseGuards(GoogleCallbackGuard)
  async callback(
    @Req() request: Request & { user: User },
    @Res() response: Response,
  ): Promise<void> {
    const env = loadEnv();
    const user = request.user;
    const session = await this.tokenService.issueSession(
      user,
      request.get("user-agent") ?? undefined,
    );
    response.clearCookie(OAUTH_STATE_COOKIE, { path: STATE_COOKIE_PATH });
    setAuthCookies(response, env, session.accessToken, session.refreshToken);
    response.redirect(
      user.username ? `${env.WEB_ORIGIN}/` : `${env.WEB_ORIGIN}/welcome`,
    );
  }
}
