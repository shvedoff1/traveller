import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FRIENDS_MAP_LIMIT,
  USER_SEARCH_LIMIT,
  type FollowUser,
  type FriendMapEntry,
  type UserSearchResult,
  usernameSchema,
} from "@traveller/shared";
import type Redis from "ioredis";

import { PrismaService } from "../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../redis/redis.module";
import { ProfileCacheService } from "../profile-cache/profile-cache.service";

/** Search throttle: tighter than the rest of the API (per user, Redis). */
const SEARCH_THROTTLE_WINDOW_SECONDS = 60;
const SEARCH_THROTTLE_MAX_REQUESTS = 20;

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: ProfileCacheService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Follow `username`. 404 for unknown/unclaimed/private handles (same
   * visibility rules as the public profile), 400 on self-follow and
   * idempotent on duplicates.
   */
  async follow(followerId: string, rawUsername: string): Promise<void> {
    const target = await this.findTarget(rawUsername);
    if (!target.isPublic) throw new NotFoundException("User not found");
    if (target.id === followerId) {
      throw new BadRequestException("You cannot follow yourself");
    }

    await this.prisma.follow.createMany({
      data: [{ followerId, followeeId: target.id }],
      skipDuplicates: true,
    });
    await this.invalidateBoth(followerId, target.username);
  }

  /**
   * Unfollow `username` — idempotent, and unlike `follow` it also works
   * for users who have since gone private (so stale follows can always
   * be cleaned up). 404 only for unknown handles.
   */
  async unfollow(followerId: string, rawUsername: string): Promise<void> {
    const target = await this.findTarget(rawUsername);
    await this.prisma.follow.deleteMany({
      where: { followerId, followeeId: target.id },
    });
    await this.invalidateBoth(followerId, target.username);
  }

  /** Everyone `userId` follows, oldest follow first. */
  async following(userId: string): Promise<FollowUser[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "asc" },
      select: { followee: { select: followUserSelect } },
    });
    return rows.flatMap((row) => toFollowUser(row.followee));
  }

  /**
   * Everyone following `userId`, oldest follower first. Followers who
   * have not claimed a handle yet are skipped — there is no profile to
   * link to and no way to follow them back.
   */
  async followers(userId: string): Promise<FollowUser[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId },
      orderBy: { createdAt: "asc" },
      select: { follower: { select: followUserSelect } },
    });
    return rows.flatMap((row) => toFollowUser(row.follower));
  }

  /**
   * Visited-country codes for everyone `userId` follows — the data behind
   * the friend map overlay. Capped at the first {@link FRIENDS_MAP_LIMIT}
   * follows by follow date.
   */
  async friendsMap(userId: string): Promise<FriendMapEntry[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "asc" },
      take: FRIENDS_MAP_LIMIT,
      select: {
        followee: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
            visitedCountries: {
              select: { countryCode: true },
              orderBy: { countryCode: "asc" },
            },
          },
        },
      },
    });
    return rows.flatMap((row) =>
      row.followee.username
        ? [
            {
              username: row.followee.username,
              displayName: row.followee.displayName,
              avatarUrl: row.followee.avatarUrl,
              countryCodes: row.followee.visitedCountries.map(
                (visit) => visit.countryCode,
              ),
            },
          ]
        : [],
    );
  }

  /**
   * Substring search over username + displayName (case-insensitive).
   * Public users with a claimed handle only, never the searcher, at most
   * {@link USER_SEARCH_LIMIT} rows. Throttled to 20/min per user.
   */
  async search(userId: string, query: string): Promise<UserSearchResult[]> {
    await this.throttleSearch(userId);

    const q = query.trim();
    if (q.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isPublic: true,
        username: { not: null },
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { username: "asc" },
      take: USER_SEARCH_LIMIT,
      select: { id: true, ...followUserSelect },
    });

    const followed = await this.prisma.follow.findMany({
      where: { followerId: userId, followeeId: { in: users.map((u) => u.id) } },
      select: { followeeId: true },
    });
    const followedIds = new Set(followed.map((f) => f.followeeId));

    return users.flatMap((user) =>
      toFollowUser(user).map((row) => ({
        ...row,
        isFollowing: followedIds.has(user.id),
      })),
    );
  }

  private async throttleSearch(userId: string): Promise<void> {
    const key = `throttle:user-search:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, SEARCH_THROTTLE_WINDOW_SECONDS);
    }
    if (count > SEARCH_THROTTLE_MAX_REQUESTS) {
      throw new HttpException(
        "Too many search requests, try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Resolve a follow target by handle; 404 when unknown or unclaimed. */
  private async findTarget(rawUsername: string): Promise<{
    id: string;
    username: string;
    isPublic: boolean;
  }> {
    const username = rawUsername.toLowerCase();
    if (!usernameSchema.safeParse(username).success) {
      throw new NotFoundException("User not found");
    }
    const user = await this.prisma.user.findFirst({
      where: { username },
      select: { id: true, username: true, isPublic: true },
    });
    if (!user?.username) throw new NotFoundException("User not found");
    return { id: user.id, username: user.username, isPublic: user.isPublic };
  }

  /**
   * Follow changes move follower/following counts on BOTH public
   * profiles/stats — drop both users' cached entries.
   */
  private async invalidateBoth(
    followerId: string,
    targetUsername: string,
  ): Promise<void> {
    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true },
    });
    await this.cache.invalidate(follower?.username, targetUsername);
  }
}

const followUserSelect = {
  username: true,
  displayName: true,
  avatarUrl: true,
  _count: { select: { visitedCountries: true } },
} as const;

interface FollowUserRow {
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  _count: { visitedCountries: number };
}

/** Shape a user row for the shared FollowUser contract ([] if unclaimed). */
function toFollowUser(user: FollowUserRow): FollowUser[] {
  if (!user.username) return [];
  return [
    {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      countryCount: user._count.visitedCountries,
    },
  ];
}
