import { type Env } from "../config/env";

/** Dev default From header when MAIL_FROM is unset (Mailpit). */
export const DEFAULT_MAIL_FROM = '"Traveller" <no-reply@traveller.local>';

/** Nodemailer transport options — the subset we build from the environment. */
export interface TransportOptions {
  host: string;
  port: number;
  /** true → implicit TLS (465); false → plaintext, upgraded via STARTTLS. */
  secure: boolean;
  auth?: { user: string; pass: string };
}

/**
 * Pure env → nodemailer-transport mapping. Kept separate from MailService so
 * the three real-world shapes (Mailpit, Resend-style 587 STARTTLS, 465
 * implicit TLS) can be unit-tested without a live SMTP server.
 *
 * Auth is only attached when a user is configured — Mailpit accepts no
 * credentials and nodemailer would otherwise try (and fail) to authenticate.
 */
export function buildTransportOptions(env: Env): TransportOptions {
  const options: TransportOptions = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
  };
  if (env.SMTP_USER && env.SMTP_PASS) {
    options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
  }
  return options;
}

/** From header for outgoing mail — MAIL_FROM, or the dev default. */
export function mailFrom(env: Env): string {
  return env.MAIL_FROM ?? DEFAULT_MAIL_FROM;
}
