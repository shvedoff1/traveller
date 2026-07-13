import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

/**
 * Environment contract, validated with zod at boot — fail fast.
 *
 * DATABASE_URL, REDIS_URL and JWT_SECRET are required (auth landed in
 * task 01); Google OAuth stays optional — the strategy only registers
 * when GOOGLE_CLIENT_ID is set.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Public base URL of this API — used to build magic-link URLs. */
  API_URL: z.string().url().default("http://localhost:4000"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  COOKIE_DOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate an env-shaped record. Empty strings are treated as
 * unset (e.g. `GOOGLE_CLIENT_ID=` in a .env file). Throws with a readable
 * per-variable message on failure.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/** Load a .env file if present: app-local first, then the repo root. */
function loadDotEnv(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

let cached: Env | undefined;

/** Validated environment, loaded once at boot. */
export function loadEnv(): Env {
  if (!cached) {
    loadDotEnv();
    cached = parseEnv(process.env);
  }
  return cached;
}
