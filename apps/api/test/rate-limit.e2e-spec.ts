import request from "supertest";

import { DEFAULT_RATE_LIMITS } from "../src/rate-limit/rate-limit.constants";
import {
  type TestContext,
  createTestContext,
  login,
  resetState,
} from "./utils";

/**
 * Rate-limit hardening (task 06): the global per-IP guard and the
 * per-user visits-write budget, exercised end-to-end with tiny limits
 * overridden through the RATE_LIMITS provider.
 */
describe("rate limits (e2e)", () => {
  describe("global per-IP guard", () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await createTestContext({
        global: { ...DEFAULT_RATE_LIMITS.global, max: 5 },
      });
    });

    beforeEach(async () => {
      await resetState(ctx);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it("429s once an IP exceeds its budget, on any route", async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(ctx.server).get("/api/auth/providers").expect(200);
      }
      const blocked = await request(ctx.server)
        .get("/api/auth/providers")
        .expect(429);
      expect(blocked.body.message).toBe(DEFAULT_RATE_LIMITS.global.message);

      // Applies across routes — the same IP is blocked everywhere…
      await request(ctx.server).get("/api/me/visits").expect(429);
    });

    it("never limits the health check", async () => {
      for (let i = 0; i < 7; i += 1) {
        await request(ctx.server).get("/api/auth/providers");
      }
      await request(ctx.server).get("/healthz").expect(200);
    });
  });

  describe("visits write budget (per user)", () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await createTestContext({
        visitsWrite: { ...DEFAULT_RATE_LIMITS.visitsWrite, max: 3 },
      });
    });

    beforeEach(async () => {
      await resetState(ctx);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it("shares one PUT/DELETE budget and 429s beyond it", async () => {
      const session = await login(ctx, "writer@example.com");
      const cookies = [
        `access_token=${session.accessToken}`,
        `refresh_token=${session.refreshToken}`,
      ];

      const codes = ["FR", "JP"];
      for (const code of codes) {
        await request(ctx.server)
          .put(`/api/me/visits/${code}`)
          .set("Cookie", cookies)
          .set("X-Requested-With", "fetch")
          .send({})
          .expect(200);
      }
      await request(ctx.server)
        .delete("/api/me/visits/JP")
        .set("Cookie", cookies)
        .set("X-Requested-With", "fetch")
        .expect(204);

      const blocked = await request(ctx.server)
        .put("/api/me/visits/BR")
        .set("Cookie", cookies)
        .set("X-Requested-With", "fetch")
        .send({})
        .expect(429);
      expect(blocked.body.message).toBe(
        DEFAULT_RATE_LIMITS.visitsWrite.message,
      );

      // Reads stay unaffected.
      const list = await request(ctx.server)
        .get("/api/me/visits")
        .set("Cookie", cookies)
        .expect(200);
      expect(list.body).toHaveLength(1);

      // The blocked PUT never landed.
      expect(
        (list.body as Array<{ countryCode: string }>).map(
          (visit) => visit.countryCode,
        ),
      ).toEqual(["FR"]);
    });

    it("budgets are per user", async () => {
      const first = await login(ctx, "first@example.com");
      const firstCookies = [
        `access_token=${first.accessToken}`,
        `refresh_token=${first.refreshToken}`,
      ];
      for (const code of ["FR", "JP", "BR"]) {
        await request(ctx.server)
          .put(`/api/me/visits/${code}`)
          .set("Cookie", firstCookies)
          .set("X-Requested-With", "fetch")
          .send({})
          .expect(200);
      }
      await request(ctx.server)
        .put("/api/me/visits/AR")
        .set("Cookie", firstCookies)
        .set("X-Requested-With", "fetch")
        .send({})
        .expect(429);

      // A different user still has a full budget.
      const second = await login(ctx, "second@example.com");
      await request(ctx.server)
        .put("/api/me/visits/AR")
        .set("Cookie", [
          `access_token=${second.accessToken}`,
          `refresh_token=${second.refreshToken}`,
        ])
        .set("X-Requested-With", "fetch")
        .send({})
        .expect(200);
    });
  });
});
