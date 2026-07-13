import { Module } from "@nestjs/common";

import { ProfileCacheModule } from "../profile-cache/profile-cache.module";
import { VisitsController } from "./visits.controller";
import { VisitsService } from "./visits.service";

@Module({
  imports: [ProfileCacheModule],
  controllers: [VisitsController],
  providers: [VisitsService],
})
export class VisitsModule {}
