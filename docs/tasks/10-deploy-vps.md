# Task 10 — Deploy to the shvedov.tech VPS (traveller.shvedov.tech)

Read `CLAUDE.md` first. Prereqs: tasks 08-09.

## Target topology

The VPS already runs the blog stack at `/srv/shvedov` (compose project `shvedov`): Caddy (ports 80/443, network `shvedov_edge`), the blog site, umami. Traveller becomes a **separate compose stack** at `/srv/traveller`: postgres + redis + api + web. Caddy (from the blog stack) terminates TLS for `traveller.shvedov.tech` and routes:

- `/api/*` → `traveller-api:4000` (path preserved, NOT stripped — see §0)
- everything else → `traveller-web:3000`

Same-origin → no COOKIE_DOMAIN needed; cookies just work. The Caddyfile lives in the blog repo — its change is handled OUTSIDE this task (separate PR); this task only needs api/web reachable on the external network `shvedov_edge` under network aliases `traveller-api` / `traveller-web`.

## 0. API path prefix — CRITICAL, do this first

Today the NestJS API serves routes at the root (`/auth/...`, `/me/...`, `/users/...`) and the dev proxy STRIPS `/api` (`/api/:path*` → `localhost:4000/:path*`). This is a latent production bug: the refresh cookie is set with `Path=/auth/refresh`, but the browser always calls `/api/auth/refresh` (through the dev rewrite and through Caddy), so the cookie path never matches and **token refresh silently fails** — the API e2e tests miss it (supertest hits the API directly at `/auth/refresh`) and Playwright misses it (access token lives 15 min, tests are shorter).

Fix by making `/api` a real, consistent prefix everywhere (no stripping anywhere):

- **NestJS**: `app.setGlobalPrefix('api')` in `main.ts`, but **exclude** the health route so infra can hit `http://traveller-api:4000/healthz` directly (`setGlobalPrefix('api', { exclude: ['healthz'] })` or move healthz out of the prefix). All app routes now live under `/api/...`.
- **Dev proxy** (`apps/web/next.config`): change the rewrite to pass the prefix through — `/api/:path*` → `http://localhost:4000/api/:path*`.
- **Caddy (prod)**: forward `/api/*` preserving the path (`handle /api/* { reverse_proxy traveller-api:4000 }`, NOT `handle_path`).
- **Refresh cookie path**: becomes `/api/auth/refresh` (a single constant in `apps/api/src/common/cookies.ts`). Now it matches the browser-visible URL in both dev and prod. Keep it a named constant.
- **Magic-link verify URL & Google OAuth callback**: they build on `API_URL` — ensure the constructed paths include the prefix (`${API_URL}/api/auth/...`) OR set `API_URL` to already include `/api` and keep the sub-paths; pick one and be consistent. Google `OAUTH_CALLBACK_URL` likewise `.../api/auth/google/callback`.
- **Update every test/path reference**: all API e2e specs (`/auth/...` → `/api/auth/...`, `/me/...` → `/api/me/...`, `/users/...` → `/api/users/...`, but healthz stays `/healthz`), the web `api-client` base path, SSR fetchers, Playwright specs, and any hardcoded route in components. Keep `pnpm turbo lint typecheck test build` and the full Playwright suite green after the change — this is the bulk of the work in this task, do it carefully and mechanically.
- Sanity check after: a browser hitting `/api/auth/refresh` sends the refresh cookie (path matches); `/healthz` is reachable without the prefix for the compose healthcheck.

## Create in this repo

1. **`apps/web/Dockerfile`** — multi-stage Next.js standalone build (`output: 'standalone'` in next.config if not set), non-root, port 3000. Mind the monorepo: build from repo root context like the api Dockerfile does (pnpm deploy or turbo prune). `.dockerignore` update if needed.
2. **URL wiring for prod** (after §0's prefix change; check current code and adapt minimally):
   - Client-side calls stay same-origin `/api/*` (Caddy handles them in prod; Next rewrite keeps handling them in dev).
   - SSR fetches (profile page/OG) use an internal URL: env `API_INTERNAL_URL` (prod: `http://traveller-api:4000`; dev default `http://localhost:4000`). Remember the prefix: SSR calls `${API_INTERNAL_URL}/api/users/...`.
   - `NEXT_PUBLIC_SITE_URL=https://traveller.shvedov.tech` for metadata/OG/share links (metadataBase).
   - API: `API_URL=https://traveller.shvedov.tech/api` (magic-link verify links), `WEB_ORIGIN=https://traveller.shvedov.tech`, `TRUST_PROXY=1`, Google callback URL env stays optional.
3. **`deploy/docker-compose.prod.yml`** — services:
   - `postgres` (16-alpine, volume `pg_data`, internal network only, healthcheck)
   - `redis` (7-alpine, internal only)
   - `api` (image `ghcr.io/shvedoff1/traveller-api:${TAG:-latest}`, entrypoint already runs `prisma migrate deploy`, networks: internal + `edge` with alias `traveller-api`, depends_on healthy pg/redis, env from `.env`)
   - `web` (image `ghcr.io/shvedoff1/traveller-web:${TAG:-latest}`, networks: internal + `edge` alias `traveller-web`)
   - `networks: edge: { external: true, name: shvedov_edge }` + internal network
   - No published ports at all — only Caddy reaches api/web via the edge network.
4. **`deploy/.env.example`** — documented prod env (POSTGRES_PASSWORD, DATABASE_URL, REDIS_URL, JWT_SECRET, API_URL, WEB_ORIGIN, NEXT_PUBLIC_SITE_URL, API_INTERNAL_URL, SMTP_* for Resend, MAIL_FROM, TRUST_PROXY, rate-limit overrides optional).
5. **`.github/workflows/deploy.yml`** — modeled on the blog repo's deploy (build → ghcr → SSH), adapted:
   - `on: push: branches: [main]` + `workflow_dispatch`; concurrency group `deploy`.
   - Job 1 reuse CI? The existing `ci.yml` already runs on push; deploy workflow just needs images: build+push `traveller-api` and `traveller-web` images to ghcr (docker/build-push-action, tags `latest` + `sha-<short>`), permissions packages:write.
   - Job 2: SSH (appleboy/ssh-action, secrets `SSH_HOST`/`SSH_USER`/`SSH_KEY` — same VM as the blog) → `cd /srv/traveller && export TAG=sha-<short> && docker compose pull && docker compose up -d && docker compose restart` is NOT needed for caddy (it's in the other stack) BUT note: after recreating api/web, caddy may cache stale DNS — the runbook must mention bouncing caddy from /srv/shvedov, and the deploy script should do it: `docker restart $(docker ps -qf name=caddy)` (tolerate absence).
   - Deploy job gated `if: github.ref == 'refs/heads/main'`.
6. **`deploy/DEPLOY.md`** — step-by-step runbook:
   - DNS: A record `traveller.shvedov.tech` → VPS IP (manual, done by the owner).
   - VPS prep: `mkdir -p /srv/traveller`, copy `deploy/docker-compose.prod.yml` → `/srv/traveller/docker-compose.yml`, create `.env` from example, verify `docker network ls | grep shvedov_edge`.
   - Resend (or Brevo) setup: account, domain/sender verification, API key → SMTP env values.
   - GitHub: repo secrets SSH_HOST/SSH_USER/SSH_KEY; ghcr images are private by default → either make packages public or `docker login ghcr.io` on the VPS with a read PAT (document both, recommend public for simplicity).
   - Caddy: reference the exact server block that goes into the blog repo's Caddyfile (include it verbatim in the runbook for review).
   - First deploy + verification checklist (healthz via caddy, login loop with real email, OG image, seed NOT run in prod).
7. CI note: deploy workflow must NOT break the existing ci.yml; keep them separate files.

## Verification (local)

- `docker build -f apps/web/Dockerfile .` and `-f apps/api/Dockerfile .` both succeed locally (use the proxy CA hook documented in the api Dockerfile header).
- `docker compose -f deploy/docker-compose.prod.yml config` validates (with a stub .env; the external network check may need `docker network create shvedov_edge` locally — fine).
- Boot the prod compose locally end-to-end (create the network, minimal .env, `TAG=local` images built above): healthz OK via `docker exec`, web serves `/` — then tear down.
- `pnpm turbo lint typecheck test build` stays green.

## Acceptance criteria

- [ ] Both images build; prod compose boots locally with the external network
- [ ] deploy.yml is a faithful adaptation of the blog's pattern (ghcr + SSH + TAG pin + caddy bounce)
- [ ] DEPLOY.md complete enough for the owner to go live without asking anything
- [ ] Turbo pipeline green; committed on the current branch
