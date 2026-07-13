import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  type FollowUser,
  type FriendMapEntry,
  type UserSearchResult,
} from "@traveller/shared";

import { type AccessTokenPayload } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { FollowsService } from "./follows.service";

/**
 * Following: follow/unfollow by handle, my follow lists, the friends-map
 * data and user search. All routes require a session; mutations also pass
 * the global CSRF header guard.
 *
 * NB: `GET /users/search` must be registered before `GET /users/:username`
 * ("search" is a valid handle) — FollowsModule is imported before
 * UsersModule in AppModule for exactly that reason.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post("users/:username/follow")
  @HttpCode(204)
  async follow(
    @CurrentUser() user: AccessTokenPayload,
    @Param("username") username: string,
  ): Promise<void> {
    await this.followsService.follow(user.sub, username);
  }

  @Delete("users/:username/follow")
  @HttpCode(204)
  async unfollow(
    @CurrentUser() user: AccessTokenPayload,
    @Param("username") username: string,
  ): Promise<void> {
    await this.followsService.unfollow(user.sub, username);
  }

  @Get("me/following")
  async following(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUser[]> {
    return this.followsService.following(user.sub);
  }

  @Get("me/followers")
  async followers(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUser[]> {
    return this.followsService.followers(user.sub);
  }

  @Get("me/friends-map")
  async friendsMap(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FriendMapEntry[]> {
    return this.followsService.friendsMap(user.sub);
  }

  @Get("users/search")
  async search(
    @CurrentUser() user: AccessTokenPayload,
    @Query("q") q?: string,
  ): Promise<UserSearchResult[]> {
    return this.followsService.search(user.sub, q ?? "");
  }
}
