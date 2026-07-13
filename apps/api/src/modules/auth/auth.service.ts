import { randomBytes } from "node:crypto";

import {
  GoneException,
  Inject,
  Injectable,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
    @Inject(RATE_LIMITS) private readonly limits: RateLimits,
  ) {}

  /**
   * Create a single-use magic-link token and email it. Throttled to
   * 3 requests per 15 minutes per email (Redis). Never reveals whether
   * the address has an account.
   */
  async requestMagicLink(email: string): Promise<void> {
    await this.rateLimit.consume(
      `throttle:magic-link:${email}`,
      this.limits.magicLink,
    );

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
