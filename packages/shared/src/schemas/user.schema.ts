import { z } from "zod";

/** Username rules: 3-30 chars, lowercase letters, digits, underscore. */
export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export const usernameSchema = z
  .string()
  .regex(
    USERNAME_REGEX,
    "3-30 characters: lowercase letters, digits, underscore",
  );

/** GET /auth/me response — the authenticated user. */
export const meResponseSchema = z.object({
  id: z.string().uuid(),
  username: usernameSchema.nullable(),
  displayName: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  isPublic: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** PATCH /me request body — claim a username and/or rename. */
export const updateMeSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine(
    (value) => value.username !== undefined || value.displayName !== undefined,
    { message: "Provide username or displayName" },
  );
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** GET /users/:username response — a public profile. */
export const publicProfileSchema = z.object({
  username: usernameSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  countryCodes: z.array(z.string().length(2)),
  counts: z.object({
    countries: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
  }),
  /**
   * Whether the requesting user follows this profile. Only present when
   * the request is authenticated — anonymous reads omit it (it is
   * per-viewer and therefore never cached).
   */
  isFollowing: z.boolean().optional(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;
