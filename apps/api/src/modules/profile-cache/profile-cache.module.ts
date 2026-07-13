import { Module } from "@nestjs/common";

import { ProfileCacheService } from "./profile-cache.service";

@Module({
  providers: [ProfileCacheService],
  exports: [ProfileCacheService],
})
export class ProfileCacheModule {}
