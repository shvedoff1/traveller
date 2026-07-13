import { Controller, Get, Param } from "@nestjs/common";
import { type UserStats } from "@traveller/shared";

import { StatsService } from "./stats.service";

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get("users/:username/stats")
  async userStats(@Param("username") username: string): Promise<UserStats> {
    return this.statsService.statsFor(username);
  }
}
