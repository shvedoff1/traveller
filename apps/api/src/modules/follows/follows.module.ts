import { Module } from "@nestjs/common";

import { ProfileCacheModule } from "../profile-cache/profile-cache.module";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";

@Module({
  imports: [ProfileCacheModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
