# Traveller 🌍

Mark the countries you've visited on an interactive globe, follow friends,
compare maps and share a public profile at `traveller.app/<username>`.

> _Screenshot placeholder — the globe with a few visited countries, the
> country panel and the stats bar._

- **Interactive globe** — MapLibre GL globe projection (flattens as you zoom
  in), hover highlights, click to mark, slow idle rotation.
- **Visits with details** — optional year + note per country, optimistic
  updates everywhere, live world/continent stats.
- **Friends** — search travellers, follow them and overlay a friend's map on
  yours (mine / theirs / both).
- **Public profiles** — server-rendered `/<username>` pages with an OG image
  for link previews.
- **Passwordless auth** — email magic links (and Google OAuth when
  configured). Short-lived JWT + rotating refresh tokens, httpOnly cookies.
- **Light & dark themes**, mobile-first layout, rate limiting, Redis caching.

## Quickstart

Prerequisites: Node 22, pnpm 10 (`corepack enable`), Docker.

```bash
docker compose up -d               # postgres:16, redis:7, mailpit (dev SMTP)
pnpm install
cp .env.example .env               # defaults match docker-compose
pnpm --filter api exec prisma migrate dev   # create/apply migrations
pnpm --filter api exec prisma db seed       # demo users: john, maria, kenji, amara
pnpm turbo dev                     # web http://localhost:3000, api :4000
```

Log in with any email address — the magic link lands in Mailpit at
<http://localhost:8025>. In dev the web app proxies `/api/*` to the API, so
everything is same-origin.

### Tests

```bash
pnpm turbo lint typecheck test build   # unit + e2e (needs docker compose up)
pnpm --filter web test:e2e             # Playwright smoke (boots both apps)
```

The API e2e tests run against a dedicated `traveller_test` database and the
real Redis. Playwright expects the compose services (and seeds nothing — it
creates throwaway users through Mailpit).

## Environment

Set in `.env` at the repo root (validated with zod at API boot — invalid
config fails fast). See `.env.example` for the full commented list.

| Variable               | Required | Default                        | Purpose                                              |
| ---------------------- | -------- | ------------------------------ | ---------------------------------------------------- |
| `DATABASE_URL`         | ✅       | —                              | PostgreSQL connection string                         |
| `REDIS_URL`            | ✅       | —                              | Redis (rate limiting + profile cache)                |
| `JWT_SECRET`           | ✅       | —                              | Signs 15-min access tokens                           |
| `PORT`                 |          | `4000`                         | API port                                             |
| `API_URL`              |          | `http://localhost:4000`        | Public API base URL (magic-link URLs)                |
| `WEB_ORIGIN`           |          | `http://localhost:3000`        | CORS allowlist (single origin) + redirect target     |
| `GOOGLE_CLIENT_ID`     |          | unset                          | Google OAuth (strategy registers only when set)      |
| `GOOGLE_CLIENT_SECRET` |          | unset                          | Google OAuth secret                                  |
| `OAUTH_CALLBACK_URL`   |          | unset                          | Google callback (on the API)                         |
| `SMTP_HOST`/`SMTP_PORT`|          | `localhost`/`1025`             | Magic-link mail (Mailpit in dev)                     |
| `SMTP_USER`/`SMTP_PASS`|          | unset                          | SMTP auth — all-or-nothing (see Production email)    |
| `SMTP_SECURE`          |          | `false`                        | `true` → implicit TLS (465); else STARTTLS           |
| `MAIL_FROM`            |          | dev default                    | From header for outgoing mail                        |
| `MAGIC_LINK_*_MAX`     |          | `5`/`10`/`20`/`200`            | Magic-link anti-abuse caps (IP / daily / global)     |
| `COOKIE_DOMAIN`        |          | unset                          | Cookie domain (leave empty for host-only)            |
| `TRUST_PROXY`          |          | `false`                        | `true` behind a reverse proxy (real client IPs)      |
| `NEXT_PUBLIC_API_URL`  |          | `/api`                         | Browser → API base URL (web build-time)              |

## Architecture

Turborepo monorepo (pnpm workspaces) — separable services, not a monolith:

```
apps/web          Next.js 15 (App Router, Tailwind v4) — UI, SSR public
                  profiles, OG images. TanStack Query + zustand.
apps/api          NestJS — stateless REST API. JWT verified locally; rotating
                  refresh tokens hashed in Postgres (family revocation on
                  reuse). Redis: rate limits + cache-aside public profiles.
packages/shared   The contract: zod schemas for every request/response, the
                  canonical ISO-3166-1 alpha-2 country list, world SVG paths.
```

- **Country codes**: ISO-3166-1 alpha-2 (`FR`, `JP`) everywhere — DB, API,
  map join key, stats.
- **Map**: one static GeoJSON (`apps/web/public/geo/countries.geojson`)
  joined to visits client-side via feature-state; no external tile servers.
- **Rate limits**: global 100/min/IP, magic links 3/15min/email, search
  20/min/user, visit writes 60/min/user (Redis fixed windows).
- **Security**: helmet with a deny-all CSP (JSON-only API), CORS locked to
  `WEB_ORIGIN`, custom-header CSRF guard on every mutation, httpOnly
  SameSite=Lax cookies.

## Deployment notes

The two apps deploy independently:

- **Web → Vercel** (or any Node host). Set `NEXT_PUBLIC_API_URL` to the
  public API origin, or keep `/api` and proxy `/api/*` to the API at the
  edge (same-origin cookies are the simplest setup).
- **API → any container host** (Fly.io, Railway, Render, ECS…):

  ```bash
  docker build -f apps/api/Dockerfile -t traveller-api .
  docker run -p 4000:4000 --env-file .env traveller-api
  ```

  The entrypoint runs `prisma migrate deploy` before starting, so releases
  apply their own migrations. Set `TRUST_PROXY=true` behind the platform's
  load balancer. Building behind a TLS-intercepting proxy? See the header
  of `apps/api/Dockerfile` for the `EXTRA_CA_CERT` build arg.
- **Postgres → Neon** (or RDS etc.) and **Redis → Upstash** — both apps are
  stateless, so the managed connection strings are the only wiring. Use the
  pooled Neon connection string for the API.
- **Cookies**: the API sets auth cookies for its own host. Serve web + API
  under one site (e.g. `app.example.com` + `api.example.com` with
  `COOKIE_DOMAIN=.example.com`) or proxy `/api/*` same-origin.

### Production email

In dev, magic links land in Mailpit with no configuration. For production,
point the API at a real SMTP provider:

- **Resend** — `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`,
  `SMTP_PASS=<your API key>`, `SMTP_PORT=587` (STARTTLS, `SMTP_SECURE=false`).
- **Brevo** — `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_USER=<login>`,
  `SMTP_PASS=<SMTP key>`. Use `SMTP_PORT=465` with `SMTP_SECURE=true` for
  implicit TLS, or `587`/STARTTLS.

`SMTP_USER` and `SMTP_PASS` are required together (the API fails fast at boot
if only one is set). Set `MAIL_FROM` to a verified sender, e.g.
`Traveller <login@yourdomain.tech>`.

The `POST /auth/magic-link` endpoint is safe to expose publicly: it is
throttled per-email (3/15min, 10/day) and per-IP (5/15min, 20/day), with a
service-wide 200/day ceiling that protects the provider quota by silently
skipping sends once reached. A hidden honeypot field drops bot submissions.
All responses are non-enumerating — the same `200 {ok:true}` whether a link
was sent, skipped, or the address is unknown. Behind a reverse proxy set
`TRUST_PROXY=true` so the per-IP limits see the real client address. Tune the
caps via the `MAGIC_LINK_*_MAX` env vars.

## Repo conventions

- Everything ships with tests in the same commit (`docs/tasks/` has the
  milestone specs).
- CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on
  every push.
