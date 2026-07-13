# Deploying Traveller to the VPS (traveller.shvedov.tech)

Traveller runs as its own compose stack at **`/srv/traveller`** (postgres +
redis + api + web). TLS and routing are handled by the **existing Caddy** in
the blog stack (`/srv/shvedov`), which already owns ports 80/443 and the
external Docker network **`shvedov_edge`**.

**Split of responsibilities — so machine credentials live in exactly one place:**

- **This repo** only *builds and publishes* the two images to GHCR
  (`.github/workflows/publish-images.yml`, `GITHUB_TOKEN` only — no SSH, no app
  secrets here).
- **The blog repo** *provisions and deploys*: its `deploy traveller` workflow
  SSHes to the VPS (reusing the blog's existing `SSH_*` secrets), writes
  `/srv/traveller`, and rolls the stack forward. All app secrets live there as
  one base64 secret. See the blog repo's `DEPLOY-TRAVELLER.md`.

You need **no direct SSH access** to go live — the blog workflow does the
first-time provisioning too. Nothing runs the seed: **production starts empty**
and users self-register via magic-link login.

---

## 1. DNS (one-time)

Create an **A record**: `traveller.shvedov.tech` → the VPS public IP (the same
IP the blog uses). Check with `dig +short traveller.shvedov.tech`. Caddy
provisions the Let's Encrypt cert automatically on first request.

## 2. Email provider — Resend (recommended)

Magic-link login is the primary auth path, so a working SMTP sender is required.

1. Create a [Resend](https://resend.com) account.
2. **Add & verify a domain** — recommended a subdomain like `mail.shvedov.tech`
   (isolates sender reputation from your personal mail). Add the DKIM/SPF/MX
   records Resend shows to your DNS; verification must go green before sends
   succeed.
3. Create an **API key** (`re_...`, "Sending access").
4. These map to the env values below:
   - `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`
   - `SMTP_USER=resend`, `SMTP_PASS=re_...`
   - `MAIL_FROM=Traveller <login@mail.shvedov.tech>` (address on the verified domain)

Resend's free tier is 100 emails/day — keep `MAGIC_LINK_GLOBAL_DAILY_MAX` at or
below that (see `.env.example`). Brevo works too: host `smtp-relay.brevo.com`,
port `587`, `SMTP_SECURE=false`.

## 3. Build the env file

Copy `deploy/.env.example` → a local `.env`, fill in real values:

- `POSTGRES_PASSWORD` — strong random; **must match** the password inside
  `DATABASE_URL=postgresql://traveller:<pw>@postgres:5432/traveller`.
- `JWT_SECRET` — `openssl rand -hex 32`.
- `SMTP_*` + `MAIL_FROM` — from step 2.
- `API_URL=https://traveller.shvedov.tech/api`,
  `WEB_ORIGIN=https://traveller.shvedov.tech`,
  `API_INTERNAL_URL=http://traveller-api:4000`,
  `NEXT_PUBLIC_SITE_URL=https://traveller.shvedov.tech`, `TRUST_PROXY=true`.

This `.env` never gets committed — it becomes a single **base64 secret** in the
blog repo (next step).

## 4. Configure the blog repo (holds the deploy credentials)

In **shvedoff1/blog** → Settings → Secrets and variables → Actions, add:

| Secret | Value |
| ------ | ----- |
| `SSH_HOST`, `SSH_USER`, `SSH_KEY` | already present (blog deploy) — reused as-is |
| `TRAVELLER_ENV_B64` | `base64 -w0 < .env` of the file from step 3 (one line; on macOS `base64 < .env \| tr -d '\n'`) |
| `GHCR_PAT` *(optional)* | only if you keep the images private — a `read:packages` PAT |

**GHCR image visibility** — the images publish to
`ghcr.io/shvedoff1/traveller-api` and `…/traveller-web`, private by default.
Simplest: make both packages **public** (GitHub → your profile → Packages →
each → Package settings → Change visibility → Public), then no `GHCR_PAT` is
needed. The images contain only app code, no secrets.

## 5. Caddy (already merged)

The `traveller.shvedov.tech` server block is merged in the blog repo's
`Caddyfile` (shvedoff1/blog#2). It preserves the `/api` path (the API serves
under a real `/api` prefix — do not strip it, or token refresh breaks).

## 6. Go live

1. **Merge this repo's PR to `main`.** `publish-images.yml` builds and pushes
   `traveller-api` + `traveller-web` (`:latest` + `:sha-<short>`) to GHCR.
2. Make the two GHCR packages public (step 4) if you haven't.
3. In the **blog repo**, run **Actions → deploy traveller → Run workflow**
   (leave `tag` as `latest`, or pin a `sha-…`). It provisions `/srv/traveller`,
   writes the compose + `.env`, brings the stack up (the api entrypoint runs
   `prisma migrate deploy`), and bounces Caddy.

Re-running that workflow is also how you redeploy and change env later.

## 7. Verification checklist

- [ ] `https://traveller.shvedov.tech/` loads with a valid TLS cert.
- [ ] `https://traveller.shvedov.tech/api/auth/providers` returns JSON
      (Caddy forwards `/api/*` with the path preserved).
- [ ] **Login loop with a real email**: enter your address → receive the magic
      link → click → land logged in (`/welcome` on first login). Exercises SMTP
      **and** the `/api/auth/refresh` cookie path — the point of the `/api` prefix.
- [ ] Mark a country, reload → it persists.
- [ ] Public profile `https://traveller.shvedov.tech/<username>` renders SSR;
      `…/<username>/opengraph-image` returns a PNG.
- [ ] The DB has only real, self-registered users (no seed in prod).

## 8. Operations

- **Redeploy / change env**: update `TRAVELLER_ENV_B64` if needed, then re-run
  the blog's `deploy traveller` workflow.
- **Roll back**: run the workflow with an older `sha-…` tag (images stay in
  GHCR; migrations are forward-only).
- **Logs / DB backup** (needs SSH, when you have it): `docker compose logs -f
  api|web`; `docker compose exec postgres pg_dump -U traveller traveller > backup.sql`.
- Changing `NEXT_PUBLIC_SITE_URL` requires a **rebuild** (inlined at build time
  in the web image), i.e. a new publish + deploy, not just an env change.
