# Traveller

A site to mark countries you've visited: interactive globe/map, friends you can follow, public shareable profiles at `/<username>`.

## Non-negotiable conventions

1. **Everything gets tests.** Every module/feature ships with tests in the same commit:
   - `apps/api` — e2e tests (Jest + supertest) against real dockerized Postgres/Redis for every endpoint, plus unit tests for pure logic (token rotation, stats math).
   - `packages/shared` — vitest for schemas and country-list integrity.
   - `apps/web` — vitest for utilities (api-client, formatting) and component logic; Playwright smoke for key flows.
   - Code without tests does not get committed.
2. **Tests run on every push.** `.github/workflows/ci.yml` triggers on `push` (every branch): lint → typecheck → test → build. Keep it green; a red push must be fixed immediately in a follow-up commit.
3. **Every task ends with a PR and a green pipeline.** When a task is complete, open a PR and verify the CI pipeline on it is green before calling the task done. Fix failures until it is.

## Architecture

Turborepo monorepo (pnpm), designed as separable services, not a monolith:

```
apps/web          Next.js 15 (App Router, TS, Tailwind v4) — UI, SSR public profiles, OG images
apps/api          NestJS — stateless REST API (JWT verified locally, no session store)
packages/shared   The contract: zod schemas for every request/response, canonical
                  ISO-3166-1 alpha-2 country list, world SVG paths for OG images
packages/tsconfig, packages/eslint-config
```

- **Data**: PostgreSQL (Prisma) + Redis (throttling, cache-aside for public profiles/stats with explicit invalidation on writes).
- **Auth**: Google OAuth + email magic links (passwordless). JWT access token (15 min) + rotating opaque refresh token (30 days, hashed in PG, family revocation on reuse), both httpOnly cookies set by the API. OAuth callback lives on the API.
- **Map**: MapLibre GL v5 with globe projection (globe when zoomed out, flat when zoomed in). Country polygons: single static GeoJSON (`apps/web/public/geo/countries.geojson`) keyed by ISO alpha-2, joined to visits client-side via feature-state.
- **State (web)**: TanStack Query for server state, zustand for UI state. Marking a country is an optimistic mutation.
- **Country codes**: ISO-3166-1 alpha-2 (`FR`, `JP`) everywhere — DB, API validation, map join key, stats. Canonical list: `packages/shared/src/countries.ts`.

## Commands

```bash
docker compose up -d      # postgres:16 (5432), redis:7 (6379), mailpit (1025 smtp / 8025 ui)
pnpm install
pnpm turbo dev            # web :3000, api :4000 (web proxies /api/* → api in dev)
pnpm turbo lint typecheck test build
pnpm --filter api exec prisma migrate dev    # create/apply migrations
pnpm --filter api exec prisma db seed        # seed demo users (john, maria, kenji, amara)
```

## Environment

- Node 22, pnpm 10 (pinned via `packageManager`).
- API env is validated with zod at boot (fail fast). See `.env.example`.
- Google OAuth credentials are optional in dev: the Google strategy must register only when `GOOGLE_CLIENT_ID` is set; magic link (via Mailpit) is the always-available login path and the one used in tests.

## Workflow for tasks

Milestone specs live in `docs/tasks/NN-*.md` — each is self-contained (context, files to create, tests, acceptance criteria). Work happens on the branch `claude/travel-map-countries-ebipy5`; push after each completed milestone (CI runs per convention 2). The final PR goes to `main`.
