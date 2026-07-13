import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  type MeResponse,
  type PublicProfile,
  type UpdateMeInput,
  usernameSchema,
} from "@traveller/shared";

import { PrismaService } from "../../prisma/prisma.service";
import { toMeResponse } from "../auth/auth.service";
import { ProfileCacheService } from "../profile-cache/profile-cache.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ProfileCacheService,
  ) {}

  /**
   * Claim a username and/or change the display name. 409 when taken.
   * Invalidates the cached profile/stats — for the old username too when
   * it changes, so the stale handle stops resolving immediately.
   */
  async updateMe(userId: string, input: UpdateMeInput): Promise<MeResponse> {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
        },
      });
      await this.cache.invalidate(before?.username, user.username);
      return toMeResponse(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Username already taken");
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }

  /**
   * Public profile by username (citext = case-insensitive), cache-aside
   * under `profile:{username}`. 404 if unknown, unclaimed or hidden —
   * misses are never cached.
   *
   * When `viewerId` is set (OptionalAuthGuard) the response additionally
   * carries `isFollowing`. It is attached AFTER the cache read/write —
   * per-viewer data must never end up in the shared cached entry.
   */
  async publicProfile(
    rawUsername: string,
    viewerId?: string,
  ): Promise<PublicProfile> {
    const profile = await this.cachedProfile(rawUsername.toLowerCase());
    if (viewerId === undefined) return profile;
    return {
      ...profile,
      isFollowing: await this.isFollowing(viewerId, profile.username),
    };
  }

  private async cachedProfile(username: string): Promise<PublicProfile> {
    if (!usernameSchema.safeParse(username).success) {
      throw new NotFoundException("User not found");
    }

    const key = this.cache.profileKey(username);
    const cached = await this.cache.read<PublicProfile>(key);
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { username },
      include: {
        visitedCountries: {
          select: { countryCode: true },
          orderBy: { countryCode: "asc" },
        },
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user?.username || !user.isPublic) {
      throw new NotFoundException("User not found");
    }

    const countryCodes = user.visitedCountries.map((v) => v.countryCode);
    const profile: PublicProfile = {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      countryCodes,
      counts: {
        countries: countryCodes.length,
        followers: user._count.followers,
        following: user._count.following,
      },
    };
    await this.cache.write(key, profile);
    return profile;
  }

  /** Does `viewerId` follow the user holding `username`? */
  private async isFollowing(
    viewerId: string,
    username: string,
  ): Promise<boolean> {
    const follow = await this.prisma.follow.findFirst({
      where: { followerId: viewerId, followee: { username } },
      select: { followerId: true },
    });
    return follow !== null;
  }
}
