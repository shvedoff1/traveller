import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  type AddGroupMemberInput,
  type GroupDetail,
  type GroupInvitePreview,
  type GroupNameInput,
  type GroupSummary,
  type JoinGroupResponse,
  addGroupMemberSchema,
  groupNameInputSchema,
} from "@traveller/shared";

import { type AccessTokenPayload } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { GroupsService } from "./groups.service";

/**
 * Friend groups. All routes require a session; mutations also pass the
 * global CSRF header guard. Invite links resolve under /group-invites.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get("me/groups")
  async mine(@CurrentUser() user: AccessTokenPayload): Promise<GroupSummary[]> {
    return this.groupsService.listMine(user.sub);
  }

  @Post("groups")
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(groupNameInputSchema)) body: GroupNameInput,
  ): Promise<GroupDetail> {
    return this.groupsService.create(user.sub, body.name);
  }

  @Get("groups/:id")
  async detail(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
  ): Promise<GroupDetail> {
    return this.groupsService.detail(user.sub, id);
  }

  @Patch("groups/:id")
  async rename(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(groupNameInputSchema)) body: GroupNameInput,
  ): Promise<GroupDetail> {
    return this.groupsService.rename(user.sub, id, body.name);
  }

  @Delete("groups/:id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.groupsService.remove(user.sub, id);
  }

  @Post("groups/:id/invite-code")
  @HttpCode(200)
  async rotateInvite(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
  ): Promise<GroupDetail> {
    return this.groupsService.rotateInvite(user.sub, id);
  }

  @Post("groups/:id/members")
  @HttpCode(200)
  async addMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addGroupMemberSchema))
    body: AddGroupMemberInput,
  ): Promise<GroupDetail> {
    return this.groupsService.addMember(user.sub, id, body.username);
  }

  @Delete("groups/:id/members/:username")
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Param("username") username: string,
  ): Promise<void> {
    await this.groupsService.removeMember(user.sub, id, username);
  }

  @Get("group-invites/:code")
  async invitePreview(
    @CurrentUser() user: AccessTokenPayload,
    @Param("code") code: string,
  ): Promise<GroupInvitePreview> {
    return this.groupsService.invitePreview(user.sub, code);
  }

  @Post("group-invites/:code")
  @HttpCode(200)
  async join(
    @CurrentUser() user: AccessTokenPayload,
    @Param("code") code: string,
  ): Promise<JoinGroupResponse> {
    return this.groupsService.join(user.sub, code);
  }
}
