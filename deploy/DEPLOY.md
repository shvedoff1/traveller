# Deploying Traveller to the VPS (traveller.shvedov.tech)

Traveller runs as its own compose stack at **`/srv/traveller`** (postgres +
redis + api + web). TLS and routing are handled by the **existing Caddy** in
the blog stack (`/srv/shvedov`), which already owns ports 80/443 and the
external Docker network **`shvedov_edge`**.

**Split of responsibilities — so machine credentials live in one place:**

- **This repo** only *builds and publishes* the two images to GHCR
  (`.github/workflows/publish-images.yml`, `GITHUB_TOKEN` only — no SSH, no app
  secrets here).
- **The blog repo** *provisions and deploys*: its `deploy traveller` workflow
  SSHes to the VPS (reusing the blog's `SSH_*` secrets), writes `/srv/traveller`,
  and rolls the stack forward. See the blog repo's `DEPLOY-TRAVELLER.md`.

You need **no direct SSH access** and set only **one secret**. Nothing runs the
seed: **production starts empty** and users self-register via magic-link login.

## Secrets, kept minimal

Non-sensitive config (URLs, SMTP host/user, `MAIL_FROM`, rate limits) is written
inline by the deploy workflow. `JWT_SECRET` and the Postgres password are
**generated on the VPS on first deploy** and persisted, then reused — they never
live in this (public) repo. The only secret you supply is **`SMTP_PASS`** (the
Resend API key), as a secret in the **blog** repo.

---

## 1. DNS (one-time)

Create an **A record**: `traveller.shvedov.tech` → the VPS public IP (same IP as
the blog). Check with `dig +short traveller.shvedov.tech`. Caddy provisions the
Let's Encrypt cert automatically.

## 2. Email — Resend

Magic-link login is the primary auth path, so a working SMTP sender is required.

1. [Resend](https://resend.com) account.
2. **Add & verify a domain** — recommended subdomain `mail.shvedov.tech`
   (isolates sender reputation). Add the DKIM/SPF/MX records Resend shows;
   verification must go green.
3. Create an **API key** (`re_...`, "Sending access").
4. The default sender is `Traveller <login@mail.shvedov.tech>`. If your verified
   domain differs, set a `MAIL_FROM` **repo variable** in the blog repo to
   override. `SMTP_HOST=smtp.resend.com`, port 465, user `resend` are already
   baked in. (Brevo also works: `smtp-relay.brevo.com`, 587, non-secure.)

Resend's free tier is 100 emails/day; the app's global daily cap defaults to
200 — lower `MAGIC_LINK_GLOBAL_DAILY_MAX` if you want the app to cut off first
(it's a plain env; add it to the inline block in the blog workflow if needed).

## 3. Blog repo secret (holds deploy credentials)

In **shvedoff1/blog** → Settings → Secrets and variables → Actions:

| Secret | Value |
| ------ | ----- |
| `SSH_HOST`, `SSH_USER`, `SSH_KEY` | already present (blog deploy) — reused |
| `SMTP_PASS` | the Resend API key (`re_...`) — **the only one you add** |
| `GHCR_PAT` *(optional)* | `read:packages` PAT, only if images stay private |

**GHCR image visibility** — images publish to `ghcr.io/shvedoff1/traveller-api`
and `…/traveller-web`, private by default. Simplest: make both packages
**public** (GitHub → profile → Packages → each → Package settings → Change
visibility → Public); then no `GHCR_PAT` is needed. They contain only app code.

## 4. Caddy (already merged)

The `traveller.shvedov.tech` block is merged in the blog repo's `Caddyfile`
(shvedoff1/blog#2). It preserves the `/api` path (the API serves under a real
`/api` prefix — stripping it would break token refresh).

## 5. Go live

1. **Merge this repo's PR to `main`** → `publish-images.yml` pushes the images
   to GHCR. Make the two packages public (step 3).
2. In the **blog repo**, run **Actions → deploy traveller → Run workflow**
   (leave `tag` as `latest`). It provisions `/srv/traveller`, generates the
   `JWT_SECRET` + DB password, writes `.env` (with your `SMTP_PASS`), starts the
   stack (`prisma migrate deploy` on boot), and bounces Caddy.

Re-running that workflow is how you redeploy; the generated secrets and the DB
volume persist across runs.

## 6. Verification checklist

- [ ] `https://traveller.shvedov.tech/` loads with a valid TLS cert.
- [ ] `https://traveller.shvedov.tech/api/auth/providers` returns JSON.
- [ ] **Login loop with a real email**: enter your address → magic link → click
      → land logged in (`/welcome` on first login). Exercises SMTP **and** the
      `/api/auth/refresh` cookie path.
- [ ] Mark a country, reload → persists.
- [ ] `…/<username>` renders SSR; `…/<username>/opengraph-image` returns a PNG.

## 7. Operations

- **Redeploy / change SMTP key**: update `SMTP_PASS`, re-run the workflow.
- **Roll back**: run the workflow with an older `sha-…` tag (images stay in
  GHCR; migrations are forward-only).
- Changing `NEXT_PUBLIC_SITE_URL` (the site domain) requires a **rebuild** — it's
  inlined into the web image at build time.
