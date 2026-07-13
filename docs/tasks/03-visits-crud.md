# Task 03 — Visited countries: API CRUD + country panel + stats bar (core product)

Read `CLAUDE.md` first. Prereqs: tasks 01 (auth) and 02 (map) are done.

## API (apps/api)

`modules/visits/`:
- `GET /me/visits` → `[{ countryCode, visitedYear?, note?, createdAt }]`
- `PUT /me/visits/:countryCode` `{ visitedYear?, note? }` — idempotent upsert; validate code against `COUNTRY_CODES` from `@traveller/shared` (400 on unknown); zod: year 1900..current, note ≤280.
- `DELETE /me/visits/:countryCode` — idempotent (204 even if absent).
- All behind JwtAuthGuard + CSRF header guard.
- Shared: `visit.schema.ts`.

e2e tests: upsert creates then updates (idempotent), invalid code 400, invalid year 400, delete idempotent, unauthenticated 401, full list roundtrip.

## Web (apps/web)

- `['visits','me']` TanStack Query + mutations with **optimistic updates** (toggle recolors the map instantly, rollback on error, invalidate on settle).
- `components/map/useMapVisits.ts` — bridges query data into MapCanvas visited filter/feature-state; replaces the temporary zustand visited set from task 02. Clicking the map = toggle mutation (when logged in; logged out → prompt to login via a subtle toast/CTA).
- `components/country-panel/`:
  - `CountryPanel.tsx` — floating glassmorphism panel on the right (`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl`), full-height with margin, collapsible. Sections: "Visited (N)" then "All countries".
  - `CountrySearch.tsx` — client-side fuzzy filter (simple normalized `includes` is fine) over shared COUNTRIES.
  - `CountryRow.tsx` — emoji flag, name, check state, whole row toggles; hover on row highlights country on the map; click also `flyTo` the country (compute centroid from geojson bbox or precompute centroids into shared during prepare-geo — pick one and keep it simple).
  - `CountryDetailSheet.tsx` — opens on selected country: mark/unmark button, year picker, note input (saves via the same PUT).
  - Virtualize the list only if perf demands it — 249 rows may be fine; measure first.
- `components/stats/StatsBar.tsx` — floating bottom-left: big count, "X% of the world", per-continent mini progress. Pure math helpers in shared or `lib/stats.ts` with vitest tests.
- Mobile: panel collapses to a floating search pill (basic version; polish in task 06).

Web tests: vitest for stats math, fuzzy filter, optimistic cache logic (pure parts extracted). Playwright smoke (chromium is preinstalled; see CLAUDE.md env notes): seed-login via magic link (request link through API, fetch token from Mailpit HTTP API :8025, visit verify URL) → open `/` → toggle a country via the panel → assert row checked and count incremented → reload → still there.

## Acceptance criteria

- [ ] Click on map or panel row → country fills with accent instantly; survives reload; unmark works
- [ ] Search filters the list; picking a result flies the map to the country
- [ ] Year + note persist and re-display
- [ ] StatsBar shows count, world %, continents; updates optimistically
- [ ] All API e2e + web tests pass; `pnpm turbo lint typecheck test build` green; committed
