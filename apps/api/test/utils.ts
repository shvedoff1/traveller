import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import type Redis from "ioredis";
import request from "supertest";
import { type App } from "supertest/types";

import { MailService } from "../src/mail/mail.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  DEFAULT_RATE_LIMITS,
  RATE_LIMITS,
  type RateLimits,
} from "../src/rate-limit/rate-limit.constants";
import { REDIS_CLIENT } from "../src/redis/redis.module";
import { AppModule } from "../src/app.module";

export interface CapturedMail {
  to: string;
  link: string;
}

export interface TestContext {
  app: INestApplication;
  server: App;
  prisma: PrismaService;
  redis: Redis;
  /** Every magic-link email the API "sent", newest last. */
  mailbox: CapturedMail[];
}

/**
 * Boot the full AppModule against the real test Postgres/Redis, with the
 * SMTP mail transport replaced by an in-memory capture (the spec's
 * "intercept mail service" option — CI has no Mailpit).
 *
 * The global per-IP limit is raised by default (every suite shares
 * supertest's 127.0.0.1, which would trip the production 100/min budget);
 * rate-limit.e2e-spec.ts overrides it back down to test the guard itself.
 */
export async function createTestContext(
  rateLimits: Partial<RateLimits> = {},
): Promise<TestContext> {
  const mailbox: CapturedMail[] = [];

  // Every suite shares supertest's 127.0.0.1, so the per-IP + global
  // magic-link caps would trip across unrelated logins. Raise them (and the
  // global request budget) by default; the dedicated suites override the
  // specific layer they exercise back down to a tiny value.
  const limits: RateLimits = {
    ...DEFAULT_RATE_LIMITS,
    global: { ...DEFAULT_RATE_LIMITS.global, max: 10_000 },
    magicLinkIp: { ...DEFAULT_RATE_LIMITS.magicLinkIp, max: 10_000 },
    magicLinkEmailDaily: {
      ...DEFAULT_RATE_LIMITS.magicLinkEmailDaily,
      max: 10_000,
    },
    magicLinkIpDaily: { ...DEFAULT_RATE_LIMITS.magicLinkIpDaily, max: 10_000 },
    magicLinkGlobalDaily: {
      ...DEFAULT_RATE_LIMITS.magicLinkGlobalDaily,
      max: 10_000,
    },
    ...rateLimits,
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({
      sendMagicLink: async (to: string, link: string): Promise<void> => {
        mailbox.push({ to, link });
      },
    })
    .overrideProvider(RATE_LIMITS)
    .useValue(limits)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser()); // matches main.ts middleware
  app.setGlobalPrefix("api", { exclude: ["healthz"] }); // matches main.ts
  await app.init();

  return {
    app,
    server: app.getHttpServer() as App,
    prisma: app.get(PrismaService),
    redis: app.get<Redis>(REDIS_CLIENT),
    mailbox,
  };
}

/** Wipe all rows and throttle keys between suites. */
export async function resetState(ctx: TestContext): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Follow", "VisitedCountry", "RefreshToken", "LoginToken", "OauthAccount", "User" CASCADE',
  );
  await ctx.redis.flushdb();
}

export interface SetCookie {
  value: string;
  raw: string;
}

/** Parsed Set-Cookie entries keyed by cookie name. */
export function parseSetCookies(
  res: request.Response,
): Record<string, SetCookie> {
  const header = (res.headers["set-cookie"] ?? []) as unknown as string[];
  const cookies: Record<string, SetCookie> = {};
  for (const raw of header) {
    const pair = raw.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    cookies[pair.slice(0, eq)] = { value: pair.slice(eq + 1), raw };
  }
  return cookies;
}

/** A named Set-Cookie entry — fails the test if absent. */
export function getCookie(res: request.Response, name: string): SetCookie {
  const cookie = parseSetCookies(res)[name];
  if (!cookie) {
    throw new Error(`Expected Set-Cookie for "${name}" in response`);
  }
  return cookie;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}

/** Request a magic link for `email` and return the raw token from the mail. */
export async function requestMagicLinkToken(
  ctx: TestContext,
  email: string,
): Promise<string> {
  await request(ctx.server)
    .post("/api/auth/magic-link")
    .set("X-Requested-With", "fetch")
    .send({ email })
    .expect(200);
  const mail = ctx.mailbox.at(-1);
  if (!mail) throw new Error("No magic-link mail captured");
  const token = new URL(mail.link).searchParams.get("token");
  if (!token) throw new Error(`No token in link: ${mail.link}`);
  return token;
}

/** Full magic-link login; returns the auth cookies. */
export async function login(
  ctx: TestContext,
  email: string,
): Promise<Session> {
  const token = await requestMagicLinkToken(ctx, email);
  const res = await request(ctx.server)
    .get("/api/auth/magic-link/verify")
    .query({ token })
    .expect(302);
  return {
    accessToken: getCookie(res, "access_token").value,
    refreshToken: getCookie(res, "refresh_token").value,
  };
}
