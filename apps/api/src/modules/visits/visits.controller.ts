import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  type UpsertVisitInput,
  type Visit,
  upsertVisitSchema,
} from "@traveller/shared";

import { type AccessTokenPayload } from "../../common/auth.types";
import { CountryCodePipe } from "../../common/country-code.pipe";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { VisitsService } from "./visits.service";

/**
 * The authenticated user's visited countries. All routes require a valid
 * session; mutations additionally pass the global CSRF header guard.
 */
@Controller("me/visits")
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenPayload): Promise<Visit[]> {
    return this.visitsService.list(user.sub);
  }

  @Put(":countryCode")
  async upsert(
    @CurrentUser() user: AccessTokenPayload,
    @Param("countryCode", CountryCodePipe) countryCode: string,
    @Body(new ZodValidationPipe(upsertVisitSchema)) body: UpsertVisitInput,
  ): Promise<Visit> {
    return this.visitsService.upsert(user.sub, countryCode, body);
  }

  @Delete(":countryCode")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("countryCode", CountryCodePipe) countryCode: string,
  ): Promise<void> {
    await this.visitsService.remove(user.sub, countryCode);
  }
}
