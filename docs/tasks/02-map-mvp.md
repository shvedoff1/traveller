# Task 02 — Map MVP: globe ↔ flat map, country geometry, canonical country list

Read `CLAUDE.md` first. Prereq: task 00. Independent of task 01 (no auth needed here).

## Country data pipeline

- `scripts/prepare-geo.mjs` (root `scripts/`, run with `node`, one-time — **commit its outputs**):
  1. Download Natural Earth 50m admin-0 countries GeoJSON (e.g. from `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson`). If the network/proxy blocks it, try the `world-atlas` npm package (50m TopoJSON) instead.
  2. Resolve ISO alpha-2 per feature: `ISO_A2`, falling back to `ISO_A2_EH` when `-99` (France, Norway quirk). Drop features without a usable code (Antarctica stays if it has AQ — include it, render it, but it's fine if unlisted in COUNTRIES).
  3. Simplify geometry (mapshaper CLI via npx, ~10% retention) to keep the file ≲ 2 MB raw.
  4. Write `apps/web/public/geo/countries.geojson` with each feature: `{ id: <iso2>, properties: { iso: <iso2>, name } }`.
  5. Generate `packages/shared/src/world-paths.ts`: equirectangular-projected simplified SVG path per country `{ [iso2]: string }` (viewBox 0 0 1000 500) — used later for OG images.
  6. Fail loudly if the GeoJSON codes and `COUNTRIES` list diverge (missing either way, minus an explicit allowlist like AQ).

- `packages/shared/src/countries.ts` — replace the stub with the **full ISO-3166-1 list** (~249 entries): `{ code, name, continent, emoji }`. Emoji derived from regional indicator symbols. Continents: Africa, Asia, Europe, North America, South America, Oceania, Antarctica.
- Shared vitest tests: codes unique/valid format, emoji derivation correct, every GeoJSON feature id exists in COUNTRIES (load the committed geojson in the test) modulo allowlist, world-paths keys ⊆ COUNTRIES codes.

## Map (apps/web)

- Install `maplibre-gl` (v5+).
- `components/map/MapCanvas.tsx` (client component):
  - Init map with **globe projection** (`projection: 'globe'`) — MapLibre v5 renders a globe at low zoom that flattens as you zoom in. Minimal custom style (no external tile server): dark background `#0B0E14`, subtle space/atmosphere, GeoJSON source `countries` from `/geo/countries.geojson` with `promoteId: 'iso'`.
  - Layers: `countries-fill` (base: desaturated dark gray), `countries-visited` (accent fill, filtered by visited codes — empty for now), hover highlight via feature-state (`hover`), selected country outline.
  - Cursor pointer on hover; `click` → resolve feature → call `onCountryClick(iso)` prop. For now the page handles it by toggling a local zustand set (real persistence in task 03) — so clicking already colors countries in-session.
  - Slow idle rotation when zoomed out and idle >5 s, stops on interaction.
- `lib/stores/map-store.ts` (zustand): selected country, hovered country, local visited set (temporary until task 03).
- `app/page.tsx` — full-viewport map, floating minimal header (wordmark left, login chip right). No country panel yet (task 03).
- Tests: vitest for any pure helpers (e.g. style/filter builders — extract them as pure functions `buildVisitedFilter(codes)` etc. so they're testable without WebGL). Playwright is NOT required in this task (WebGL in CI is flaky); acceptance is manual.

## Acceptance criteria

- [ ] `pnpm turbo dev` → `/` shows a dark globe; zooming in flattens it smoothly; pan/zoom smooth
- [ ] Hover highlights a country, click toggles an accent fill (session-local)
- [ ] `countries.geojson` committed, ≲2 MB, every feature has iso id
- [ ] Full COUNTRIES list + world-paths committed in shared, integrity tests pass
- [ ] `pnpm turbo lint typecheck test build` green; committed on the current branch
