# Task 00 — Scaffold the monorepo

Read `CLAUDE.md` first. This task creates the foundation everything else builds on. The repo currently contains only `CLAUDE.md`, `docs/tasks/`, `.github/workflows/ci.yml`, `.gitignore`.

## Create

**Root**
- `package.json` — private, `"packageManager": "pnpm@10.x"`, scripts delegating to turbo (`dev`, `build`, `lint`, `typecheck`, `test`).
- `pnpm-workspace.yaml` — `apps/*`, `packages/*`.
- `turbo.json` — tasks: `build` (dependsOn `^build`), `dev` (persistent, no cache), `lint`, `typecheck`, `test` (dependsOn `^build`).
- `docker-compose.yml` — `postgres:16-alpine` (5432, volume, POSTGRES_PASSWORD=traveller, POSTGRES_DB=traveller), `redis:7-alpine` (6379), `axllent/mailpit` (1025/8025).
- `.env.example` — documented vars for api and web (DATABASE_URL, REDIS_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, OAUTH_CALLBACK_URL, SMTP host/port, WEB_ORIGIN, COOKIE_DOMAIN, PORT, NEXT_PUBLIC_API_URL).

**packages/tsconfig** — `@traveller/tsconfig`: `base.json`, `next.json`, `nest.json`.

**packages/eslint-config** — `@traveller/eslint-config`: flat-config presets `base`, `next`, `nest` (eslint 9, typescript-eslint).

**packages/shared** — `@traveller/shared`, TS, built with `tsc` (or tsup), exports from `src/index.ts`:
- `src/countries.ts` — stub for now: export `COUNTRIES: { code: string; name: string; continent: Continent; emoji: string }[]` with ~10 entries and a `COUNTRY_CODES` set + `isCountryCode()` helper (full list arrives in task 02).
- `src/schemas/` — empty barrel for now.
- vitest configured; test: country codes are unique and uppercase 2-letter.

**apps/web** — Next.js 15, App Router, TypeScript, Tailwind v4, src-less `app/` layout:
- Dark minimalist shell: `app/layout.tsx` (Inter/Geist font, near-black `#0B0E14` background), `app/page.tsx` placeholder ("Traveller" wordmark centered).
- `next.config.ts` — `rewrites()`: `/api/:path*` → `http://localhost:4000/:path*` (dev proxy).
- vitest + @testing-library configured; one smoke test (page renders wordmark).
- Depends on `@traveller/shared` (workspace).

**apps/api** — NestJS 10+, TypeScript:
- `src/main.ts` — helmet, cookie-parser, CORS (origin `WEB_ORIGIN`, credentials true), port 4000.
- `src/config/env.ts` — zod-validated env loaded at boot, fail fast (only require what exists at this stage: PORT, WEB_ORIGIN; DB/Redis vars optional until task 01).
- `src/app.module.ts` + `src/modules/health/` — `GET /healthz` returning `{ status: 'ok' }`.
- Jest + supertest e2e test: `GET /healthz` → 200.

## Constraints

- pnpm 10, node 22 (both already installed).
- Everything must pass: `pnpm turbo lint typecheck test build` from the repo root.
- Verify `docker compose up -d` works and `pnpm turbo dev` boots both apps (web on 3000 serves the placeholder; `curl localhost:4000/healthz` → ok). Kill dev processes when done.
- The existing `.github/workflows/ci.yml` skips steps when there is no `pnpm-lock.yaml`; after this task the lockfile exists, so CI runs for real — make sure the four turbo tasks pass locally before committing.

## Acceptance criteria

- [ ] `pnpm install && pnpm turbo lint typecheck test build` succeeds from a clean checkout
- [ ] `pnpm turbo dev` starts web (3000) + api (4000); `/healthz` returns ok; web renders
- [ ] `docker compose up -d` brings up postgres, redis, mailpit
- [ ] Tests exist for: shared country stub, api healthz, web smoke
- [ ] Committed with a clear message on the current branch
