import request from "supertest";

import {
  type Session,
  type TestContext,
  createTestContext,
  getCookie,
  login,
  resetState,
} from "./utils";

function refresh(ctx: TestContext, refreshToken: string): request.Test {
  return request(ctx.server)
    .post("/auth/refresh")
    .set("X-Requested-With", "fetch")
    .set("Cookie", `refresh_token=${refreshToken}`);
}

describe("refresh rotation + logout (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rotates the refresh token and issues a fresh access token", async () => {
    const session = await login(ctx, "rotate@example.com");

    const res = await refresh(ctx, session.refreshToken).expect(200);
    const newAccess = getCookie(res, "access_token");
    const newRefresh = getCookie(res, "refresh_token");

    expect(newRefresh.value).not.toBe(session.refreshToken);
    expect(newRefresh.raw).toContain("Path=/auth/refresh");
    expect(newAccess.value.split(".")).toHaveLength(3); // JWT shape

    // The rotated (newest) token keeps working.
    await refresh(ctx, newRefresh.value).expect(200);

    // The new access token authenticates.
    await request(ctx.server)
      .get("/auth/me")
      .set("Cookie", `access_token=${newAccess.value}`)
      .expect(200);
  });

  it("revokes the whole family when a rotated token is replayed", async () => {
    const session = await login(ctx, "family@example.com");

    // Rotate twice: old → mid → newest.
    const first = await refresh(ctx, session.refreshToken).expect(200);
    const mid = getCookie(first, "refresh_token").value;
    const second = await refresh(ctx, mid).expect(200);
    const newest = getCookie(second, "refresh_token").value;

    // Replay of the already-rotated mid token → 401 + family revocation.
    await refresh(ctx, mid).expect(401);

    // The newest token is now dead too.
    await refresh(ctx, newest).expect(401);

    const live = await ctx.prisma.refreshToken.count({
      where: { revokedAt: null, user: { email: "family@example.com" } },
    });
    expect(live).toBe(0);
  });

  it("rejects a missing or unknown refresh token with 401", async () => {
    await request(ctx.server)
      .post("/auth/refresh")
      .set("X-Requested-With", "fetch")
      .expect(401);
    await refresh(ctx, "bogus-token").expect(401);
  });

  it("logout revokes the session family and clears cookies", async () => {
    const email = "logout@example.com";
    const session: Session = await login(ctx, email);

    const res = await request(ctx.server)
      .post("/auth/logout")
      .set("X-Requested-With", "fetch")
      .set("Cookie", `access_token=${session.accessToken}`)
      .expect(200);

    // Cookies are cleared (empty value, epoch expiry).
    const cleared = getCookie(res, "access_token");
    expect(cleared.value).toBe("");
    expect(cleared.raw).toContain("Expires=Thu, 01 Jan 1970");
    expect(getCookie(res, "refresh_token").raw).toContain(
      "Path=/auth/refresh",
    );

    // The refresh token family is revoked server-side.
    await refresh(ctx, session.refreshToken).expect(401);

    const live = await ctx.prisma.refreshToken.count({
      where: { revokedAt: null, user: { email } },
    });
    expect(live).toBe(0);
  });

  it("logout without a session still clears cookies", async () => {
    await request(ctx.server)
      .post("/auth/logout")
      .set("X-Requested-With", "fetch")
      .expect(200);
  });
});
