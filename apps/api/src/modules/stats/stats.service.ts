import { Injectable, NotFoundException } from "@nestjs/common";
import { type UserStats, usernameSchema } from "@traveller/shared";

import { PrismaService } from "../../prisma/prisma.service";
import { ProfileCacheService } from "../profile-cache/profile-cache.service";
import { computeCountryStats } from "./stats.logic";

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ProfileCacheService,
  ) {}

  /**
   * Public travel stats by username, cache-aside under `stats:{username}`.
   * Same visibility rules as the profile: unknown, unclaimed or private
   * usernames 404.
   */
  async statsFor(rawUsername: string): Promise<UserStats> {
    const username = rawUsername.toLowerCase();
    if (!usernameSchema.safeParse(username).success) {
      throw new NotFoundException("User not found");
    }

    const key = this.cache.statsKey(username);
    const cached = await this.cache.read<UserStats>(key);
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { username },
      select: {
        username: true,
        isPublic: true,
        visitedCountries: { select: { countryCode: true } },
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user?.username || !user.isPublic) {
      throw new NotFoundException("User not found");
    }

    const stats: UserStats = {
      ...computeCountryStats(
        user.visitedCountries.map((v) => v.countryCode),
      ),
      followerCount: user._count.followers,
      followingCount: user._count.following,
    };
    await this.cache.write(key, stats);
    return stats;
  }
}
