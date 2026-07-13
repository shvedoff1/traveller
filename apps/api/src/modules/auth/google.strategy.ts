import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { type User } from "@prisma/client";
import { type Profile, Strategy } from "passport-google-oauth20";

import { loadEnv } from "../../config/env";
import { AuthService } from "./auth.service";

/**
 * Google OAuth strategy. Only registered by AuthModule when
 * GOOGLE_CLIENT_ID is set — dev/CI run without it.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly authService: AuthService) {
    const env = loadEnv();
    super({
      clientID: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      callbackURL:
        env.OAUTH_CALLBACK_URL ?? `${env.API_URL}/auth/google/callback`,
      scope: ["openid", "email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const emails = (profile.emails ?? []) as {
      value: string;
      verified?: boolean | string;
    }[];
    const verified = emails.find(
      (entry) => entry.verified === true || entry.verified === "true",
    );
    const email = (verified ?? emails[0])?.value;
    if (!email) {
      throw new UnauthorizedException("Google account has no usable email");
    }

    return this.authService.upsertGoogleUser({
      providerAccountId: profile.id,
      email: email.toLowerCase(),
      displayName: profile.displayName || (email.split("@")[0] ?? email),
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
