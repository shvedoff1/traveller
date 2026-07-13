import request from "supertest";

import { DEFAULT_RATE_LIMITS } from "../src/rate-limit/rate-limit.constants";
import {
  type TestContext,
  createTestContext,
  resetState,
} from "./utils";

/** POST /auth/magic-link for a fresh address (honeypot optional). */
function post(
  ctx: TestContext,
  body: { email: string; website?: string },
): request.Test {
  return request(ctx.server)
    .post("/auth/magic-link")
    .set("X-Requested-With", "fetch")
    .send(body);
}

/**
 * Anti-abuse hardening (task 09): the layered magic-link limits, honeypot,
 * and provider-quota guard — all exercised end-to-end with the specific
 * layer overridden down through the RATE_LIMITS provider. Responses stay
 * non-enumerating throughout (same 200 body; generic 429s).
 */
describe("magic-link anti-abuse (e2e)", () => {
  describe("per-IP short window", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestContext({
        magicLinkIp: { ...DEFAULT_RATE_LIMITS.magicLinkIp, max: 5 },
      });
    });
    beforeEach(async () => resetState(ctx));
    afterAll(async () => ctx.app.close());

    it("429s the 6th request from one IP, across different addresses", async () => {
      // Distinct emails so the per-email cap (3) never binds first — the IP
      // is the shared dimension here.
      for (let i = 0; i < 5; i += 1) {
        await post(ctx, { email: `ip-${i}@example.com` }).expect(200);
      }
      const blocked = await post(ctx, { email: "ip-6@example.com" }).expect(
        429,
      );
      expect(blocked.body.message).toBe(DEFAULT_RATE_LIMITS.magicLinkIp.message);
    });
  });

  describe("per-email daily cap (pre-seeded counter)", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestContext({
        magicLinkEmailDaily: {
          ...DEFAULT_RATE_LIMITS.magicLinkEmailDaily,
          max: 10,
        },
      });
    });
    beforeEach(async () => resetState(ctx));
    afterAll(async () => ctx.app.close());

    it("429s once the day's per-email budget is spent", async () => {
      const email = "daily-capped@example.com";
      await ctx.redis.set(`throttle:magic-link:daily:${email}`, "10");

      await post(ctx, { email }).expect(429);
      // A different address is unaffected by another's daily budget.
      await post(ctx, { email: "fresh@example.com" }).expect(200);
    });
  });

  describe("per-IP daily cap", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestContext({
        // Keep the short window loose so the daily cap is what binds.
        magicLinkIp: { ...DEFAULT_RATE_LIMITS.magicLinkIp, max: 1000 },
        magicLinkIpDaily: {
          ...DEFAULT_RATE_LIMITS.magicLinkIpDaily,
          max: 3,
        },
      });
    });
    beforeEach(async () => resetState(ctx));
    afterAll(async () => ctx.app.close());

    it("429s beyond the day's per-IP budget", async () => {
      for (let i = 0; i < 3; i += 1) {
        await post(ctx, { email: `ipday-${i}@example.com` }).expect(200);
      }
      const blocked = await post(ctx, {
        email: "ipday-4@example.com",
      }).expect(429);
      expect(blocked.body.message).toBe(
        DEFAULT_RATE_LIMITS.magicLinkIpDaily.message,
      );
    });
  });

  describe("global daily cap (provider quota)", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestContext({
        magicLinkGlobalDaily: {
          ...DEFAULT_RATE_LIMITS.magicLinkGlobalDaily,
          max: 200,
        },
      });
    });
    beforeEach(async () => resetState(ctx));
    afterAll(async () => ctx.app.close());

    it("returns a generic 200 but skips the send once the cap is reached", async () => {
      await ctx.redis.set("throttle:magic-link:global:daily", "200");
      const before = ctx.mailbox.length;

      const res = await post(ctx, { email: "capped@example.com" }).expect(200);
      expect(res.body).toEqual({ ok: true });
      // No 429, no enumeration — and crucially no mail sent.
      expect(ctx.mailbox.length).toBe(before);
    });
  });

  describe("honeypot", () => {
    let ctx: TestContext;
    beforeAll(async () => {
      ctx = await createTestContext();
    });
    beforeEach(async () => resetState(ctx));
    afterAll(async () => ctx.app.close());

    it("returns the same 200 with no mail when the website field is filled", async () => {
      const before = ctx.mailbox.length;
      const res = await post(ctx, {
        email: "bot@example.com",
        website: "http://spam.example",
      }).expect(200);

      expect(res.body).toEqual({ ok: true });
      expect(ctx.mailbox.length).toBe(before);
      expect(await ctx.redis.get("metric:magic-link:honeypot")).toBe("1");
    });

    it("still sends for a legit request (empty honeypot)", async () => {
      const res = await post(ctx, {
        email: "human@example.com",
        website: "",
      }).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(ctx.mailbox.at(-1)?.to).toBe("human@example.com");
    });
  });
});
