import request from "supertest";

import {
  type Session,
  type TestContext,
  createTestContext,
  login,
  resetState,
} from "./utils";

/** Authenticated request helpers with the CSRF header set. */
function asUser(ctx: TestContext, session: Session) {
  return {
    patchMe: (body: object) =>
      request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${session.accessToken}`)
        .send(body),
    putVisit: (code: string, body: object = {}) =>
      request(ctx.server)
        .put(`/me/visits/${code}`)
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${session.accessToken}`)
        .send(body),
    deleteVisit: (code: string) =>
      request(ctx.server)
        .delete(`/me/visits/${code}`)
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${session.accessToken}`),
  };
}

describe("public profile cache (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("cache-aside reads", () => {
    it("caches the profile for 60s and serves the cached copy", async () => {
      const user = await ctx.prisma.user.create({
        data: {
          email: "cached@example.com",
          displayName: "Cached",
          username: "cached_user",
          visitedCountries: { create: [{ countryCode: "FR" }] },
        },
      });

      const first = await request(ctx.server)
        .get("/users/cached_user")
        .expect(200);
      expect(first.body.counts.countries).toBe(1);

      // The read populated the JSON cache with a ≤60s TTL.
      const ttl = await ctx.redis.ttl("profile:cached_user");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      // Mutate the DB directly (bypassing the API): the cached copy is
      // served, so the response stays stale — proof the DB wasn't hit.
      await ctx.prisma.visitedCountry.create({
        data: { userId: user.id, countryCode: "JP" },
      });
      const second = await request(ctx.server)
        .get("/users/cached_user")
        .expect(200);
      expect(second.body.counts.countries).toBe(1);
      expect(second.body.countryCodes).toEqual(["FR"]);

      // Dropping the key forces the next read back to the DB.
      await ctx.redis.del("profile:cached_user");
      const third = await request(ctx.server)
        .get("/users/cached_user")
        .expect(200);
      expect(third.body.countryCodes).toEqual(["FR", "JP"]);
    });

    it("caches stats under stats:{username} the same way", async () => {
      const user = await ctx.prisma.user.create({
        data: {
          email: "stats-cached@example.com",
          displayName: "Stats Cached",
          username: "stats_cached",
          visitedCountries: { create: [{ countryCode: "BR" }] },
        },
      });

      const first = await request(ctx.server)
        .get("/users/stats_cached/stats")
        .expect(200);
      expect(first.body.countryCount).toBe(1);

      const ttl = await ctx.redis.ttl("stats:stats_cached");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      await ctx.prisma.visitedCountry.create({
        data: { userId: user.id, countryCode: "AR" },
      });
      const second = await request(ctx.server)
        .get("/users/stats_cached/stats")
        .expect(200);
      expect(second.body.countryCount).toBe(1); // stale = cache hit

      await ctx.redis.del("stats:stats_cached");
      const third = await request(ctx.server)
        .get("/users/stats_cached/stats")
        .expect(200);
      expect(third.body.countryCount).toBe(2);
    });

    it("does not cache 404s", async () => {
      await request(ctx.server).get("/users/ghost_user").expect(404);
      expect(await ctx.redis.exists("profile:ghost_user")).toBe(0);

      // The user appears afterwards and resolves immediately.
      await ctx.prisma.user.create({
        data: {
          email: "ghost@example.com",
          displayName: "Ghost",
          username: "ghost_user",
        },
      });
      await request(ctx.server).get("/users/ghost_user").expect(200);
    });
  });

  describe("invalidation on visit writes", () => {
    it("PUT /me/visits refreshes the cached profile and stats immediately", async () => {
      const session = await login(ctx, "marker@example.com");
      const me = asUser(ctx, session);
      await me.patchMe({ username: "marker" }).expect(200);

      // Prime both caches.
      const before = await request(ctx.server).get("/users/marker").expect(200);
      expect(before.body.countryCodes).toEqual([]);
      const statsBefore = await request(ctx.server)
        .get("/users/marker/stats")
        .expect(200);
      expect(statsBefore.body.countryCount).toBe(0);

      await me.putVisit("DE", { visitedYear: 2024 }).expect(200);

      const after = await request(ctx.server).get("/users/marker").expect(200);
      expect(after.body.countryCodes).toEqual(["DE"]);
      const statsAfter = await request(ctx.server)
        .get("/users/marker/stats")
        .expect(200);
      expect(statsAfter.body.countryCount).toBe(1);
      expect(statsAfter.body.continents["Europe"].visited).toBe(1);
    });

    it("DELETE /me/visits refreshes the cached profile immediately", async () => {
      const session = await login(ctx, "unmarker@example.com");
      const me = asUser(ctx, session);
      await me.patchMe({ username: "unmarker" }).expect(200);
      await me.putVisit("JP").expect(200);

      const before = await request(ctx.server)
        .get("/users/unmarker")
        .expect(200);
      expect(before.body.countryCodes).toEqual(["JP"]);

      await me.deleteVisit("JP").expect(204);

      const after = await request(ctx.server)
        .get("/users/unmarker")
        .expect(200);
      expect(after.body.countryCodes).toEqual([]);
      const stats = await request(ctx.server)
        .get("/users/unmarker/stats")
        .expect(200);
      expect(stats.body.countryCount).toBe(0);
    });
  });

  describe("invalidation on PATCH /me", () => {
    it("drops the old username's keys on a username change", async () => {
      const session = await login(ctx, "renamed@example.com");
      const me = asUser(ctx, session);
      await me.patchMe({ username: "old_handle" }).expect(200);

      // Prime the cache for the old handle.
      await request(ctx.server).get("/users/old_handle").expect(200);
      await request(ctx.server).get("/users/old_handle/stats").expect(200);
      expect(await ctx.redis.exists("profile:old_handle")).toBe(1);
      expect(await ctx.redis.exists("stats:old_handle")).toBe(1);

      await me.patchMe({ username: "new_handle" }).expect(200);

      // Old keys are gone — the stale handle 404s instead of serving cache.
      expect(await ctx.redis.exists("profile:old_handle")).toBe(0);
      expect(await ctx.redis.exists("stats:old_handle")).toBe(0);
      await request(ctx.server).get("/users/old_handle").expect(404);
      await request(ctx.server).get("/users/old_handle/stats").expect(404);

      const renamed = await request(ctx.server)
        .get("/users/new_handle")
        .expect(200);
      expect(renamed.body.username).toBe("new_handle");
    });

    it("reflects a displayName change immediately", async () => {
      const session = await login(ctx, "displayer@example.com");
      const me = asUser(ctx, session);
      await me.patchMe({ username: "displayer" }).expect(200);

      const before = await request(ctx.server)
        .get("/users/displayer")
        .expect(200);
      expect(before.body.displayName).not.toBe("Fresh Name");

      await me.patchMe({ displayName: "Fresh Name" }).expect(200);

      const after = await request(ctx.server)
        .get("/users/displayer")
        .expect(200);
      expect(after.body.displayName).toBe("Fresh Name");
    });
  });
});
