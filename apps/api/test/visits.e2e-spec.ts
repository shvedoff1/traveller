import request from "supertest";

import {
  type Session,
  type TestContext,
  createTestContext,
  login,
  resetState,
} from "./utils";

const CURRENT_YEAR = new Date().getFullYear();

describe("visits (e2e)", () => {
  let ctx: TestContext;
  let session: Session;

  const authed = (method: "get" | "put" | "delete", path: string) => {
    const test = request(ctx.server)[method](path);
    return test
      .set("X-Requested-With", "fetch")
      .set("Cookie", `access_token=${session.accessToken}`);
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
    session = await login(ctx, "traveller@example.com");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("PUT /me/visits/:countryCode", () => {
    it("creates a visit, then updates it in place (idempotent upsert)", async () => {
      const created = await authed("put", "/api/me/visits/FR")
        .send({})
        .expect(200);
      expect(created.body).toEqual({
        countryCode: "FR",
        visitedYear: null,
        note: null,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });

      const updated = await authed("put", "/api/me/visits/FR")
        .send({ visitedYear: 2019, note: "Paris in spring" })
        .expect(200);
      expect(updated.body).toEqual({
        countryCode: "FR",
        visitedYear: 2019,
        note: "Paris in spring",
        createdAt: created.body.createdAt, // first mark sticks
      });

      // Still a single row for the pair.
      const list = await authed("get", "/api/me/visits").expect(200);
      expect(list.body).toEqual([updated.body]);
    });

    it("replaces year/note on PUT — omitted fields clear", async () => {
      await authed("put", "/api/me/visits/JP")
        .send({ visitedYear: 2020, note: "Tokyo" })
        .expect(200);
      const res = await authed("put", "/api/me/visits/JP").send({}).expect(200);
      expect(res.body.visitedYear).toBeNull();
      expect(res.body.note).toBeNull();
    });

    it("normalises lowercase codes to uppercase", async () => {
      const res = await authed("put", "/api/me/visits/br").send({}).expect(200);
      expect(res.body.countryCode).toBe("BR");
    });

    it("rejects unknown country codes with 400", async () => {
      await authed("put", "/api/me/visits/ZZ").send({}).expect(400);
      await authed("put", "/api/me/visits/FRA").send({}).expect(400);
      await authed("put", "/api/me/visits/XK").send({}).expect(400); // not ISO
    });

    it("rejects invalid years with 400", async () => {
      await authed("put", "/api/me/visits/FR")
        .send({ visitedYear: 1899 })
        .expect(400);
      await authed("put", "/api/me/visits/FR")
        .send({ visitedYear: CURRENT_YEAR + 1 })
        .expect(400);
      await authed("put", "/api/me/visits/FR")
        .send({ visitedYear: "2019" })
        .expect(400);
    });

    it("rejects over-long notes and unknown keys with 400", async () => {
      await authed("put", "/api/me/visits/FR")
        .send({ note: "x".repeat(281) })
        .expect(400);
      await authed("put", "/api/me/visits/FR")
        .send({ countryCode: "FR" })
        .expect(400);
    });
  });

  describe("DELETE /me/visits/:countryCode", () => {
    it("deletes idempotently — 204 even when absent", async () => {
      await authed("put", "/api/me/visits/DE").send({}).expect(200);
      await authed("delete", "/api/me/visits/DE").expect(204);
      await authed("delete", "/api/me/visits/DE").expect(204); // already gone

      const list = await authed("get", "/api/me/visits").expect(200);
      const codes = list.body.map((v: { countryCode: string }) => v.countryCode);
      expect(codes).not.toContain("DE");
    });

    it("rejects unknown country codes with 400", async () => {
      await authed("delete", "/api/me/visits/ZZ").expect(400);
    });
  });

  describe("GET /me/visits", () => {
    it("round-trips the full list, sorted by country code", async () => {
      const fresh = await login(ctx, "roundtrip@example.com");
      const put = (code: string, body: object) =>
        request(ctx.server)
          .put(`/api/me/visits/${code}`)
          .set("X-Requested-With", "fetch")
          .set("Cookie", `access_token=${fresh.accessToken}`)
          .send(body)
          .expect(200);

      await put("JP", { visitedYear: 2018, note: "Cherry blossoms" });
      await put("AR", {});
      await put("FR", { visitedYear: 2023 });

      const res = await request(ctx.server)
        .get("/api/me/visits")
        .set("Cookie", `access_token=${fresh.accessToken}`)
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ countryCode: "AR", visitedYear: null }),
        expect.objectContaining({ countryCode: "FR", visitedYear: 2023 }),
        expect.objectContaining({
          countryCode: "JP",
          visitedYear: 2018,
          note: "Cherry blossoms",
        }),
      ]);
    });

    it("does not leak other users' visits", async () => {
      const stranger = await login(ctx, "stranger@example.com");
      const res = await request(ctx.server)
        .get("/api/me/visits")
        .set("Cookie", `access_token=${stranger.accessToken}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("auth and CSRF", () => {
    it("returns 401 without a session on every route", async () => {
      await request(ctx.server).get("/api/me/visits").expect(401);
      await request(ctx.server)
        .put("/api/me/visits/FR")
        .set("X-Requested-With", "fetch")
        .send({})
        .expect(401);
      await request(ctx.server)
        .delete("/api/me/visits/FR")
        .set("X-Requested-With", "fetch")
        .expect(401);
    });

    it("rejects mutations without the CSRF header", async () => {
      await request(ctx.server)
        .put("/api/me/visits/FR")
        .set("Cookie", `access_token=${session.accessToken}`)
        .send({})
        .expect(403);
    });
  });
});
