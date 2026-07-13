import { randomBytes, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type User } from "@prisma/client";

import { type AccessTokenPayload } from "../../common/auth.types";
import { REFRESH_TOKEN_TTL_MS } from "../../common/cookies";
import { PrismaService } from "../../prisma/prisma.service";
import { decideRefresh, hashToken } from "./refresh-token.logic";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  familyId: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Access JWT: 15 min, payload `{ sub, username, fid }`. */
  signAccessToken(user: Pick<User, "id" | "username">, familyId: string): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      fid: familyId,
    };
    return this.jwtService.sign(payload);
  }

  /** Start a new session: fresh refresh-token family + access JWT. */
  async issueSession(
    user: Pick<User, "id" | "username">,
    userAgent?: string,
  ): Promise<SessionTokens> {
    const familyId = randomUUID();
    const refreshToken = await this.createRefreshToken(
      user.id,
      familyId,
      userAgent,
    );
    return {
      accessToken: this.signAccessToken(user, familyId),
      refreshToken,
      familyId,
    };
  }

  /**
   * Rotate a refresh token within its family. Replaying an already-rotated
   * token revokes the entire family (stolen-token containment).
   */
  async rotateSession(
    rawRefreshToken: string,
    userAgent?: string,
  ): Promise<SessionTokens & { user: User }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawRefreshToken) },
      include: { user: true },
    });

    const decision = decideRefresh(stored);
    if (decision.action === "revoke_family" && stored) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    if (decision.action !== "rotate" || !stored) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const [, refreshToken] = await Promise.all([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.createRefreshToken(stored.userId, stored.familyId, userAgent),
    ]);

    return {
      accessToken: this.signAccessToken(stored.user, stored.familyId),
      refreshToken,
      familyId: stored.familyId,
      user: stored.user,
    };
  }

  /** Revoke every live token in a family (logout / reuse detection). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
    userAgent?: string,
  ): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent: userAgent ?? null,
      },
    });
    return raw;
  }
}
