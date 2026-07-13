import request from "supertest";

import { hashToken } from "../src/modules/auth/refresh-token.logic";
import {
  type TestContext,
  createTestContext,
  getCookie,
  requestMagicLinkToken,
  resetState,
} from "./utils";

describe("magic link (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("logs in end to end: request → mail → verify → cookies → /auth/me", async () => {
    const email = "happy@example.com";

    const requestRes = await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "fetch")
      .send({ email })
      .expect(200);
    expect(requestRes.body).toEqual({ ok: true });

    const mail = ctx.mailbox.at(-1);
    expect(mail?.to).toBe(email);
    expect(mail?.link).toContain("/auth/magic-link/verify?token=");
    const token = new URL(mail?.link ?? "").searchParams.get("token") ?? "";
    expect(token.length).toBeGreaterThan(0);

    const verifyRes = await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token })
      .expect(302);

    // New user has no username yet → onboarding.
    expect(verifyRes.headers.location).toBe("http://localhost:3000/welcome");

    const accessCookie = getCookie(verifyRes, "access_token");
    const refreshCookie = getCookie(verifyRes, "refresh_token");
    expect(accessCookie.raw).toContain("HttpOnly");
    expect(accessCookie.raw).toContain("Path=/");
    expect(accessCookie.raw).toContain("SameSite=Lax");
    expect(refreshCookie.raw).toContain("HttpOnly");
    expect(refreshCookie.raw).toContain("Path=/auth/refresh");

    const meRes = await request(ctx.server)
      .get("/auth/me")
      .set("Cookie", `access_token=${accessCookie.value}`)
      .expect(200);
    expect(meRes.body).toMatchObject({
      email,
      username: null,
      displayName: "happy",
      isPublic: true,
    });
  });

  it("normalises the email address (case/whitespace)", async () => {
    await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "fetch")
      .send({ email: "  Mixed.Case@Example.COM " })
      .expect(200);
    expect(ctx.mailbox.at(-1)?.to).toBe("mixed.case@example.com");
  });

  it("redirects straight to / when the user already has a username", async () => {
    const email = "named@example.com";
    await ctx.prisma.user.create({
      data: { email, displayName: "Named", username: "named" },
    });

    const token = await requestMagicLinkToken(ctx, email);
    const res = await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token })
      .expect(302);
    expect(res.headers.location).toBe("http://localhost:3000/");
  });

  it("rejects a bad email with 400", async () => {
    await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "fetch")
      .send({ email: "not-an-email" })
      .expect(400);
  });

  it("rejects an expired token with 410", async () => {
    const email = "expired@example.com";
    const token = await requestMagicLinkToken(ctx, email);
    await ctx.prisma.loginToken.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token })
      .expect(410);
  });

  it("rejects a reused token with 401", async () => {
    const email = "reused@example.com";
    const token = await requestMagicLinkToken(ctx, email);

    await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token })
      .expect(302);
    await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token })
      .expect(401);
  });

  it("rejects an unknown token with 401", async () => {
    await request(ctx.server)
      .get("/auth/magic-link/verify")
      .query({ token: "definitely-not-a-real-token" })
      .expect(401);

    await request(ctx.server).get("/auth/magic-link/verify").expect(401);
  });

  it("throttles the 4th request within 15 minutes with 429", async () => {
    const email = "throttled@example.com";
    for (let i = 0; i < 3; i += 1) {
      await request(ctx.server)
        .post("/auth/magic-link")
        .set("X-Requested-With", "fetch")
        .send({ email })
        .expect(200);
    }

    await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "fetch")
      .send({ email })
      .expect(429);

    // Other addresses are unaffected.
    await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "fetch")
      .send({ email: "someone-else@example.com" })
      .expect(200);
  });
});
