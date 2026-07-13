# Task 04 — Public profile /[username] + stats API + OG image (sharing)

Read `CLAUDE.md` first. Prereqs: task 03. This is the growth loop: `traveller.com/john` must look great logged-out and unfurl beautifully in social apps.

## API (apps/api)

- `modules/stats/` — `GET /users/:username/stats` → `{ countryCount, worldPercent, continents: { [name]: { visited, total } }, followerCount, followingCount }` (follow counts return 0 until task 05 — read from the Follow table, which exists).
- **Redis cache-aside** for `GET /users/:username` (profile incl. countryCodes) and stats: keys `profile:{username}` / `stats:{username}`, TTL 60 s, `JSON` values. **Explicit invalidation**: on any visit PUT/DELETE and on PATCH /me (username/display change), delete both keys for that user (old username too when it changes).
- 404 for unknown username; respect `isPublic=false` → 404 (viewer-is-self exception can wait).
- e2e tests: cache hit (second call doesn't hit DB — assert via spy or by mutating DB directly and seeing stale value), invalidation on visit write (mutate via PUT → profile reflects immediately), 404s, stats math vs seeded data.

## Web (apps/web)

- `app/[username]/page.tsx` — server component, `fetch(API/users/:username, { next: { revalidate: 60 } })`, `notFound()` on 404. Lowercase param; 301 redirect non-canonical casing. Renders:
  - `components/profile/ProfileHeader.tsx` — avatar, display name, @username, share button (copies URL, subtle toast). Follow button placeholder (task 05).
  - Read-only `MapCanvas` (prop `readonly` — no click-to-toggle, still hover/zoom) with the profile's visited codes.
  - `StatsBar` with their stats.
  - Metadata: title "John — 47 countries", description with world %.
- `app/[username]/opengraph-image.tsx` — `next/og` `ImageResponse` 1200×630: dark background, mini world map from `world-paths.ts` (visited paths in accent color, rest muted), display name + "47 countries · 24% of the world". Same revalidate.
- Own-profile awareness: when the logged-in viewer is the profile owner, show an "Edit your map →" link back to `/`.
- Tests: vitest for og/stats formatting helpers; e2e-ish route test if cheap. Playwright: extend smoke — after marking a country, open own `/username` logged-out (new context) and assert name + count render.

## Acceptance criteria

- [ ] `/john` (seeded) renders logged-out: header, colored read-only map, stats
- [ ] Marking a country then hitting the API profile endpoint reflects the change ≤ immediately (invalidation works)
- [ ] `curl /john/opengraph-image` returns a PNG with correct dimensions
- [ ] Share button copies the public URL
- [ ] All tests pass; `pnpm turbo lint typecheck test build` green; committed
