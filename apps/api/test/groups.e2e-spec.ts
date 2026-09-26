import { GROUP_MEMBER_LIMIT, GROUPS_OWNED_LIMIT } from "@traveller/shared";
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
  const get = (path: string) =>
    request(ctx.server).get(`/api${path}`).set("Cookie", cookie);
  const mutate = (method: "post" | "patch" | "delete", path: string) => {
    const agent = request(ctx.server);
    return agent[method](`/api${path}`)
      .set("X-Requested-With", "fetch")
      .set("Cookie", cookie);
  };
  return {
    patchMe: (body: object) => mutate("patch", "/me").send(body),
    myGroups: () => get("/me/groups"),
    create: (name: string) => mutate("post", "/groups").send({ name }),
    detail: (id: string) => get(`/groups/${id}`),
    rename: (id: string, name: string) =>
      mutate("patch", `/groups/${id}`).send({ name }),
    remove: (id: string) => mutate("delete", `/groups/${id}`),
    rotateInvite: (id: string) => mutate("post", `/groups/${id}/invite-code`),
    addMember: (id: string, username: string) =>
      mutate("post", `/groups/${id}/members`).send({ username }),
    removeMember: (id: string, username: string) =>
      mutate("delete", `/groups/${id}/members/${username}`),
    invite: (code: string) => get(`/group-invites/${code}`),
    join: (code: string) => mutate("post", `/group-invites/${code}`),
  };
}

type Api = ReturnType<typeof asUser>;

describe("groups (e2e)", () => {
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

  /** Login, claim a handle and mark some countries. */
  async function traveller(
    username: string,
    countries: string[] = [],
  ): Promise<Api> {
    const session = await login(ctx, `${username}@example.com`);
    const api = asUser(ctx, session);
    await api.patchMe({ username }).expect(200);
    const user = await ctx.prisma.user.findFirstOrThrow({
      where: { username },
    });
    if (countries.length > 0) {
      await ctx.prisma.visitedCountry.createMany({
        data: countries.map((countryCode) => ({
          userId: user.id,
          countryCode,
        })),
      });
    }
    return api;
  }

  it("creates a group with the owner as its only member", async () => {
    const ann = await traveller("ann", ["FR", "JP"]);
    const res = await ann.create("  Lisbon crew  ").expect(201);
    expect(res.body).toMatchObject({
      name: "Lisbon crew",
      isOwner: true,
      inviteCode: expect.stringMatching(/^[\w-]{12}$/),
      members: [
        {
          username: "ann",
          isOwner: true,
          countryCount: 2,
          uniqueCount: 2,
          countryCodes: ["FR", "JP"],
        },
      ],
      stats: { countryCount: 2, sharedCodes: [], popular: [] },
    });

    const list = await ann.myGroups().expect(200);
    expect(list.body).toEqual([
      {
        id: res.body.id,
        name: "Lisbon crew",
        memberCount: 1,
        countryCount: 2,
        isOwner: true,
      },
    ]);
  });

  it("validates names and requires a claimed handle", async () => {
    const ann = await traveller("ann");
    await ann.create("   ").expect(400);
    await ann.create("x".repeat(61)).expect(400);

    const nobody = asUser(ctx, await login(ctx, "nohandle@example.com"));
    await nobody.create("Crew").expect(400);
  });

  it("caps how many groups one user owns", async () => {
    const ann = await traveller("ann");
    for (let i = 0; i < GROUPS_OWNED_LIMIT; i++) {
      await ann.create(`Group ${i}`).expect(201);
    }
    await ann.create("One too many").expect(400);
  });

  it("joins via invite link and aggregates everyone's maps", async () => {
    const ann = await traveller("ann", ["FR", "IT", "JP"]);
    const bob = await traveller("bob", ["FR", "IT", "BR"]);
    const cat = await traveller("cat", ["FR", "US"]);
    const group = (await ann.create("Crew").expect(201)).body;

    // Preview shows what you'd join.
    const preview = await bob.invite(group.inviteCode).expect(200);
    expect(preview.body).toEqual({
      id: group.id,
      name: "Crew",
      memberCount: 1,
      ownerDisplayName: expect.any(String),
      isMember: false,
    });

    // Non-members can't see the group before joining.
    await bob.detail(group.id).expect(404);

    await bob.join(group.inviteCode).expect(200, { id: group.id });
    await cat.join(group.inviteCode).expect(200);
    // Idempotent.
    await cat.join(group.inviteCode).expect(200);
    expect((await cat.invite(group.inviteCode).expect(200)).body.isMember).toBe(
      true,
    );

    const detail = await bob.detail(group.id).expect(200);
    expect(detail.body.isOwner).toBe(false);
    expect(detail.body.members.map((m: { username: string }) => m.username)).toEqual(
      ["ann", "bob", "cat"],
    );
    expect(detail.body.stats).toMatchObject({
      countryCount: 5,
      countryCodes: ["BR", "FR", "IT", "JP", "US"],
      sharedCodes: ["FR"],
      popular: [
        { code: "FR", count: 3 },
        { code: "IT", count: 2 },
      ],
      averageCount: 2.7,
    });

    const bobsGroups = await bob.myGroups().expect(200);
    expect(bobsGroups.body).toEqual([
      expect.objectContaining({
        id: group.id,
        memberCount: 3,
        countryCount: 5,
        isOwner: false,
      }),
    ]);
  });

  it("404s unknown groups, bad ids and bad invite codes", async () => {
    const ann = await traveller("ann");
    await ann.detail("not-a-uuid").expect(404);
    await ann.detail("00000000-0000-4000-8000-000000000000").expect(404);
    await ann.invite("nope").expect(404);
    await ann.invite("aaaaaaaaaaaa").expect(404);
    await ann.join("aaaaaaaaaaaa").expect(404);
  });

  it("requires a session and the CSRF header", async () => {
    await request(ctx.server).get("/api/me/groups").expect(401);
    const ann = await traveller("ann");
    const group = (await ann.create("Crew").expect(201)).body;
    const cookie = `access_token=${(await login(ctx, "ann@example.com")).accessToken}`;
    await request(ctx.server)
      .patch(`/api/groups/${group.id}`)
      .set("Cookie", cookie)
      .send({ name: "No CSRF" })
      .expect(403);
  });

  it("lets only the owner rename, rotate the invite and delete", async () => {
    const ann = await traveller("ann");
    const bob = await traveller("bob");
    const group = (await ann.create("Crew").expect(201)).body;
    await bob.join(group.inviteCode).expect(200);

    await bob.rename(group.id, "Hijacked").expect(403);
    await bob.rotateInvite(group.id).expect(403);
    await bob.remove(group.id).expect(403);

    const renamed = await ann.rename(group.id, "Renamed").expect(200);
    expect(renamed.body.name).toBe("Renamed");

    // Rotating kills the old link.
    const rotated = await ann.rotateInvite(group.id).expect(200);
    expect(rotated.body.inviteCode).not.toBe(group.inviteCode);
    await bob.invite(group.inviteCode).expect(404);
    await bob.invite(rotated.body.inviteCode).expect(200);

    await ann.remove(group.id).expect(204);
    await ann.detail(group.id).expect(404);
    expect(await ctx.prisma.groupMember.count()).toBe(0);
  });

  it("owner adds public users directly; private/unknown ones 404", async () => {
    const ann = await traveller("ann");
    await traveller("bob", ["PT"]);
    await traveller("eve");
    await ctx.prisma.user.update({
      where: { username: "eve" },
      data: { isPublic: false },
    });
    const group = (await ann.create("Crew").expect(201)).body;

    const added = await ann.addMember(group.id, "bob").expect(200);
    expect(added.body.members).toHaveLength(2);
    // Idempotent.
    await ann.addMember(group.id, "bob").expect(200);

    await ann.addMember(group.id, "eve").expect(404);
    await ann.addMember(group.id, "ghost").expect(404);
    await ann.addMember(group.id, "Bad Name").expect(400);
  });

  it("members may leave, the owner removes others but can't leave", async () => {
    const ann = await traveller("ann");
    const bob = await traveller("bob");
    const cat = await traveller("cat");
    const group = (await ann.create("Crew").expect(201)).body;
    await bob.join(group.inviteCode).expect(200);
    await cat.join(group.inviteCode).expect(200);

    // A member can't kick someone else.
    await bob.removeMember(group.id, "cat").expect(403);
    // Owner can't leave their own group.
    await ann.removeMember(group.id, "ann").expect(400);

    await bob.removeMember(group.id, "bob").expect(204);
    await bob.detail(group.id).expect(404);
    await ann.removeMember(group.id, "cat").expect(204);
    await ann.removeMember(group.id, "cat").expect(404);

    const detail = await ann.detail(group.id).expect(200);
    expect(detail.body.members).toHaveLength(1);
  });

  it(`caps a group at ${GROUP_MEMBER_LIMIT} members`, async () => {
    const ann = await traveller("ann");
    const group = (await ann.create("Crew").expect(201)).body;
    // Fill the group straight in the DB (logging in 49 users is slow).
    await ctx.prisma.user.createMany({
      data: Array.from({ length: GROUP_MEMBER_LIMIT - 1 }, (_, i) => ({
        username: `filler_${i}`,
        displayName: `Filler ${i}`,
        email: `filler${i}@example.com`,
      })),
    });
    const fillers = await ctx.prisma.user.findMany({
      where: { username: { startsWith: "filler_" } },
      select: { id: true },
    });
    await ctx.prisma.groupMember.createMany({
      data: fillers.map((user) => ({ groupId: group.id, userId: user.id })),
    });
    expect(
      await ctx.prisma.groupMember.count({ where: { groupId: group.id } }),
    ).toBe(GROUP_MEMBER_LIMIT);

    const late = await traveller("late");
    await late.join(group.inviteCode).expect(409);
  });
});
