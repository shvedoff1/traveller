import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke tests — run with `pnpm --filter web test:e2e`.
 *
 * Deliberately NOT part of the `turbo test` pipeline: it needs the
 * dockerized Postgres/Redis/Mailpit plus a browser, which CI's test job
 * doesn't provide. Both dev servers are booted below (and reused when
 * already running).
 */
// The API's own env loading reads the repo-root .env; the prisma CLI does
// not, so mirror the docker-compose default here (real env vars win).
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://traveller:traveller@localhost:5432/traveller";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // One worker: the specs share a single dev server, Postgres and Redis, and
  // magic-link login is rate-limited per IP — running spec files in parallel
  // oversubscribes all three and flakes the heavier flows. Serial is the
  // intended execution model here.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "pnpm --filter api exec prisma migrate deploy && pnpm --filter api exec nest start",
      cwd: "../..",
      port: 4000,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { DATABASE_URL },
    },
    {
      command: "pnpm dev",
      port: 3000,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
