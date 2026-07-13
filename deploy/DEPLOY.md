# Deploying Traveller to the VPS (traveller.shvedov.tech)

Traveller runs as its own compose stack at **`/srv/traveller`** (postgres +
redis + api + web). TLS and routing are handled by the **existing Caddy** in
the blog stack (`/srv/shvedov`), which already owns ports 80/443 and the
external Docker network **`shvedov_edge`**. Traveller only needs its `api` and
`web` containers reachable on that network under the aliases `traveller-api`
and `traveller-web`; Caddy reverse-proxies to them.

Same host, same origin → cookies "just work" (no `COOKIE_DOMAIN`).

CI (`ci.yml`) lints/tests/builds every push. Deploy (`deploy.yml`) runs only on
`main`: it builds + pushes both images to GHCR, then SSHes in and rolls the
stack forward. Nothing here runs the seed — **production starts empty** and
users self-register via magic-link login.

---

## 1. DNS (owner, one-time)

Create an **A record**: `traveller.shvedov.tech` → the VPS public IP (the same
IP the blog uses). Wait for propagation (`dig +short traveller.shvedov.tech`).
Caddy will provision the Let's Encrypt cert automatically on first request.

## 2. Email provider — Resend (recommended)

Magic-link login is the primary auth path, so a working SMTP sender is
required.

1. Create a [Resend](https://resend.com) account.
2. **Add & verify the domain** `shvedov.tech` (or a subdomain like
   `mail.shvedov.tech`): add the DKIM/SPF/MX records Resend shows to your DNS.
   Verification must go green before sends succeed.
3. Create an **API key** (`re_...`).
4. Map to env (see `.env`):
   - `SMTP_HOST=smtp.resend.com`
   - `SMTP_PORT=465`, `SMTP_SECURE=true`
   - `SMTP_USER=resend`
   - `SMTP_PASS=re_...` (the API key)
   - `MAIL_FROM=Traveller <login@shvedov.tech>` (a verified sender address)

(Brevo works too: host `smtp-relay.brevo.com`, port `587`, `SMTP_SECURE=false`,
user = your login, pass = an SMTP key.)

## 3. GitHub setup

**Repository secrets** (Settings → Secrets and variables → Actions):

| Secret     | Value                                                        |
| ---------- | ----------------------------------------------------------- |
| `SSH_HOST` | VPS IP / hostname (same VM as the blog)                     |
| `SSH_USER` | deploy user with docker access                              |
| `SSH_KEY`  | private key whose public half is in that user's `authorized_keys` |

`GITHUB_TOKEN` (automatic) pushes the images — the workflow already grants it
`packages: write`.

**GHCR image visibility.** Images publish to
`ghcr.io/shvedoff1/traveller-api` and `…/traveller-web`. They are **private by
default**, so the VPS must be able to pull them. Two options:

- **Recommended — make the two packages public** (GitHub → your profile →
  Packages → each package → Package settings → Change visibility → Public).
  Then no registry login is needed on the VPS.
- **Or keep them private and log in on the VPS** with a read-only PAT
  (classic PAT, scope `read:packages`):
  ```bash
  echo "<PAT>" | docker login ghcr.io -u shvedoff1 --password-stdin
  ```
  The stored credential lets `docker compose pull` fetch private images.

## 4. VPS preparation (one-time)

```bash
sudo mkdir -p /srv/traveller
cd /srv/traveller

# Copy the compose file from the repo, renamed to the default filename:
#   deploy/docker-compose.prod.yml  ->  /srv/traveller/docker-compose.yml
# (scp it, or paste it — it does not change between deploys.)

# Create the environment file from the template and fill in real secrets:
#   deploy/.env.example -> /srv/traveller/.env
$EDITOR .env   # POSTGRES_PASSWORD + matching DATABASE_URL, JWT_SECRET, SMTP_*

# The external network is owned by the blog's Caddy stack — confirm it exists:
docker network ls | grep shvedov_edge
# If missing (blog not up yet): docker network create shvedov_edge
```

Minimum values to set in `/srv/traveller/.env` (rest have sane defaults in the
template):

- `POSTGRES_PASSWORD` — strong random; **must match** the password embedded in
  `DATABASE_URL=postgresql://traveller:<pw>@postgres:5432/traveller`.
- `JWT_SECRET` — `openssl rand -hex 32`.
- `SMTP_*` + `MAIL_FROM` — from step 2.
- `API_URL=https://traveller.shvedov.tech/api`,
  `WEB_ORIGIN=https://traveller.shvedov.tech`,
  `API_INTERNAL_URL=http://traveller-api:4000`,
  `NEXT_PUBLIC_SITE_URL=https://traveller.shvedov.tech`, `TRUST_PROXY=true`
  (already set in the template).

## 5. Caddy server block (blog repo — separate PR)

Add this to the blog stack's `Caddyfile`. It preserves the `/api` path (the API
serves under a real `/api` prefix — do **not** use `handle_path`, which would
strip it and break token refresh). This block is merged in the blog repo; it is
reproduced here verbatim for review:

```caddy
traveller.shvedov.tech {
	encode zstd gzip

	# API — path preserved (NOT stripped). The refresh cookie is scoped to
	# /api/auth/refresh, so the browser-visible path must reach the API as-is.
	handle /api/* {
		reverse_proxy traveller-api:4000
	}

	# Everything else → the Next.js web app.
	handle {
		reverse_proxy traveller-web:3000
	}
}
```

After editing the Caddyfile, reload Caddy from the blog stack:
`cd /srv/shvedov && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`
(or restart the caddy container).

## 6. First deploy

Push to `main` (or run the **Deploy** workflow via *Actions → Deploy → Run
workflow*). The pipeline:

1. Builds `traveller-api` + `traveller-web`, pushes `:latest` and
   `:sha-<short>` to GHCR.
2. SSHes to the VPS and runs, in `/srv/traveller`:
   ```bash
   export TAG=sha-<short>
   docker compose pull
   docker compose up -d        # api entrypoint runs `prisma migrate deploy`
   docker restart $(docker ps -qf name=caddy)   # re-resolve upstream DNS
   ```

The `TAG` pin means each deploy runs an exact, reproducible image; `latest` is
just a convenience tag.

### Manual first run (optional, to watch it come up)

```bash
cd /srv/traveller
export TAG=latest        # or a specific sha-xxxxxxx
docker compose pull
docker compose up -d
docker compose ps        # api + web should become healthy
docker compose logs -f api    # watch "prisma migrate deploy" then "api listening"
```

## 7. Verification checklist

```bash
# API health — reachable WITHOUT the /api prefix (excluded from the prefix):
docker exec traveller-api-1 node -e \
  "fetch('http://127.0.0.1:4000/healthz').then(r=>r.text()).then(t=>console.log(t))"
# -> {"status":"ok"}
```

- [ ] `https://traveller.shvedov.tech/` loads the app (valid TLS cert).
- [ ] `https://traveller.shvedov.tech/api/auth/providers` returns JSON
      (confirms Caddy forwards `/api/*` with the path preserved).
- [ ] **Login loop with a real email**: enter your address → receive the magic
      link → click it → you land logged in (redirected to `/welcome` on first
      login). This exercises SMTP **and** the refresh cookie path
      (`/api/auth/refresh`) — the whole point of the `/api` prefix work.
- [ ] Mark a country, reload → it persists.
- [ ] Public profile `https://traveller.shvedov.tech/<username>` renders SSR.
- [ ] OG image: `https://traveller.shvedov.tech/<username>/opengraph-image`
      returns a PNG (also check an unfurl in Slack/Twitter).
- [ ] Seed was **not** run — the DB has only real, self-registered users.

## 8. Operations

- **Redeploy**: push to `main`, or re-run the Deploy workflow.
- **Roll back**: `cd /srv/traveller && TAG=sha-<older> docker compose up -d`
  (images stay in GHCR; migrations are forward-only — a rollback that predates
  a migration needs a DB-compatible tag).
- **Logs**: `docker compose logs -f api|web`.
- **DB backup**:
  `docker compose exec postgres pg_dump -U traveller traveller > backup.sql`.
- **Env change**: edit `/srv/traveller/.env`, then
  `docker compose up -d` to recreate with the new values. Changing
  `NEXT_PUBLIC_SITE_URL` requires a **rebuild** (it's inlined at build time),
  not just a restart.
