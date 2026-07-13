import request from "supertest";

import {
  type TestContext,
  createTestContext,
  login,
  resetState,
} from "./utils";

describe("CSRF guard (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects POST /auth/magic-link without X-Requested-With", async () => {
    await request(ctx.server)
      .post("/auth/magic-link")
      .send({ email: "csrf@example.com" })
      .expect(403);
  });

  it("rejects a wrong X-Requested-With value", async () => {
    await request(ctx.server)
      .post("/auth/magic-link")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ email: "csrf@example.com" })
      .expect(403);
  });

  it("rejects authenticated mutations without the header", async () => {
    const session = await login(ctx, "csrf-auth@example.com");

    await request(ctx.server)
      .patch("/me")
      .set("Cookie", `access_token=${session.accessToken}`)
      .send({ username: "csrf_victim" })
      .expect(403);

    await request(ctx.server)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(403);

    await request(ctx.server)
      .post("/auth/logout")
      .set("Cookie", `access_token=${session.accessToken}`)
      .expect(403);
  });

  it("leaves safe methods alone", async () => {
    await request(ctx.server).get("/healthz").expect(200);
    await request(ctx.server).get("/auth/providers").expect(200);
    await request(ctx.server).get("/auth/me").expect(401); // auth, not CSRF
  });

  it("reports google:false without credentials (providers endpoint)", async () => {
    const res = await request(ctx.server).get("/auth/providers").expect(200);
    expect(res.body).toEqual({ google: false, magicLink: true });
  });
});
