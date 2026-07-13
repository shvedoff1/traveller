import { Module } from "@nestjs/common";

import { ProfileCacheModule } from "../profile-cache/profile-cache.module";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [ProfileCacheModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
