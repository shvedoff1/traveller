import { Module } from "@nestjs/common";

import { ProfileCacheModule } from "../profile-cache/profile-cache.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [ProfileCacheModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
