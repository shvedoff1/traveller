import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GROUP_MEMBER_LIMIT,
  GROUPS_OWNED_LIMIT,
  type GroupDetail,
  type GroupInvitePreview,
  type GroupSummary,
  type JoinGroupResponse,
  usernameSchema,
} from "@traveller/shared";
import { z } from "zod";

import { PrismaService } from "../../prisma/prisma.service";
import { computeGroupStats } from "./group-stats.logic";

const uuidSchema = z.string().uuid();
/** base64url of 9 random bytes → 12 URL-safe characters. */
const INVITE_CODE_REGEX = /^[\w-]{12}$/;

export function newInviteCode(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Friend groups: a named set of members whose maps add up to group stats.
 * Everything is members-only — to anyone else (bad id, not a member) a
 * group simply doesn't exist (404). Owner-only actions 403 for members.
 */
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Groups `userId` belongs to, newest membership first. */
  async listMine(userId: string): Promise<GroupSummary[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: {
              select: {
                user: {
                  select: { visitedCountries: { select: { countryCode: true } } },
                },
              },
            },
          },
        },
      },
    });
    return rows.map(({ group }) => ({
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      countryCount: new Set(
        group.members.flatMap((m) =>
          m.user.visitedCountries.map((v) => v.countryCode),
        ),
      ).size,
      isOwner: group.ownerId === userId,
    }));
  }

  async create(userId: string, name: string): Promise<GroupDetail> {
    await this.requireHandle(userId);
    const owned = await this.prisma.group.count({ where: { ownerId: userId } });
    if (owned >= GROUPS_OWNED_LIMIT) {
      throw new BadRequestException(
        `You can own at most ${GROUPS_OWNED_LIMIT} groups`,
      );
    }
    const group = await this.prisma.group.create({
      data: {
        name,
        ownerId: userId,
        inviteCode: newInviteCode(),
        members: { create: { userId } },
      },
      select: { id: true },
    });
    return this.detail(userId, group.id);
  }

  /** Full group view with members and stats (members only). */
  async detail(userId: string, rawId: string): Promise<GroupDetail> {
    const id = this.parseId(rawId);
    const group = await this.prisma.group.findFirst({
      where: { id, members: { some: { userId } } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        inviteCode: true,
        createdAt: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                visitedCountries: { select: { countryCode: true } },
              },
            },
          },
        },
      },
    });
    if (!group) throw new NotFoundException("Group not found");

    const { stats, members } = computeGroupStats(
      group.members.flatMap(({ user }) =>
        user.username
          ? [
              {
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                isOwner: user.id === group.ownerId,
                countryCodes: user.visitedCountries.map((v) => v.countryCode),
              },
            ]
          : [],
      ),
    );

    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt.toISOString(),
      isOwner: group.ownerId === userId,
      inviteCode: group.inviteCode,
      members,
      stats,
    };
  }

  async rename(
    userId: string,
    rawId: string,
    name: string,
  ): Promise<GroupDetail> {
    const id = await this.requireOwner(userId, rawId);
    await this.prisma.group.update({ where: { id }, data: { name } });
    return this.detail(userId, id);
  }

  async remove(userId: string, rawId: string): Promise<void> {
    const id = await this.requireOwner(userId, rawId);
    await this.prisma.group.delete({ where: { id } });
  }

  /** New invite code; the old link stops working. */
  async rotateInvite(userId: string, rawId: string): Promise<GroupDetail> {
    const id = await this.requireOwner(userId, rawId);
    await this.prisma.group.update({
      where: { id },
      data: { inviteCode: newInviteCode() },
    });
    return this.detail(userId, id);
  }

  /**
   * Owner adds someone directly — same visibility rules as following:
   * unknown, unclaimed or private handles 404. Idempotent.
   */
  async addMember(
    userId: string,
    rawId: string,
    username: string,
  ): Promise<GroupDetail> {
    const id = await this.requireOwner(userId, rawId);
    const target = await this.prisma.user.findFirst({
      where: { username: username.toLowerCase(), isPublic: true },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("User not found");
    await this.insertMember(id, target.id);
    return this.detail(userId, id);
  }

  /**
   * Remove `username` from the group: the owner may remove anyone but
   * themselves; a member may remove only themselves (leave). The owner
   * can't leave — they delete the group instead.
   */
  async removeMember(
    userId: string,
    rawId: string,
    rawUsername: string,
  ): Promise<void> {
    const id = this.parseId(rawId);
    const group = await this.findMembership(userId, id);
    const username = rawUsername.toLowerCase();
    const target = usernameSchema.safeParse(username).success
      ? await this.prisma.user.findFirst({
          where: { username },
          select: { id: true },
        })
      : null;
    if (!target) throw new NotFoundException("Member not found");

    const isSelf = target.id === userId;
    const isOwner = group.ownerId === userId;
    if (isSelf && isOwner) {
      throw new BadRequestException(
        "The owner can't leave — delete the group instead",
      );
    }
    if (!isSelf && !isOwner) {
      throw new ForbiddenException("Only the owner can remove members");
    }
    const { count } = await this.prisma.groupMember.deleteMany({
      where: { groupId: id, userId: target.id },
    });
    if (count === 0) throw new NotFoundException("Member not found");
  }

  /** What an invite link leads to (any logged-in user with the code). */
  async invitePreview(
    userId: string,
    code: string,
  ): Promise<GroupInvitePreview> {
    const group = await this.findByInvite(code);
    return {
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      ownerDisplayName: group.owner.displayName,
      isMember: group.members.some((m) => m.userId === userId),
    };
  }

  /** Join via invite code. Idempotent for existing members. */
  async join(userId: string, code: string): Promise<JoinGroupResponse> {
    await this.requireHandle(userId);
    const group = await this.findByInvite(code);
    await this.insertMember(group.id, userId);
    return { id: group.id };
  }

  // --- helpers ----------------------------------------------------------

  private parseId(rawId: string): string {
    if (!uuidSchema.safeParse(rawId).success) {
      throw new NotFoundException("Group not found");
    }
    return rawId;
  }

  private async findMembership(
    userId: string,
    id: string,
  ): Promise<{ ownerId: string }> {
    const group = await this.prisma.group.findFirst({
      where: { id, members: { some: { userId } } },
      select: { ownerId: true },
    });
    if (!group) throw new NotFoundException("Group not found");
    return group;
  }

  /** The group id if `userId` owns it; 404 non-members, 403 members. */
  private async requireOwner(userId: string, rawId: string): Promise<string> {
    const id = this.parseId(rawId);
    const group = await this.findMembership(userId, id);
    if (group.ownerId !== userId) {
      throw new ForbiddenException("Only the owner can do that");
    }
    return id;
  }

  /** Group membership shows your handle — claim one first. */
  private async requireHandle(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!user?.username) {
      throw new BadRequestException("Claim a username first");
    }
  }

  private async findByInvite(code: string) {
    const group = INVITE_CODE_REGEX.test(code)
      ? await this.prisma.group.findUnique({
          where: { inviteCode: code },
          select: {
            id: true,
            name: true,
            owner: { select: { displayName: true } },
            members: { select: { userId: true } },
          },
        })
      : null;
    if (!group) throw new NotFoundException("Invite not found");
    return group;
  }

  /** Add a member unless present; 409 when the group is full. */
  private async insertMember(groupId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { userId: true },
      });
      if (existing) return;
      const size = await tx.groupMember.count({ where: { groupId } });
      if (size >= GROUP_MEMBER_LIMIT) {
        throw new ConflictException(
          `A group holds at most ${GROUP_MEMBER_LIMIT} members`,
        );
      }
      await tx.groupMember.createMany({
        data: [{ groupId, userId }],
        skipDuplicates: true,
      });
    });
  }
}
