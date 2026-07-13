import {
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import Redis from "ioredis";

import { loadEnv } from "../config/env";

/** Injection token for the shared ioredis client. */
export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => new Redis(loadEnv().REDIS_URL),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
