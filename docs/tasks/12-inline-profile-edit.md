# Task 12 — Inline profile edit + immediate reflection on the share page

Read `CLAUDE.md` first. Prereq: task 11 merged. Branch `claude/travel-map-countries-ebipy5`.

Two linked user reports:
1. **Bug**: changed the display name in `/settings`, but the public share page
   `/{username}` still showed the old email-derived name. Cause: `/[username]`
   renders with ISR (`export const revalidate = 60`) and its server fetches sit
   behind Next's data cache, so a name change wouldn't surface for up to 60s —
   the API's own Redis invalidation on write is correct but doesn't reach Next.
2. **Feature**: let the owner edit their name/username *inline* on the profile
   page, next to where the display name and `@username` show.

## 1. On-demand revalidation

- `apps/web/app/actions/revalidate-profile.ts` — a `"use server"` action
  `revalidateProfile(usernames: string[])` that validates each handle against
  the canonical `USERNAME_REGEX` and calls `revalidatePath('/'+name)` for each
  (busts both the full-route and data cache for that path). Never revalidates
  arbitrary caller-supplied strings.
- Call it after every successful `PATCH /me`, for the old **and** the new
  username (a handle change moves the URL): from `SettingsForm` and from the
  inline editor.

## 2. Inline editor on the profile card

- `apps/web/components/profile/ProfileEditForm.tsx` — compact editor reusing the
  settings-form helpers (`buildUpdate`, `displayNameError`, `usernameError`,
  `updateErrorMessage`); handles the 409 taken-username case inline; on success
  primes `['me']`, revalidates, and hands the updated user back.
- `ProfileHeader.tsx` — owner-only pencil button next to the name reveals the
  editor. Header keeps a local mirror of name/handle so the change shows
  instantly; on a handle change it `router.replace('/'+newUsername)`, otherwise
  `router.refresh()`.

## Tests (convention #1)

- vitest: `profile-edit-form.test.tsx` (prefill, disabled-until-changed, 409
  inline error, cancel); extend `profile-header.test.tsx` (owner sees the
  pencil, visitors don't; inline save reflects the new name and refreshes;
  username change navigates); stub the server action + `next/navigation`.
- Keep `pnpm turbo lint typecheck test build` green.

## Acceptance criteria

- [x] Owner sees a pencil next to name/@username on `/{username}`; editing
      saves via PATCH /me with validation + 409 handled
- [x] The new name shows immediately on the card and on reload (no 60s lag),
      whether edited inline or in `/settings`
- [x] All tests pass; `pnpm turbo lint typecheck test build` green
