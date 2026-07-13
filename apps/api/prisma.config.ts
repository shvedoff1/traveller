import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "prisma/config";

// The prisma CLI does not read the repo-root .env on its own — load it the
// same way the API does (app-local first, then the repo root). Real
// environment variables always win (loadEnvFile never overrides).
for (const candidate of [
  resolve(__dirname, ".env"),
  resolve(__dirname, "../../.env"),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

export default defineConfig({
  schema: resolve(__dirname, "prisma/schema.prisma"),
  migrations: {
    path: resolve(__dirname, "prisma/migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
