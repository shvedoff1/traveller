import { Module } from "@nestjs/common";

import { loadEnv } from "../../config/env";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {
  GoogleAuthGuard,
  GoogleCallbackGuard,
  GoogleController,
} from "./google.controller";
import { GoogleStrategy } from "./google.strategy";
import { TokenService } from "./token.service";

// Google OAuth is optional: dev/CI have no credentials, so the strategy,
// guards and /auth/google routes only exist when GOOGLE_CLIENT_ID is set.
const googleEnabled = (): boolean => Boolean(loadEnv().GOOGLE_CLIENT_ID);

@Module({
  controllers: [AuthController, ...(googleEnabled() ? [GoogleController] : [])],
  providers: [
    AuthService,
    TokenService,
    ...(googleEnabled()
      ? [GoogleStrategy, GoogleAuthGuard, GoogleCallbackGuard]
      : []),
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
