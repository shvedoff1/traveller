import { COUNTRIES } from "@traveller/shared";
import request from "supertest";

import { type TestContext, createTestContext, resetState } from "./utils";

/** Countries on a continent, from the canonical shared list. */
function continentTotal(continent: string): number {
  return COUNTRIES.filter((c) => c.continent === continent).length;
}

describe("stats (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);

    // Mirror the demo seed's john: 3 North America + 2 Europe visits.
    const john = await ctx.prisma.user.create({
      data: {
        email: "john@example.com",
        displayName: "John Carter",
        username: "john",
        visitedCountries: {
          create: [
            { countryCode: "US" },
            { countryCode: "CA", visitedYear: 2019 },
            { countryCode: "MX", visitedYear: 2021, note: "Oaxaca road trip" },
            { countryCode: "FR", visitedYear: 2023 },
            { countryCode: "IT" },
          ],
        },
      },
    });
    const maria = await ctx.prisma.user.create({
      data: {
        email: "maria@example.com",
        displayName: "Maria Silva",
        username: "maria",
      },
    });
    const kenji = await ctx.prisma.user.create({
      data: {
        email: "kenji@example.com",
        displayName: "Kenji Watanabe",
        username: "kenji",
      },
    });
    await ctx.prisma.follow.createMany({
      data: [
        { followerId: maria.id, followeeId: john.id },
        { followerId: kenji.id, followeeId: john.id },
        { followerId: john.id, followeeId: maria.id },
      ],
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("GET /users/:username/stats", () => {
    it("computes counts, world percent and continents from the data", async () => {
      const res = await request(ctx.server).get("/api/users/john/stats").expect(200);

      expect(res.body.countryCount).toBe(5);
      // 5 of 249 countries → 2.008…% → 2 (one decimal).
      expect(res.body.worldPercent).toBe(
        Math.round((5 / COUNTRIES.length) * 1000) / 10,
      );
      expect(res.body.worldPercent).toBe(2);

      expect(res.body.continents).toEqual({
        Africa: { visited: 0, total: continentTotal("Africa") },
        Antarctica: { visited: 0, total: continentTotal("Antarctica") },
        Asia: { visited: 0, total: continentTotal("Asia") },
        Europe: { visited: 2, total: continentTotal("Europe") },
        "North America": { visited: 3, total: continentTotal("North America") },
        Oceania: { visited: 0, total: continentTotal("Oceania") },
        "South America": { visited: 0, total: continentTotal("South America") },
      });
    });

    it("reads follower counts from the Follow table", async () => {
      const res = await request(ctx.server).get("/api/users/john/stats").expect(200);
      expect(res.body.followerCount).toBe(2);
      expect(res.body.followingCount).toBe(1);
    });

    it("returns zeros for a user without visits or followers", async () => {
      const res = await request(ctx.server)
        .get("/api/users/kenji/stats")
        .expect(200);
      expect(res.body.countryCount).toBe(0);
      expect(res.body.worldPercent).toBe(0);
      expect(res.body.followerCount).toBe(0);
      // kenji follows john (seeded above).
      expect(res.body.followingCount).toBe(1);
    });

    it("is case-insensitive on the username", async () => {
      const res = await request(ctx.server).get("/api/users/JOHN/stats").expect(200);
      expect(res.body.countryCount).toBe(5);
    });

    it("404s for unknown users", async () => {
      await request(ctx.server).get("/api/users/no_such_user/stats").expect(404);
    });

    it("404s for malformed usernames", async () => {
      await request(ctx.server).get("/api/users/Not--Valid!/stats").expect(404);
    });

    it("404s for private profiles", async () => {
      await ctx.prisma.user.create({
        data: {
          email: "secret@example.com",
          displayName: "Secret",
          username: "secret_stats",
          isPublic: false,
        },
      });
      await request(ctx.server).get("/api/users/secret_stats/stats").expect(404);
    });
  });
});
