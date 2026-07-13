import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";

import { CsrfGuard } from "./common/csrf.guard";
import { loadEnv } from "./config/env";
import { MailModule } from "./mail/mail.module";
import { GlobalRateLimitGuard } from "./rate-limit/global-rate-limit.guard";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { FollowsModule } from "./modules/follows/follows.module";
import { HealthModule } from "./modules/health/health.module";
import { StatsModule } from "./modules/stats/stats.module";
import { UsersModule } from "./modules/users/users.module";
import { VisitsModule } from "./modules/visits/visits.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: loadEnv().JWT_SECRET,
        signOptions: { expiresIn: "15m" },
      }),
    }),
    PrismaModule,
    RedisModule,
    RateLimitModule,
    MailModule,
    HealthModule,
    AuthModule,
    // Before UsersModule: `GET /users/search` must win over the
    // `GET /users/:username` catch-all ("search" is a valid handle).
    FollowsModule,
    UsersModule,
    VisitsModule,
    StatsModule,
  ],
  providers: [
    // Guards run in registration order: rate-limit first (cheap, applies
    // to everything), then the custom-header CSRF check on mutations.
    { provide: APP_GUARD, useClass: GlobalRateLimitGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
