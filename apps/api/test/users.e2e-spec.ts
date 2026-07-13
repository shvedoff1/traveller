import request from "supertest";

import {
  type TestContext,
  createTestContext,
  login,
  resetState,
} from "./utils";

describe("users (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("PATCH /me", () => {
    it("claims a username", async () => {
      const session = await login(ctx, "claimer@example.com");

      const res = await request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${session.accessToken}`)
        .send({ username: "claimer" })
        .expect(200);
      expect(res.body).toMatchObject({
        username: "claimer",
        email: "claimer@example.com",
      });

      // Persisted: /auth/me reflects the claim.
      const me = await request(ctx.server)
        .get("/auth/me")
        .set("Cookie", `access_token=${session.accessToken}`)
        .expect(200);
      expect(me.body.username).toBe("claimer");
    });

    it("updates displayName", async () => {
      const session = await login(ctx, "renamer@example.com");
      const res = await request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${session.accessToken}`)
        .send({ displayName: "The Renamer" })
        .expect(200);
      expect(res.body.displayName).toBe("The Renamer");
    });

    it("returns 409 when the username is already taken", async () => {
      const first = await login(ctx, "first-taker@example.com");
      await request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${first.accessToken}`)
        .send({ username: "duplicated" })
        .expect(200);

      const second = await login(ctx, "second-taker@example.com");
      await request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .set("Cookie", `access_token=${second.accessToken}`)
        .send({ username: "duplicated" })
        .expect(409);
    });

    it("returns 400 on invalid payloads", async () => {
      const session = await login(ctx, "invalid@example.com");
      const patch = (body: object): request.Test =>
        request(ctx.server)
          .patch("/me")
          .set("X-Requested-With", "fetch")
          .set("Cookie", `access_token=${session.accessToken}`)
          .send(body);

      await patch({ username: "Bad-Name" }).expect(400); // uppercase + hyphen
      await patch({ username: "ab" }).expect(400); // too short
      await patch({}).expect(400); // nothing to update
      await patch({ email: "hack@example.com" }).expect(400); // unknown key
    });

    it("returns 401 without a session", async () => {
      await request(ctx.server)
        .patch("/me")
        .set("X-Requested-With", "fetch")
        .send({ username: "anonymous" })
        .expect(401);
    });
  });

  describe("GET /users/:username", () => {
    it("returns the public profile with visits and counts", async () => {
      const user = await ctx.prisma.user.create({
        data: {
          email: "profiled@example.com",
          displayName: "Profiled",
          username: "profiled",
          visitedCountries: {
            create: [
              { countryCode: "JP", visitedYear: 2020 },
              { countryCode: "FR" },
              { countryCode: "BR", note: "Carnival" },
            ],
          },
        },
      });
      const fan = await ctx.prisma.user.create({
        data: { email: "fan@example.com", displayName: "Fan", username: "fan" },
      });
      await ctx.prisma.follow.create({
        data: { followerId: fan.id, followeeId: user.id },
      });

      const res = await request(ctx.server).get("/users/profiled").expect(200);
      expect(res.body).toEqual({
        username: "profiled",
        displayName: "Profiled",
        avatarUrl: null,
        countryCodes: ["BR", "FR", "JP"],
        counts: { countries: 3, followers: 1, following: 0 },
      });
    });

    it("is case-insensitive thanks to citext", async () => {
      const res = await request(ctx.server).get("/users/PROFILED").expect(200);
      expect(res.body.username).toBe("profiled");
    });

    it("404s for unknown users", async () => {
      await request(ctx.server).get("/users/no_such_user").expect(404);
    });

    it("404s for malformed usernames", async () => {
      await request(ctx.server).get("/users/Invalid--Name!").expect(404);
    });

    it("404s for private profiles", async () => {
      await ctx.prisma.user.create({
        data: {
          email: "hidden@example.com",
          displayName: "Hidden",
          username: "hidden",
          isPublic: false,
        },
      });
      await request(ctx.server).get("/users/hidden").expect(404);
    });
  });
});
