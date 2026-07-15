"use server";

import { USERNAME_REGEX } from "@traveller/shared";
import { revalidatePath } from "next/cache";

/**
 * On-demand revalidation for public profile pages. `/[username]` renders with
 * ISR (`revalidate = 60`) and its API fetches sit behind Next's data cache, so
 * a display-name or username change wouldn't surface for up to a minute. After
 * a successful `PATCH /me` the client calls this to bust the affected paths
 * immediately (both the old and new username when the handle changes), so a
 * reload shows the new name at once.
 *
 * Usernames are validated against the canonical regex before touching the
 * cache — this is a public server action, so we never revalidate arbitrary
 * caller-supplied paths.
 */
export async function revalidateProfile(usernames: string[]): Promise<void> {
  const unique = new Set(
    usernames
      .map((name) => name.trim().toLowerCase())
      .filter((name) => USERNAME_REGEX.test(name)),
  );
  for (const name of unique) {
    revalidatePath(`/${name}`);
  }
}
