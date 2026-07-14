# Task 11 — Profile polish: self-profile nav, favicon, edit name/username

Read `CLAUDE.md` first. Prereq: v1 + tasks 08-10 merged. Branch `claude/travel-map-countries-ebipy5` (reset onto main). Three user-requested gaps.

Study first: `apps/web/components/header.tsx` (the UserChip — Friends link, avatar, @username, Log out), `apps/web/app/welcome/page.tsx` (username claim form + PATCH /me pattern), `apps/web/app/[username]/page.tsx` + `components/profile/ProfileHeader.tsx` (public profile + existing share button), `apps/web/lib/api-client.ts` (getMe, patchMe), `apps/api/src/modules/users/` (PATCH /me already validates username regex + displayName, 409 on taken), `packages/shared` user schema.

## 1. Flow to your own share page

There's currently no way to reach your public profile (`/{username}`) from the app. In the header `UserChip`:
- Make the avatar + `@username` a link to `/${username}` (your public profile) when `username` is set.
- If `username` is null (not claimed yet), link to `/welcome` instead.
- Keep it accessible (aria-label like "Your profile"), keep the glassmorphism look, don't break the existing Friends/Log out actions.
- On the public profile page, the owner already sees an "Edit your map →" link and a share button — leave those. Optionally add a small "Share" affordance in the header too if clean, but the profile link is the core ask.

## 2. Favicon

The app has no favicon. Add one via the App Router convention:
- `apps/web/app/icon.svg` — a minimal, on-brand glyph (a globe or map-pin in the teal accent `#0f9d84` on the dark `#0B0E14`, or transparent). Keep it crisp at 16–32px. Next.js serves it as the favicon automatically.
- Add `apps/web/app/apple-icon.png` (180×180) if straightforward, else skip.
- Confirm `<link rel="icon">` is emitted (Next auto-injects from app/icon.*). Don't hardcode conflicting icons in `metadata`.

## 3. Change display name (and username)

The display name still shows the email local-part (it defaults to that on first login) and there's no way to change it. Add a settings/edit-profile flow:
- New route `apps/web/app/settings/page.tsx` (auth-required; redirect to /login if not logged in) with a form to edit **displayName** and **username**, prefilled from `['me']`.
- Submit via the existing `PATCH /me` (api-client `patchMe`). Handle validation (username regex from shared, live feedback) and the **409** taken-username case with a clear inline error. displayName: non-empty, reasonable max.
- On success: invalidate `['me']`, toast success. Changing username changes the public URL — that's expected (API already invalidates the old-username cache); mention it near the field.
- Link to `/settings` from the header UserChip (a small "Settings" link or gear icon, aria-labeled). Keep the header uncluttered on mobile (the existing chip hides @username under md — keep settings reachable, e.g. an icon).
- Reuse the /welcome form logic/validation if it helps (extract a shared username-field component/helper if it reduces duplication).

## Tests (convention #1)

- vitest: any extracted pure helpers (username validation, form state). Component-logic tests for the settings form (prefill, 409 → inline error, success → invalidate) with mocked api-client, following existing web test patterns.
- Extend the Playwright suite (separate `test:e2e`, NOT in turbo test): after login, open `/settings`, change display name, save, assert it reflects (e.g. header/profile updates); assert the header profile link navigates to `/{username}`.
- Keep `pnpm turbo lint typecheck test build` green.

## Acceptance criteria

- [ ] Clicking your name/avatar in the header opens your public profile `/{username}` (or /welcome if unclaimed)
- [ ] A favicon shows in the browser tab
- [ ] `/settings` lets you change display name + username via PATCH /me, with 409 + validation handled; header/profile reflect the change
- [ ] All tests pass; `pnpm turbo lint typecheck test build` green; committed on the branch
