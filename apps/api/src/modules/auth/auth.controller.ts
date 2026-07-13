import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  type AuthProviders,
  type MagicLinkRequest,
  type MagicLinkResponse,
  type MeResponse,
  magicLinkRequestSchema,
} from "@traveller/shared";
import { type Response } from "express";

import { type AccessTokenPayload, type AuthenticatedRequest } from "../../common/auth.types";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../../common/cookies";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard, OptionalAuthGuard } from "../../common/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { loadEnv } from "../../config/env";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Get("providers")
  providers(): AuthProviders {
    return {
      google: Boolean(loadEnv().GOOGLE_CLIENT_ID),
      magicLink: true,
    };
  }

  @Post("magic-link")
  @HttpCode(200)
  async requestMagicLink(
    @Body(new ZodValidationPipe(magicLinkRequestSchema)) body: MagicLinkRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<MagicLinkResponse> {
    // `req.ip` honours Express "trust proxy" (main.ts sets it when
    // TRUST_PROXY=true), so behind Caddy this is the real client IP.
    const ip = request.ip ?? request.socket?.remoteAddress ?? "unknown";
    await this.authService.requestMagicLink(body.email, ip, body.website);
    return { ok: true };
  }

  @Get("magic-link/verify")
  async verifyMagicLink(
    @Query("token") token: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!token) throw new UnauthorizedException("Missing token");
    const env = loadEnv();

    const user = await this.authService.verifyMagicLink(token);
    const session = await this.tokenService.issueSession(
      user,
      request.get("user-agent") ?? undefined,
    );
    setAuthCookies(response, env, session.accessToken, session.refreshToken);
    response.redirect(
      user.username ? `${env.WEB_ORIGIN}/` : `${env.WEB_ORIGIN}/welcome`,
    );
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    const env = loadEnv();
    const raw = (request.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    if (!raw) throw new UnauthorizedException("Missing refresh token");

    try {
      const session = await this.tokenService.rotateSession(
        raw,
        request.get("user-agent") ?? undefined,
      );
      setAuthCookies(response, env, session.accessToken, session.refreshToken);
      return { ok: true };
    } catch (error) {
      clearAuthCookies(response, env);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  async logout(
    @CurrentUser() user: AccessTokenPayload | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    if (user) {
      await this.tokenService.revokeFamily(user.fid);
    }
    clearAuthCookies(response, loadEnv());
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload): Promise<MeResponse> {
    const me = await this.authService.me(user.sub);
    if (!me) throw new UnauthorizedException();
    return me;
  }
}
