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
  /**
   * Public base URL of this API, including the `/api` global prefix — used to
   * build magic-link verify and OAuth callback URLs (e.g.
   * `https://traveller.shvedov.tech/api`).
   */
  API_URL: z.string().url().default("http://localhost:4000/api"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  /** SMTP auth — optional in dev (Mailpit needs none). Required together. */
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** true → implicit TLS (port 465); false → plaintext/STARTTLS (587/1025). */
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** From header for outgoing mail, e.g. `Traveller <login@example.com>`. */
  MAIL_FROM: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  /** Anti-abuse caps on POST /auth/magic-link (per 15 min / 24 h windows). */
  MAGIC_LINK_IP_MAX: z.coerce.number().int().min(1).default(5),
  MAGIC_LINK_EMAIL_DAILY_MAX: z.coerce.number().int().min(1).default(10),
  MAGIC_LINK_IP_DAILY_MAX: z.coerce.number().int().min(1).default(20),
  MAGIC_LINK_GLOBAL_DAILY_MAX: z.coerce.number().int().min(1).default(200),
  /** Set to true when the API runs behind a reverse proxy (X-Forwarded-For). */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
}).superRefine((env, ctx) => {
  // SMTP credentials are all-or-nothing: a user without a password (or vice
  // versa) is a misconfiguration we want to catch at boot, not at send time.
  if (env.SMTP_USER && !env.SMTP_PASS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SMTP_PASS"],
      message: "SMTP_PASS is required when SMTP_USER is set",
    });
  }
  if (env.SMTP_PASS && !env.SMTP_USER) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SMTP_USER"],
      message: "SMTP_USER is required when SMTP_PASS is set",
    });
  }
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
