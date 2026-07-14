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
  const cookie = `access_token=${session.accessToken}`;
  return {
    patchMe: (body: object) =>
      request(ctx.server)
        .patch("/api/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", cookie)
        .send(body),
    follow: (username: string) =>
      request(ctx.server)
        .post(`/api/users/${username}/follow`)
        .set("X-Requested-With", "fetch")
        .set("Cookie", cookie),
    unfollow: (username: string) =>
      request(ctx.server)
        .delete(`/api/users/${username}/follow`)
        .set("X-Requested-With", "fetch")
        .set("Cookie", cookie),
    following: () =>
      request(ctx.server).get("/api/me/following").set("Cookie", cookie),
    followers: () =>
      request(ctx.server).get("/api/me/followers").set("Cookie", cookie),
    friendsMap: () =>
      request(ctx.server).get("/api/me/friends-map").set("Cookie", cookie),
    search: (q: string) =>
      request(ctx.server)
        .get("/api/users/search")
        .query({ q })
        .set("Cookie", cookie),
    profile: (username: string) =>
      request(ctx.server).get(`/api/users/${username}`).set("Cookie", cookie),
  };
}

/** Login and claim a handle in one go. */
async function loginAs(
  ctx: TestContext,
  email: string,
  username: string,
): Promise<Session> {
  const session = await login(ctx, email);
  await asUser(ctx, session).patchMe({ username }).expect(200);
  return session;
}

describe("follows (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(async () => {
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("POST/DELETE /users/:username/follow", () => {
    it("follows a user: following list, follower stats and cache update", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      const maria = await loginAs(ctx, "maria@example.com", "maria");
      await ctx.prisma.visitedCountry.create({
        data: {
          userId: (await ctx.prisma.user.findFirstOrThrow({
            where: { username: "maria" },
          })).id,
          countryCode: "BR",
        },
      });

      // Prime BOTH users' stats caches so the follow must invalidate them.
      const statsBefore = await request(ctx.server)
        .get("/api/users/maria/stats")
        .expect(200);
      expect(statsBefore.body.followerCount).toBe(0);
      const myStatsBefore = await request(ctx.server)
        .get("/api/users/john/stats")
        .expect(200);
      expect(myStatsBefore.body.followingCount).toBe(0);
      expect(await ctx.redis.exists("stats:maria")).toBe(1);
      expect(await ctx.redis.exists("stats:john")).toBe(1);

      await asUser(ctx, john).follow("maria").expect(204);

      // Both parties' cached stats were dropped …
      expect(await ctx.redis.exists("stats:maria")).toBe(0);
      expect(await ctx.redis.exists("stats:john")).toBe(0);

      // … so counts update immediately, without waiting for the TTL.
      const statsAfter = await request(ctx.server)
        .get("/api/users/maria/stats")
        .expect(200);
      expect(statsAfter.body.followerCount).toBe(1);
      const myStatsAfter = await request(ctx.server)
        .get("/api/users/john/stats")
        .expect(200);
      expect(myStatsAfter.body.followingCount).toBe(1);

      // The followed user shows up in /me/following with a country count.
      const following = await asUser(ctx, john).following().expect(200);
      expect(following.body).toEqual([
        {
          username: "maria",
          displayName: expect.any(String),
          avatarUrl: null,
          countryCount: 1,
        },
      ]);

      // … and the follower in maria's /me/followers.
      const followers = await asUser(ctx, maria).followers().expect(200);
      expect(followers.body).toMatchObject([{ username: "john" }]);
    });

    it("is idempotent on duplicate follows", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await loginAs(ctx, "maria@example.com", "maria");

      await asUser(ctx, john).follow("maria").expect(204);
      await asUser(ctx, john).follow("maria").expect(204);

      const following = await asUser(ctx, john).following().expect(200);
      expect(following.body).toHaveLength(1);
      expect(await ctx.prisma.follow.count()).toBe(1);
    });

    it("rejects self-follows with 400", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await asUser(ctx, john).follow("john").expect(400);
      // Case-insensitive: /users/JOHN is still me.
      await asUser(ctx, john).follow("JOHN").expect(400);
      expect(await ctx.prisma.follow.count()).toBe(0);
    });

    it("404s for unknown users and 401s without a session", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await asUser(ctx, john).follow("no_such_user").expect(404);
      await asUser(ctx, john).follow("Not--Valid!").expect(404);
      await asUser(ctx, john).unfollow("no_such_user").expect(404);

      await request(ctx.server)
        .post("/api/users/john/follow")
        .set("X-Requested-With", "fetch")
        .expect(401);
    });

    it("unfollows idempotently and invalidates stats for both parties", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await loginAs(ctx, "maria@example.com", "maria");
      await asUser(ctx, john).follow("maria").expect(204);

      // Prime the caches with the followed state.
      await request(ctx.server).get("/api/users/maria/stats").expect(200);
      await request(ctx.server).get("/api/users/john/stats").expect(200);

      await asUser(ctx, john).unfollow("maria").expect(204);
      expect(await ctx.redis.exists("stats:maria")).toBe(0);
      expect(await ctx.redis.exists("stats:john")).toBe(0);

      const statsAfter = await request(ctx.server)
        .get("/api/users/maria/stats")
        .expect(200);
      expect(statsAfter.body.followerCount).toBe(0);
      const following = await asUser(ctx, john).following().expect(200);
      expect(following.body).toEqual([]);

      // Unfollowing again (nothing to delete) still succeeds.
      await asUser(ctx, john).unfollow("maria").expect(204);
    });
  });

  describe("GET /users/:username isFollowing", () => {
    it("is present for authenticated viewers and absent for anonymous ones", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await loginAs(ctx, "maria@example.com", "maria");

      const before = await asUser(ctx, john).profile("maria").expect(200);
      expect(before.body.isFollowing).toBe(false);

      await asUser(ctx, john).follow("maria").expect(204);

      // Authenticated read reflects the follow — even when the profile
      // body itself is served from the cache.
      await request(ctx.server).get("/api/users/maria").expect(200); // prime cache
      expect(await ctx.redis.exists("profile:maria")).toBe(1);
      const after = await asUser(ctx, john).profile("maria").expect(200);
      expect(after.body.isFollowing).toBe(true);
      expect(after.body.counts.followers).toBe(1);

      // Anonymous reads never carry the per-viewer flag …
      const anon = await request(ctx.server).get("/api/users/maria").expect(200);
      expect(anon.body.isFollowing).toBeUndefined();

      // … and the cached entry stays viewer-free.
      const cached = JSON.parse(
        (await ctx.redis.get("profile:maria")) ?? "{}",
      ) as Record<string, unknown>;
      expect(cached.isFollowing).toBeUndefined();
    });
  });

  describe("GET /me/friends-map", () => {
    it("returns country codes for everyone I follow", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      const maria = await ctx.prisma.user.create({
        data: {
          email: "maria@example.com",
          displayName: "Maria Silva",
          username: "maria",
          visitedCountries: {
            create: [{ countryCode: "BR" }, { countryCode: "AR" }],
          },
        },
      });
      await ctx.prisma.user.create({
        data: {
          email: "kenji@example.com",
          displayName: "Kenji Watanabe",
          username: "kenji",
          visitedCountries: { create: [{ countryCode: "JP" }] },
        },
      });
      await asUser(ctx, john).follow("maria").expect(204);
      await asUser(ctx, john).follow("kenji").expect(204);
      // A follower must NOT appear in my friends map.
      const johnRow = await ctx.prisma.user.findFirstOrThrow({
        where: { username: "john" },
      });
      await ctx.prisma.follow.create({
        data: { followerId: maria.id, followeeId: johnRow.id },
      });

      const res = await asUser(ctx, john).friendsMap().expect(200);
      expect(res.body).toEqual([
        {
          username: "maria",
          displayName: "Maria Silva",
          avatarUrl: null,
          countryCodes: ["AR", "BR"],
        },
        {
          username: "kenji",
          displayName: "Kenji Watanabe",
          avatarUrl: null,
          countryCodes: ["JP"],
        },
      ]);
    });

    it("caps at the first 50 follows by follow date", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      const johnRow = await ctx.prisma.user.findFirstOrThrow({
        where: { username: "john" },
      });

      await ctx.prisma.user.createMany({
        data: Array.from({ length: 55 }, (_, i) => ({
          email: `friend${i}@example.com`,
          displayName: `Friend ${i}`,
          username: `friend_${String(i).padStart(2, "0")}`,
        })),
      });
      const friends = await ctx.prisma.user.findMany({
        where: { username: { startsWith: "friend_" } },
        orderBy: { username: "asc" },
      });
      const base = Date.now() - 1_000_000;
      await ctx.prisma.follow.createMany({
        data: friends.map((friend, i) => ({
          followerId: johnRow.id,
          followeeId: friend.id,
          createdAt: new Date(base + i * 1000), // follow order = index
        })),
      });

      const res = await asUser(ctx, john).friendsMap().expect(200);
      expect(res.body).toHaveLength(50);
      const usernames = (res.body as Array<{ username: string }>).map(
        (row) => row.username,
      );
      expect(usernames[0]).toBe("friend_00"); // earliest follow included
      expect(usernames).not.toContain("friend_50"); // 51st+ dropped
    });

    it("401s without a session", async () => {
      await request(ctx.server).get("/api/me/friends-map").expect(401);
      await request(ctx.server).get("/api/me/following").expect(401);
      await request(ctx.server).get("/api/me/followers").expect(401);
    });
  });

  describe("GET /users/search", () => {
    it("matches username and displayName, excluding self and private users", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await ctx.prisma.user.createMany({
        data: [
          {
            email: "maria@example.com",
            displayName: "Maria Silva",
            username: "maria",
          },
          {
            email: "mario@example.com",
            displayName: "Super Plumber",
            username: "mario64",
          },
          {
            email: "silva@example.com",
            displayName: "Ana Silva",
            username: "ana",
          },
          {
            email: "hidden@example.com",
            displayName: "Maria Hidden",
            username: "maria_hidden",
            isPublic: false,
          },
          {
            email: "unclaimed@example.com",
            displayName: "Maria Unclaimed",
            // no username — must never appear
          },
        ],
      });
      const me = asUser(ctx, john);

      // Substring match on username, case-insensitive.
      const byUsername = await me.search("MARI").expect(200);
      expect(
        (byUsername.body as Array<{ username: string }>).map(
          (row) => row.username,
        ),
      ).toEqual(["maria", "mario64"]);

      // Match on displayName too.
      const byDisplayName = await me.search("Silva").expect(200);
      expect(
        (byDisplayName.body as Array<{ username: string }>).map(
          (row) => row.username,
        ),
      ).toEqual(["ana", "maria"]);

      // Never the searcher themselves.
      const self = await me.search("john").expect(200);
      expect(self.body).toEqual([]);

      // Rows carry the follow state for the FollowButton.
      await me.follow("maria").expect(204);
      const followed = await me.search("maria").expect(200);
      expect(followed.body).toEqual([
        {
          username: "maria",
          displayName: "Maria Silva",
          avatarUrl: null,
          countryCount: 0,
          isFollowing: true,
        },
      ]);

      // Blank queries return nothing (but still count against the throttle).
      const blank = await me.search("  ").expect(200);
      expect(blank.body).toEqual([]);
    });

    it("limits results to 10", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      await ctx.prisma.user.createMany({
        data: Array.from({ length: 12 }, (_, i) => ({
          email: `zz${i}@example.com`,
          displayName: `Zz Match ${i}`,
          username: `zz_match_${String(i).padStart(2, "0")}`,
        })),
      });

      const res = await asUser(ctx, john).search("zz_match").expect(200);
      expect(res.body).toHaveLength(10);
    });

    it("throttles to 20 requests per minute per user", async () => {
      const john = await loginAs(ctx, "john@example.com", "john");
      const other = await loginAs(ctx, "other@example.com", "other_user");

      for (let i = 0; i < 20; i += 1) {
        await asUser(ctx, john).search("maria").expect(200);
      }
      await asUser(ctx, john).search("maria").expect(429);

      // Per-user: another account is unaffected.
      await asUser(ctx, other).search("maria").expect(200);
    });

    it("401s without a session (and is not shadowed by /users/:username)", async () => {
      // Would be 404 if the profile route captured "search" as a handle.
      await request(ctx.server).get("/api/users/search").query({ q: "x" }).expect(401);
    });
  });
});
