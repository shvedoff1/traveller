import { randomBytes } from "node:crypto";

import {
  GoneException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { type User } from "@prisma/client";
import { type MeResponse } from "@traveller/shared";

import { loadEnv } from "../../config/env";
import { MailService } from "../../mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  RATE_LIMITS,
  type RateLimits,
} from "../../rate-limit/rate-limit.constants";
import { RateLimitService } from "../../rate-limit/rate-limit.service";
import { hashToken } from "./refresh-token.logic";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 min

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
    @Inject(RATE_LIMITS) private readonly limits: RateLimits,
  ) {}

  /**
   * Create a single-use magic-link token and email it. Safe to expose on the
   * public internet: layered Redis limits guard the send path and every
   * outcome (sent, throttled, honeypotted, provider-capped) is
   * non-enumerating — this method returns void and the controller always
   * answers 200 (short-window limits throw 429 before we reach a send).
   *
   * @param email  normalised recipient address
   * @param ip     client IP (already resolved via Express trust-proxy)
   * @param honeypot  the hidden `website` form field — non-empty ⇒ a bot
   */
  async requestMagicLink(
    email: string,
    ip: string,
    honeypot?: string,
  ): Promise<void> {
    // Honeypot: a real client leaves this empty. Detected bots get the same
    // generic success with no send — never reveal detection. Bump a counter
    // for observability and stop before touching the rate-limit budget.
    if (honeypot && honeypot.trim().length > 0) {
      await this.rateLimit.tryConsume("metric:magic-link:honeypot", {
        max: Number.MAX_SAFE_INTEGER,
        windowSeconds: 24 * 60 * 60,
        message: "",
      });
      return;
    }

    // Short-window + daily caps, per email and per IP. Each throws 429 on
    // exceed (generic message); the controller never distinguishes them.
    await this.rateLimit.consume(
      `throttle:magic-link:${email}`,
      this.limits.magicLink,
    );
    await this.rateLimit.consume(
      `throttle:magic-link:ip:${ip}`,
      this.limits.magicLinkIp,
    );
    await this.rateLimit.consume(
      `throttle:magic-link:daily:${email}`,
      this.limits.magicLinkEmailDaily,
    );
    await this.rateLimit.consume(
      `throttle:magic-link:ip:daily:${ip}`,
      this.limits.magicLinkIpDaily,
    );

    // Global daily cap protects the SMTP provider quota: once reached we
    // silently skip the send (200, no 429) and warn so ops can react.
    const withinGlobalBudget = await this.rateLimit.tryConsume(
      "throttle:magic-link:global:daily",
      this.limits.magicLinkGlobalDaily,
    );
    if (!withinGlobalBudget) {
      this.logger.warn(
        `magic-link global daily cap reached (${this.limits.magicLinkGlobalDaily.max}/24h) — skipping send`,
      );
      return;
    }

    const raw = randomBytes(32).toString("base64url");
    await this.prisma.loginToken.create({
      data: {
        email,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      },
    });

    const link = `${loadEnv().API_URL}/auth/magic-link/verify?token=${raw}`;
    await this.mail.sendMagicLink(email, link);
  }

  /**
   * Consume a magic-link token (single-use, 15-min TTL) and return the
   * upserted user. 401 for unknown/reused tokens, 410 for expired ones.
   */
  async verifyMagicLink(rawToken: string): Promise<User> {
    const token = await this.prisma.loginToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!token || token.consumedAt) {
      throw new UnauthorizedException("Invalid or already-used sign-in link");
    }
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new GoneException("Sign-in link expired");
    }

    await this.prisma.loginToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    return this.prisma.user.upsert({
      where: { email: token.email },
      update: {},
      create: {
        email: token.email,
        displayName: displayNameFromEmail(token.email),
      },
    });
  }

  /** Find or create a user from a verified Google profile. */
  async upsertGoogleUser(profile: {
    providerAccountId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<User> {
    const account = await this.prisma.oauthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    if (account) return account.user;

    // Fallback-link by verified email, creating the user if needed.
    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: { avatarUrl: profile.avatarUrl ?? undefined },
      create: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
    await this.prisma.oauthAccount.create({
      data: {
        userId: user.id,
        provider: "google",
        providerAccountId: profile.providerAccountId,
      },
    });
    return user;
  }

  /** Current user shaped for the shared MeResponse contract, or null. */
  async me(userId: string): Promise<MeResponse | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? toMeResponse(user) : null;
  }
}

export function toMeResponse(user: User): MeResponse {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isPublic: user.isPublic,
  };
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.length > 0 ? local : "Traveller";
}
