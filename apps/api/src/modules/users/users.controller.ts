import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import {
  type MeResponse,
  type PublicProfile,
  type UpdateMeInput,
  updateMeSchema,
} from "@traveller/shared";

import { type AccessTokenPayload } from "../../common/auth.types";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<MeResponse> {
    return this.usersService.updateMe(user.sub, body);
  }

  @Get("users/:username")
  async publicProfile(
    @Param("username") username: string,
  ): Promise<PublicProfile> {
    return this.usersService.publicProfile(username);
  }
}
