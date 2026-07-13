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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Claim a username and/or change the display name. 409 when taken. */
  async updateMe(userId: string, input: UpdateMeInput): Promise<MeResponse> {
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

  /** Public profile by username (citext = case-insensitive). 404 if hidden. */
  async publicProfile(rawUsername: string): Promise<PublicProfile> {
    const username = rawUsername.toLowerCase();
    if (!usernameSchema.safeParse(username).success) {
      throw new NotFoundException("User not found");
    }

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
    return {
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
  }
}
