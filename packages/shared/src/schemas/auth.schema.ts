import { z } from "zod";

/** Normalised email address: trimmed, lowercased, RFC-length-capped. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

/** POST /auth/magic-link request body. */
export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  /**
   * Honeypot: a hidden field real users never fill. Kept optional (not
   * stripped) so the server can detect bots that populate it and silently
   * skip the send. Legitimate clients omit it or send an empty string.
   */
  website: z.string().optional(),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

/** POST /auth/magic-link response — always 200, never leaks existence. */
export const magicLinkResponseSchema = z.object({
  ok: z.literal(true),
});
export type MagicLinkResponse = z.infer<typeof magicLinkResponseSchema>;

/** GET /auth/providers response — which login methods the API offers. */
export const authProvidersSchema = z.object({
  google: z.boolean(),
  magicLink: z.boolean(),
});
export type AuthProviders = z.infer<typeof authProvidersSchema>;
